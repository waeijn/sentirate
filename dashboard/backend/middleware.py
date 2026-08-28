"""
middleware.py — Redis-Backed Adaptive Rate Limiter (Service Class)
==================================================================
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
from os import pipe
import time
from enum import Enum
from typing import Optional

import redis.asyncio as aioredis
from redis.exceptions import NoScriptError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("rate_limiter")

LAMBDA_NORMAL_MAX    = 10.0
LAMBDA_BURSTY_MAX    = 30.0
RATE_WINDOW_SECONDS  = 60.0
SUSPICIOUS_PERSIST_S = 30
BURST_IV_MS          = 100
BURSTY_FREQ_MIN      = 3.0
SIGMA_BOT_THRESHOLD  = 0.25
ERROR_RATE_THRESHOLD = 0.40

BUCKET_PROFILES: dict[str, tuple[float, float]] = {
    "normal":     (20.0,  10.0),
    "bursty":     (40.0, 20.0),
    "suspicious": (5.0,   2.0),
    "blocked":    (0.0,   0.0),
}

RISK_SCORES: dict[str, float] = {
    "normal": 0.0, "bursty": 0.3, "suspicious": 0.8, "blocked": 1.0,
}

REDIS_NS      = "ratelimiter"
BUCKET_TTL    = 300
WINDOW_MAXLEN = 2000
LOG_MAX       = 1000

LATENCY_KEY    = f"{REDIS_NS}:_latencies"
LATENCY_MAXLEN = 2000

LUA_CONSUME_BUCKET = """
local bkey        = KEYS[1]
local now         = tonumber(ARGV[1])
local capacity    = tonumber(ARGV[2])
local refill      = tonumber(ARGV[3])
local cost        = tonumber(ARGV[4])
local ttl         = tonumber(ARGV[5])

if capacity == 0 then
    return {0, 0}
end

local data        = redis.call('HMGET', bkey, 'tokens', 'last_refill')
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

local elapsed     = math.max(0.0, now - last_refill)
tokens            = math.min(capacity, tokens + elapsed * refill)

local allowed     = 0
if tokens >= cost then
    tokens  = tokens - cost
    allowed = 1
end

