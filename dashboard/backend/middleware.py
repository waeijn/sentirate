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
RATE_WINDOW_SECONDS  = 10.0
SUSPICIOUS_PERSIST_S = 15
BURST_IV_MS          = 50
BURST_FREQ_MIN       = 0.20
SIGMA_BOT_THRESHOLD  = 0.1
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

    @property
    def _redis(self) -> aioredis.Redis:
        import redis_client as rc
        return rc.get_redis()

    def _k(self, ip: str, suffix: str) -> str:
        return f"{REDIS_NS}:{ip}:{suffix}"

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
        state     = await self._redis.hmget(state_key, "classification", "classified_at")
        raw_class, classified_at_raw = state[0], state[1]

        classification = TrafficClass(raw_class if raw_class else "normal")

        if classification == TrafficClass.SUSPICIOUS and classified_at_raw:
            if (now - float(classified_at_raw)) > SUSPICIOUS_PERSIST_S:
                classification = TrafficClass.NORMAL
                await self._redis.hset(state_key, mapping={
                    "classification": "normal",
                    "classified_at":  str(now),
                })
                await self._redis.expire(state_key, BUCKET_TTL)
                logger.info("SUSPICIOUS expired → NORMAL | ip=%s", ip)

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
        asyncio.create_task(self._record_latency(latency_ms),       
                            name=f"lat:{ip}")
        
        asyncio.create_task(
            self._post_request_tasks(ip, now, False, classification,
                                     tokens_left, decision, endpoint),
            name=f"post:{ip}",
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

    async def _post_request_tasks(
        self,
        ip:             str,
        now:            float,
        is_error:       bool,
        classification: TrafficClass,
        tokens_left:    float,
        decision:       str,
        endpoint:       str,
    ) -> None:
        try:
            metrics_summary = await self._background_heuristic_update(
                ip, now, is_error, classification
            )
            markers       = metrics_summary["markers"]
            runtime_class = metrics_summary["new_class"]

            await self._update_counters_and_log(
                ip, now, decision, runtime_class, tokens_left, endpoint, markers
            )
        except Exception:
            logger.exception("Error in _post_request_tasks for ip=%s", ip)

    async def _update_counters_and_log(
        self,
        ip:             str,
        now:            float,
        decision:       str,
        classification: TrafficClass,
        tokens_left:    float,
        endpoint:       str,
        markers:        dict,
    ) -> None:
        try:
            state_key   = self._k(ip, "state")
            metrics_key = f"{REDIS_NS}:_metrics"
            log_key     = f"{REDIS_NS}:_log"

            pipe = self._redis.pipeline(transaction=False)

            pipe.hincrby(state_key, "request_count", 1)
            pipe.hset(state_key, mapping={
                "last_seen":         str(now),
                "classification":    classification.value,
                "lambda":            str(markers.get("lambda",      0.0)),
                "sigma":             str(markers.get("sigma",       0.0)),
                "burst_freq":        str(markers.get("burst_freq",  0.0)),
                "burst_persistence": str(markers.get("persistence", 0.0)),
            })
            if decision == "ADMITTED":
                pipe.hincrby(state_key, "total_accepted", 1)
            else:
                pipe.hincrby(state_key, "total_rejected", 1)
            pipe.expire(state_key, BUCKET_TTL)

            # Global metrics for RAR/FPR/FNR
            pipe.hincrby(metrics_key, "total_requests", 1)
            if decision == "ADMITTED":
                pipe.hincrby(metrics_key, "admitted", 1)
                pipe.hincrby(metrics_key, f"{classification.value}_admitted", 1)
            else:
                pipe.hincrby(metrics_key, "blocked", 1)
                pipe.hincrby(metrics_key, f"{classification.value}_blocked", 1)
            pipe.hincrby(metrics_key, f"{classification.value}_total", 1)
            pipe.expire(metrics_key, 86400)

            pipe.pfadd(f"{REDIS_NS}:_unique_ips", ip)
            pipe.expire(f"{REDIS_NS}:_unique_ips", 86400)
             
            results = await pipe.execute()

            is_new_ip = (results[0] == 1)
            if is_new_ip:
                count_pipe = self._redis.pipeline(transaction=False)
                await count_pipe.execute()

            # Log entry with live markers
            cap, rfill = BUCKET_PROFILES[classification.value]
            entry = json.dumps({
                "ip":             ip,
                "timestamp":      now,
                "classification": classification.value,
                "traffic_type":   classification.value,
                "decision":       decision,
                "justification": self._generate_justification(
                    ip, classification, decision, markers, tokens_left, cap, rfill
                ),
                "risk_score": RISK_SCORES.get(classification.value, 0.0),
                "markers":    markers,
                "bucket": {
                    "current_tokens":      round(tokens_left, 2),
                    "capacity":            cap,
                    "refill_rate":         rfill,
                    "seconds_until_token": round(1.0 / rfill, 3) if rfill > 0 else 999,
                },
                "endpoint": endpoint,
            })
            log_pipe = self._redis.pipeline(transaction=False)
            log_pipe.lpush(log_key, entry)
            log_pipe.ltrim(log_key, 0, LOG_MAX - 1)
            log_pipe.expire(log_key, 86400)
            await log_pipe.execute()

        except Exception:
            logger.exception("_update_counters_and_log failed | ip=%s", ip)

    async def _background_heuristic_update(
        self,
        ip:            str,
        now:           float,
        is_error:      bool,
        current_class: TrafficClass,
    ) -> dict:
        default_summary = {
            "markers": {
                "lambda": 0.0, "sigma": 0.0,
                "burst_freq": 0.0, "persistence": 0.0,
            },
            "new_class": current_class,
        }
        try:
            window_key = self._k(ip, "window")
            errors_key = self._k(ip, "errors")
            state_key  = self._k(ip, "state")

            member = f"{now:.6f}"
            pipe   = self._redis.pipeline(transaction=False)
            pipe.zadd(window_key, {member: now})
            pipe.zremrangebyscore(window_key, "-inf", now - RATE_WINDOW_SECONDS)
            pipe.zremrangebyrank(window_key, 0, -(WINDOW_MAXLEN + 1))
            pipe.expire(window_key, BUCKET_TTL)
            pipe.hincrby(errors_key, "total", 1)
            if is_error:
                pipe.hincrby(errors_key, "errors", 1)
            pipe.expire(errors_key, BUCKET_TTL)
            await pipe.execute()

            timestamps = [
                float(ts) for ts in await self._redis.zrange(window_key, 0, -1)
            ]
            if len(timestamps) < 2:
                return default_summary

            span      = timestamps[-1] - timestamps[0]
            lam       = len(timestamps) / span if span > 0 else float(len(timestamps))
            intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
            mean_iv   = sum(intervals) / len(intervals)
            sigma     = math.sqrt(
                sum((iv - mean_iv) ** 2 for iv in intervals) / len(intervals)
            )

            # Burst events: consecutive requests arriving within BURST_IV_MS
            burst_event_times = [
                timestamps[i] for i in range(1, len(timestamps))
                if intervals[i - 1] < BURST_IV_MS / 1000.0
            ]
            burst_count        = len(burst_event_times)
            burst_rate_per_min = (burst_count / span) * 60.0 if span > 0 else 0.0

            # Persistence: how long bursting has been sustained
            persistence = (
                burst_event_times[-1] - burst_event_times[0]
                if len(burst_event_times) >= 2 else 0.0
            )

            raw_burst_fraction = burst_count / len(intervals)
            new_class = self._classify(lam, sigma, raw_burst_fraction)

            logger.info(
                "heuristic | ip=%-15s λ=%6.2f σ=%.4f burst/min=%.1f persist=%.1fs → %s",
                ip, lam, sigma, burst_rate_per_min, persistence, new_class.value,
            )

            if new_class != current_class:
                logger.warning(
                    "class_change | ip=%-15s  %s → %s  (λ=%.2f)",
                    ip, current_class.value, new_class.value, lam,
                )
                new_cap, new_rfill = BUCKET_PROFILES[new_class.value]
                tr = self._redis.pipeline(transaction=True)
                tr.hset(state_key, mapping={
                    "classification": new_class.value,
                    "classified_at":  str(now),
                })
                tr.expire(state_key, BUCKET_TTL)
                tr.hset(self._k(ip, "bucket"), mapping={
                    "tokens":      str(float(new_cap)),
                    "last_refill": str(now),
                })
                tr.expire(self._k(ip, "bucket"), BUCKET_TTL)
                await tr.execute()

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

            return {
                "markers": {
                    "lambda":      round(lam, 2),
                    "sigma":       round(sigma, 4),
                    "burst_freq":  round(burst_rate_per_min, 1),
                    "persistence": round(persistence, 1),
                },
                "new_class": new_class,
            }

        except Exception:
            logger.exception("_background_heuristic_update failed | ip=%s", ip)
            return default_summary

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
            if sigma <= SIGMA_BOT_THRESHOLD and sigma > 0:
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
    def _classify(lam: float, sigma: float, burst_freq: float) -> TrafficClass:
        # Suspicious — any ONE of these triggers it
        if lam > LAMBDA_BURSTY_MAX:
            return TrafficClass.SUSPICIOUS
        if sigma > 0 and sigma < SIGMA_BOT_THRESHOLD:
            return TrafficClass.SUSPICIOUS
        if burst_freq > 5:
            return TrafficClass.SUSPICIOUS

        # Bursty — any ONE of these
        if lam > LAMBDA_NORMAL_MAX:
            return TrafficClass.BURSTY
        if burst_freq >= 3:
            return TrafficClass.BURSTY

        # Normal — everything else
        return TrafficClass.NORMAL

    # =========================================================================
    # PUBLIC READ METHODS
    # =========================================================================

    async def _record_latency(self, latency_ms: float) -> None:
        try:
            pipe = self._redis.pipeline(transaction=False)
            pipe.lpush(LATENCY_KEY, f"{latency_ms:.3f}")
            pipe.ltrim(LATENCY_KEY, 0, LATENCY_MAXLEN - 1)
            pipe.expire(LATENCY_KEY, 3600)
            await pipe.execute()
        except Exception:
            logger.exception("Failed to record latency")

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
        data = await self._redis.hgetall(f"{REDIS_NS}:_metrics")
        unique_clients = await self._redis.pfcount(f"{REDIS_NS}:_unique_ips")

        class_counts = {"normal": 0, "bursty": 0, "suspicious": 0, "blocked": 0}
        async for key in self._redis.scan_iter(f"{REDIS_NS}:*:state"):
            cls = await self._redis.hget(key, "classification")
            if cls in class_counts:
                class_counts[cls] += 1

        total    = int(data.get("total_requests", 0))
        admitted = int(data.get("admitted",       0))
        blocked  = int(data.get("blocked",        0))

        rar = admitted / total if total > 0 else 1.0

        normal_total        = int(data.get("normal_total",        0))
        normal_blocked      = int(data.get("normal_blocked",      0))
        suspicious_total    = int(data.get("suspicious_total",    0))
        suspicious_admitted = int(data.get("suspicious_admitted", 0))

        fpr = normal_blocked      / normal_total        if normal_total     > 0 else 0.0
        fnr = suspicious_admitted / suspicious_total    if suspicious_total > 0 else 0.0

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
            "bursty_total":     int(data.get("bursty_total",    0)),
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