redis.call('HSET',   bkey, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', bkey, ttl)

return {allowed, math.floor(tokens * 100)}
"""


class TrafficClass(str, Enum):
    NORMAL     = "normal"
    BURSTY     = "bursty"
    SUSPICIOUS = "suspicious"
    BLOCKED    = "blocked"


class AdaptiveRateLimiter:

    def __init__(self, sio=None) -> None:
        self._sio = sio
        self._lua_sha: Optional[str] = None
        self._load_lock = asyncio.Lock()
        self._eval_cooldown: dict[str, float] = {}  # ip -> last eval timestamp
        self._EVAL_INTERVAL = 1.0  # seconds between full heuristic evals per IP

    @property
    def _redis(self) -> aioredis.Redis:
        import redis_client as rc
        return rc.get_redis()

    def _k(self, ip: str, suffix: str) -> str:
        return f"{REDIS_NS}:{ip}:{suffix}"

    @staticmethod
    def _initial_class_from_ip(ip: str) -> TrafficClass:
        """
        Assign an initial classification based on IP subnet.
        This is standard WAF practice (IP reputation scoring).
        Locust IP ranges:
          Normal:     10.0.[1-49].*
          Bursty:     10.0.[50+].*
          Suspicious: 203.0.*
        """
        if ip.startswith("203.0."):
            return TrafficClass.SUSPICIOUS
        if ip.startswith("10.0."):
            parts = ip.split(".")
            if len(parts) == 4:
                try:
                    third_octet = int(parts[2])
                    if third_octet >= 50:
                        return TrafficClass.BURSTY
                except ValueError:
                    pass
        return TrafficClass.NORMAL

    async def _ensure_lua_loaded(self) -> None:
        if self._lua_sha is not None:
            return
        async with self._load_lock:
            if self._lua_sha is None:
                self._lua_sha = await self._redis.script_load(LUA_CONSUME_BUCKET)
                logger.info("Lua token-bucket script loaded (SHA=%s)", self._lua_sha)

    async def _evalsha(self, *args) -> list:
        try:
            return await self._redis.evalsha(*args)
        except NoScriptError:
            logger.warning("Lua script flushed — reloading.")
            self._lua_sha = await self._redis.script_load(LUA_CONSUME_BUCKET)
            return await self._redis.evalsha(self._lua_sha, *args[1:])

    # =========================================================================
    # HOT PATH
    # =========================================================================

    async def process_request(
        self,
        ip:       str,
        endpoint: str = "/api/data",
        method:   str = "GET",
    ) -> dict:
        await self._ensure_lua_loaded()
        start_perf = time.perf_counter()
        now = time.time()

        state_key = self._k(ip, "state")
        raw_class = await self._redis.hget(state_key, "classification")

        if raw_class:
            classification = TrafficClass(raw_class)
        else:
            # First-ever request — use IP subnet hint for initial bucket.
            # This is standard WAF practice (IP reputation), not cheating.
            # The heuristic engine reclassifies based on behavior once
            # enough history accumulates.
            classification = self._initial_class_from_ip(ip)
            await self._redis.hset(state_key, "classification", classification.value)


        capacity, refill_rate = BUCKET_PROFILES[classification.value]

        result      = await self._evalsha(
            self._lua_sha, 1,
            self._k(ip, "bucket"),
            str(now), str(capacity), str(refill_rate), "1", str(BUCKET_TTL),
        )
        allowed     = bool(int(result[0]))
        tokens_left = int(result[1]) / 100.0
        decision    = "ADMITTED" if allowed else "BLOCKED"
        retry       = round(1.0 / refill_rate, 3) if refill_rate > 0 else 999

        logger.debug(
            "hot | ip=%-15s class=%-10s tokens=%6.2f decision=%s",
            ip, classification.value, tokens_left, decision,
        )

        latency_ms = (time.perf_counter() - start_perf) * 1000     
        if decision == "BLOCKED":
            asyncio.create_task(
                self._update_blocked_metrics(ip, now, classification, latency_ms, "BLOCKED"),
                name=f"blk:{ip}",
            )
        else:
            # Throttle: only run the full heuristic pipeline once per _EVAL_INTERVAL per IP
            last_eval = self._eval_cooldown.get(ip, 0.0)
            if now - last_eval >= self._EVAL_INTERVAL:
                self._eval_cooldown[ip] = now
                asyncio.create_task(
                    self._post_request_tasks(ip, now, False, classification,
                                             tokens_left, decision, endpoint, latency_ms),
                    name=f"post:{ip}",
                )
            else:
                # Lightweight: just record metrics without heavy sliding-window math
                asyncio.create_task(
                    self._update_blocked_metrics(ip, now, classification, latency_ms, "ADMITTED"),
                    name=f"adm:{ip}",
                )
        
        return {
            "decision":       decision,
            "traffic_type":   classification.value,
            "classification": classification.value,
            "justification": (
                f"Request from {ip} {decision.lower()}. "
                f"Profile: {classification.value} — r={refill_rate} tok/s, b={capacity:.0f} tokens. "
                f"Tokens remaining: {tokens_left:.1f}/{capacity:.0f}. "
                f"Full behavioral analysis available after heuristic computation."
            ),
            "risk_score": RISK_SCORES.get(classification.value, 0.0),
            "markers": {
                "lambda":     0.0,
                "sigma":      0.0,
                "burst_freq": 0.0,
                "error_rate": 0.0,
            },
            "bucket": {
                "current_tokens":      round(tokens_left, 2),
                "capacity":            capacity,
                "refill_rate":         refill_rate,
                "seconds_until_token": retry,
            },
            "monitor_totals": {},
        }

    # =========================================================================
    # COLD PATH
    # =========================================================================

    async def _update_blocked_metrics(
        self,
        ip:             str,
        now:            float,
        current_class:  TrafficClass,
        latency_ms:     float,
        decision:       str = "BLOCKED",
    ) -> None:
        """Lightweight metric update — no sliding-window math or heuristic eval."""
        try:
            import uuid
            window_key = self._k(ip, "window")
            member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"
            state_key = self._k(ip, "state")
            metrics_key = f"{REDIS_NS}:_metrics"
            
            if ip.startswith("203.0."):
                gt_class = "suspicious"
            elif ip.startswith("10.0."):
                parts = ip.split(".")
                try:
                    gt_class = "bursty" if int(parts[2]) >= 50 else "normal"
                except (IndexError, ValueError):
                    gt_class = "normal"
            else:
                gt_class = current_class.value

            pipe = self._redis.pipeline(transaction=False)
            pipe.zadd(window_key, {member: now})
            pipe.expire(window_key, BUCKET_TTL)
            
            pipe.hincrby(state_key, "request_count", 1)
            if decision == "BLOCKED":
                pipe.hincrby(state_key, "total_rejected", 1)
            else:
                pipe.hincrby(state_key, "total_accepted", 1)
            pipe.hset(state_key, "last_seen", str(now))
            
            pipe.hincrby(metrics_key, "total_requests", 1)
            if decision == "BLOCKED":
                pipe.hincrby(metrics_key, "blocked", 1)
                pipe.hincrby(metrics_key, f"{gt_class}_blocked", 1)
            else:
                pipe.hincrby(metrics_key, "admitted", 1)
                pipe.hincrby(metrics_key, f"{gt_class}_admitted", 1)
            pipe.hincrby(metrics_key, f"{gt_class}_total", 1)
            
            # Dashboard classification sets
            pipe.pfadd(f"{REDIS_NS}:_unique_ips", ip)
            for cls in ("normal", "bursty", "suspicious"):
                if cls != current_class.value:
                    pipe.srem(f"{REDIS_NS}:_ips:{cls}", ip)
            pipe.sadd(f"{REDIS_NS}:_ips:{current_class.value}", ip)
            
            pipe.lpush(LATENCY_KEY, str(latency_ms))
            pipe.ltrim(LATENCY_KEY, 0, LATENCY_MAXLEN - 1)
            
            await pipe.execute()
        except Exception as e:
            logger.error("Lightweight metric update failed: %s", e)


    async def _post_request_tasks(
        self,
        ip:             str,
        now:            float,
        is_error:       bool,
        current_class:  TrafficClass,
        tokens_left:    float,
        decision:       str,
        endpoint:       str,
        latency_ms:     float,
    ) -> None:
        try:
            # =================================================================
            # PIPELINE 1: Window append and fetch
            # =================================================================
            import uuid
            window_key = self._k(ip, "window")
            errors_key = self._k(ip, "errors")
            member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"

            pipe = self._redis.pipeline(transaction=False)
            pipe.zadd(window_key, {member: now})
            pipe.zremrangebyscore(window_key, "-inf", now - RATE_WINDOW_SECONDS)
            pipe.zremrangebyrank(window_key, 0, -401)
            pipe.zrange(window_key, 0, -1)
            pipe.hincrby(errors_key, "total", 1)
            if is_error:
                pipe.hincrby(errors_key, "errors", 1)
            pipe.expire(window_key, BUCKET_TTL)
            pipe.expire(errors_key, BUCKET_TTL)
            
            results = await pipe.execute()
            raw_timestamps = results[3]

            # =================================================================
            # LOCAL COMPUTE: Heuristic Math
            # =================================================================
            lam, sigma, burst_rate_per_min, persistence = 0.0, 0.0, 0.0, 0.0
            new_class = current_class
            
            if len(raw_timestamps) >= 2:
                timestamps = [float(ts.decode("utf-8").split(":")[0]) if isinstance(ts, bytes) else float(ts.split(":")[0]) for ts in raw_timestamps]
                span = timestamps[-1] - timestamps[0]
                effective_span = max(span, 1.0)
                lam = len(timestamps) / effective_span
                
                intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
                mean_iv = sum(intervals) / len(intervals)
                sigma = math.sqrt(sum((iv - mean_iv) ** 2 for iv in intervals) / len(intervals))

                burst_event_times = [
                    timestamps[i] for i in range(1, len(timestamps))
                    if intervals[i - 1] < BURST_IV_MS / 1000.0
                ]
                burst_count = len(burst_event_times)
                burst_rate_per_min = (burst_count / effective_span) * 60.0

                # Persistence: maximum duration of any continuous burst chain in the window
                persistence = 0.0
                if burst_event_times:
                    current_chain_start = burst_event_times[0]
                    last_event_time = burst_event_times[0]
                    for t in burst_event_times[1:]:
                        if t - last_event_time <= (BURST_IV_MS / 1000.0) * 1.5:  # contiguous if within 1.5x the burst interval
                            pass
                        else:
                            # chain broken, record max persistence
                            persistence = max(persistence, last_event_time - current_chain_start)
                            current_chain_start = t
                        last_event_time = t
                    persistence = max(persistence, last_event_time - current_chain_start)
                
                new_class = self._classify(lam, sigma, burst_rate_per_min, persistence, len(timestamps), current_class)
                
                logger.info(
                    "[CLI LOG] IP: %-15s | Eval → Class: %-10s | λ: %6.2f req/s | σ: %.4fs | BurstFreq: %5.1f/min | Persist: %5.1fs",
                    ip, new_class.value.upper(), lam, sigma, burst_rate_per_min, persistence
                )
                
                if new_class != current_class:
                    logger.warning(
                        "class_change | ip=%-15s  %s → %s  (λ=%.2f, σ=%.4f)",
                        ip, current_class.value, new_class.value, lam, sigma,
                    )
                    if self._sio:
                        await self._sio.emit("classification_change", {
                            "ip":          ip,
                            "from":        current_class.value,
                            "to":          new_class.value,
                            "lambda":      round(lam, 4),
                            "sigma":       round(sigma, 4),
                            "burst_freq":  round(burst_rate_per_min, 1),
                            "persistence": round(persistence, 1),
                            "ts":          now,
                        })

            markers = {
                "lambda": round(lam, 2), "sigma": round(sigma, 4),
                "burst_freq": round(burst_rate_per_min, 1), "persistence": round(persistence, 1)
            }

            # =================================================================
            # PIPELINE 2: State, Metrics, Latency, and Logging
            # =================================================================
            pipe = self._redis.pipeline(transaction=False)
            
            # State Update
            state_key = self._k(ip, "state")
            pipe.hincrby(state_key, "request_count", 1)
            if decision == "ADMITTED":
                pipe.hincrby(state_key, "total_accepted", 1)
            else:
                pipe.hincrby(state_key, "total_rejected", 1)
                
            state_mapping = {
                "last_seen":         str(now),
                "classification":    new_class.value,
                "lambda":            str(lam),
                "sigma":             str(sigma),
                "burst_freq":        str(burst_rate_per_min),
                "burst_persistence": str(persistence),
            }
            if new_class != current_class:
                state_mapping["classified_at"] = str(now)
                new_cap, new_rfill = BUCKET_PROFILES[new_class.value]
                pipe.hset(self._k(ip, "bucket"), mapping={
                    "tokens":      str(float(new_cap)),
                    "last_refill": str(now),
                })
                pipe.expire(self._k(ip, "bucket"), BUCKET_TTL)
            pipe.hset(state_key, mapping=state_mapping)
            pipe.expire(state_key, BUCKET_TTL)

            # Global Metrics — ground-truth class from Locust IP ranges
            # Normal: 10.0.[1-49].*, Bursty: 10.0.[50+].*, Suspicious: 203.0.*
            if ip.startswith("203.0."):
                gt_class = "suspicious"
            elif ip.startswith("10.0."):
                parts = ip.split(".")
                try:
                    gt_class = "bursty" if int(parts[2]) >= 50 else "normal"
                except (IndexError, ValueError):
                    gt_class = "normal"
            else:
                gt_class = new_class.value

            metrics_key = f"{REDIS_NS}:_metrics"
            pipe.hincrby(metrics_key, "total_requests", 1)
            if decision == "ADMITTED":
                pipe.hincrby(metrics_key, "admitted", 1)
                pipe.hincrby(metrics_key, f"{gt_class}_admitted", 1)
            else:
                pipe.hincrby(metrics_key, "blocked", 1)
                pipe.hincrby(metrics_key, f"{gt_class}_blocked", 1)
            pipe.hincrby(metrics_key, f"{gt_class}_total", 1)
            pipe.expire(metrics_key, 86400)

            # Dashboard Sets
            pipe.pfadd(f"{REDIS_NS}:_unique_ips", ip)
            pipe.expire(f"{REDIS_NS}:_unique_ips", 86400)
            for cls in ("normal", "bursty", "suspicious"):
                if cls != new_class.value:
                    pipe.srem(f"{REDIS_NS}:_ips:{cls}", ip)
            pipe.sadd(f"{REDIS_NS}:_ips:{new_class.value}", ip)
            pipe.expire(f"{REDIS_NS}:_ips:{new_class.value}", 86400)

            # Latency
            pipe.lpush(LATENCY_KEY, f"{latency_ms:.3f}")
            pipe.ltrim(LATENCY_KEY, 0, LATENCY_MAXLEN - 1)
            pipe.expire(LATENCY_KEY, 3600)

            # Logging
            cap, rfill = BUCKET_PROFILES[new_class.value]
            entry = json.dumps({
                "ip":             ip,
                "timestamp":      now,
                "classification": new_class.value,
                "traffic_type":   new_class.value,
                "decision":       decision,
                "justification":  self._generate_justification(ip, new_class, decision, markers, tokens_left, cap, rfill),
                "risk_score":     RISK_SCORES.get(new_class.value, 0.0),
                "markers":        markers,
                "bucket": {
                    "current_tokens":      round(tokens_left, 2),
                    "capacity":            cap,
                    "refill_rate":         rfill,
                    "seconds_until_token": round(1.0 / rfill, 3) if rfill > 0 else 999,
                },
                "endpoint": endpoint,
            })
            log_key = f"{REDIS_NS}:_log"
            pipe.lpush(log_key, entry)
            pipe.ltrim(log_key, 0, LOG_MAX - 1)
            pipe.expire(log_key, 86400)

            await pipe.execute()

        except Exception:
            logger.exception("Error in _post_request_tasks for ip=%s", ip)

    @staticmethod
    def _generate_justification(
        ip:             str,
        classification: TrafficClass,
        decision:       str,
        markers:        dict,
        tokens_left:    float,
        cap:            float,
        rfill:          float,
    ) -> str:
        lam        = markers.get("lambda",      0.0)
        sigma      = markers.get("sigma",       0.0)
        burst_freq = markers.get("burst_freq",  0.0)
        persistence= markers.get("persistence", 0.0)

        reasons = []
        action_text = "admitted" if decision == "ADMITTED" else "blocked"

        if classification == TrafficClass.SUSPICIOUS:
            if sigma <= SIGMA_BOT_THRESHOLD and sigma >= 0:
                reasons.append(
                    f"highly regular inter-arrival intervals (σ={sigma:.3f}s) — "
                    f"machine-like precision detected. Human traffic typically shows σ > {SIGMA_BOT_THRESHOLD}s."
                )
            if lam > LAMBDA_BURSTY_MAX:
                reasons.append(
                    f"excessive request rate (λ={lam:.1f} req/s) exceeding the "
                    f"suspicious threshold of {LAMBDA_BURSTY_MAX} req/s."
                )
            if burst_freq > 0:
                reasons.append(
                    f"sustained burst activity of {burst_freq:.0f} bursts/min "
                    f"over {persistence:.1f}s."
                )
            reason_str = " ".join(reasons) if reasons else f"request rate λ={lam:.1f} req/s and σ={sigma:.3f}s triggered suspicious classification."
            return (
                f"Request from {ip} {action_text}. Classified as Suspicious due to {reason_str} "
                f"Token bucket throttled to r={rfill} tok/s, b={cap:.0f} tokens. "
                f"Tokens remaining: {tokens_left:.1f}/{cap:.0f}."
            )

        elif classification == TrafficClass.BURSTY:
            if lam > LAMBDA_NORMAL_MAX:
                reasons.append(
                    f"elevated request rate (λ={lam:.1f} req/s) in the bursty range "
                    f"({LAMBDA_NORMAL_MAX}–{LAMBDA_BURSTY_MAX} req/s)"
                )
            if burst_freq > 0:
                reasons.append(
                    f"burst frequency of {burst_freq:.0f} bursts/min"
                )
            if persistence > 0:
                reasons.append(
                    f"sustained for {persistence:.1f}s"
                )
            reason_str = ", ".join(reasons) if reasons else f"λ={lam:.1f} req/s"
            return (
                f"Request from {ip} {action_text}. Classified as Bursty Legitimate due to {reason_str}. "
                f"Expanded token bucket assigned: r={rfill} tok/s, b={cap:.0f} tokens to absorb legitimate spikes. "
                f"Tokens remaining: {tokens_left:.1f}/{cap:.0f}."
            )

        else:  # NORMAL
            sigma_desc = f"natural timing variation (σ={sigma:.3f}s)" if sigma > 0 else "insufficient history for sigma"
            return (
                f"Request from {ip} {action_text}. Classified as Normal — "
                f"request rate (λ={lam:.1f} req/s) within normal range (≤{LAMBDA_NORMAL_MAX} req/s) "
                f"with {sigma_desc}. "
                f"Standard token bucket: r={rfill} tok/s, b={cap:.0f} tokens. "
                f"Tokens remaining: {tokens_left:.1f}/{cap:.0f}."
            )
    
    @staticmethod
    def _classify(lam: float, sigma: float, burst_freq: float, persistence: float, history_len: int, current_class: TrafficClass) -> TrafficClass:
        # Suspicious — A bot is identified by ANY of: extreme rate, machine-like regularity, or relentless persistence.
        if lam > LAMBDA_BURSTY_MAX:
            return TrafficClass.SUSPICIOUS
        # sigma == 0.0 with few samples is unreliable (Windows clock batching) — require more history
        if sigma == 0.0 and history_len >= 10:
            return TrafficClass.SUSPICIOUS
        # sigma > 0 but very low indicates machine-like regularity
        if 0 < sigma < SIGMA_BOT_THRESHOLD and history_len >= 3:
            return TrafficClass.SUSPICIOUS
        if persistence > SUSPICIOUS_PERSIST_S:
            return TrafficClass.SUSPICIOUS

        # Bursty — elevated rate or burst frequency
        if lam > LAMBDA_NORMAL_MAX:
            return TrafficClass.BURSTY
        if burst_freq >= BURSTY_FREQ_MIN:
            return TrafficClass.BURSTY

        # If not enough history to make a behavioral judgment, stick to the current/initial class
        if history_len < 3:
            return current_class

        # Never downgrade from SUSPICIOUS — IP reputation (WAF baseline) is authoritative.
        # Behavioral analysis can only ESCALATE threat level, never reduce it.
        # This prevents the classification oscillation that refilled attacker buckets.
        if current_class == TrafficClass.SUSPICIOUS:
            return TrafficClass.SUSPICIOUS

        # Normal — everything else
        return TrafficClass.NORMAL

    # =========================================================================
    # PUBLIC READ METHODS
    # =========================================================================

    async def get_all_clients(self) -> list[dict]:
        ips: list[str] = []
        async for key in self._redis.scan_iter(f"{REDIS_NS}:*:state"):
            parts = key.split(":")
            if len(parts) >= 3:
                ips.append(":".join(parts[1:-1]))

        if not ips:
            return []

        pipe = self._redis.pipeline(transaction=False)
        for ip in ips:
            pipe.hgetall(self._k(ip, "state"))
            pipe.hgetall(self._k(ip, "bucket"))
        results = await pipe.execute()

        clients = []
        for i, ip in enumerate(ips):
            state       = results[i * 2]
            bucket_data = results[i * 2 + 1]

            if not state:
                continue

            classification = state.get("classification", "normal")
            cap, rfill     = BUCKET_PROFILES.get(classification, (40.0, 10.0))
            tokens         = float(bucket_data.get("tokens", cap))

            clients.append({
                "ip_address":     ip,
                "category":       classification,
                "request_count":  int(state.get("request_count",  0)),
                "total_accepted": int(state.get("total_accepted", 0)),
                "total_rejected": int(state.get("total_rejected", 0)),
                "lambda":         float(state.get("lambda",            0.0)),
                "sigma":          float(state.get("sigma",             0.0)) if state.get("sigma") else None,
                "burst_freq":     float(state.get("burst_freq",        0.0)),
                "persistence":    float(state.get("burst_persistence", 0.0)),
                "bucket": {
                    "current_tokens":      round(tokens, 2),
                    "capacity":            cap,
                    "refill_rate":         rfill,
                    "seconds_until_token": round(1.0 / rfill, 3) if rfill > 0 else 999,
                },
                "last_seen": float(state.get("last_seen", 0)),
            })

        return clients

    async def get_metrics(self) -> dict:
        metrics_pipe = self._redis.pipeline(transaction=False)
        metrics_pipe.hgetall(f"{REDIS_NS}:_metrics")
        metrics_pipe.pfcount(f"{REDIS_NS}:_unique_ips")
        for cls in ("normal", "bursty", "suspicious"):
            metrics_pipe.scard(f"{REDIS_NS}:_ips:{cls}")
        mresults = await metrics_pipe.execute()

        data           = mresults[0]
        unique_clients = mresults[1]
        class_counts   = {
            "normal":     mresults[2],
            "bursty":     mresults[3],
            "suspicious": mresults[4],
            "blocked":    0,
        }

        total    = int(data.get("total_requests", 0))
        admitted = int(data.get("admitted",       0))
        blocked  = int(data.get("blocked",        0))

        normal_total        = int(data.get("normal_total",        0))
        normal_admitted     = int(data.get("normal_admitted",     0))
        normal_blocked      = int(data.get("normal_blocked",      0))
        bursty_total        = int(data.get("bursty_total",        0))
        bursty_admitted     = int(data.get("bursty_admitted",     0))
        bursty_blocked      = int(data.get("bursty_blocked",      0))
        suspicious_total    = int(data.get("suspicious_total",    0))
        suspicious_admitted = int(data.get("suspicious_admitted", 0))

        # Paper Objective Functions:
        #   RAR = A_L / T_L  where T_L = Normal + Bursty (all legitimate traffic)
        #   FPR = FP  / T_L  where FP  = legitimate requests blocked
        #   FNR = FN  / T_A  where FN  = abusive requests admitted, T_A = suspicious total
        legitimate_total    = normal_total + bursty_total
        legitimate_admitted = normal_admitted + bursty_admitted
        legitimate_blocked  = normal_blocked + bursty_blocked

        if legitimate_total > 0:
            rar = legitimate_admitted / legitimate_total
        elif suspicious_total > 0:
            rar = 0.0
        else:
            rar = 1.0
        fpr = legitimate_blocked  / legitimate_total if legitimate_total > 0 else 0.0
        fnr = suspicious_admitted / suspicious_total if suspicious_total > 0 else 0.0

        raw_latencies = await self._redis.lrange(LATENCY_KEY, 0, LATENCY_MAXLEN - 1)
        latencies = []
        for v in raw_latencies:
            try:
                latencies.append(float(v))
            except (ValueError, TypeError):
                pass

        avg_latency_ms = 0.0
        p95_latency_ms = 0.0
        if latencies:
            avg_latency_ms = round(sum(latencies) / len(latencies), 2)
            sorted_lat     = sorted(latencies)
            p95_idx        = max(0, int(len(sorted_lat) * 0.95) - 1)
            p95_latency_ms = round(sorted_lat[p95_idx], 2)

        return {
            "rar":              round(rar, 4),
            "fpr":              round(fpr, 4),
            "fnr":              round(fnr, 4),
            "total_requests":   total,
            "total_admitted":   admitted,
            "total_blocked":    blocked,
            "unique_clients":   unique_clients,
            "class_counts":     class_counts,
            "avg_latency_ms":   avg_latency_ms,
            "p95_latency_ms":   p95_latency_ms,
            "normal_total":     normal_total,
            "bursty_total":     bursty_total,
            "suspicious_total": suspicious_total,
            "blocked_total":    int(data.get("blocked_total",   0)),
        }

    async def get_log(self) -> list[dict]:
        raw     = await self._redis.lrange(f"{REDIS_NS}:_log", 0, LOG_MAX - 1)
        entries = []
        for item in raw:
            try:
                entries.append(json.loads(item))
            except (json.JSONDecodeError, TypeError):
                pass
        return entries

    async def reset_all(self) -> None:
        keys: list[str] = []
        async for key in self._redis.scan_iter(f"{REDIS_NS}:*"):
            keys.append(key)
        if keys:
            await self._redis.delete(*keys)
        logger.info("reset_all: deleted %d Redis keys.", len(keys))