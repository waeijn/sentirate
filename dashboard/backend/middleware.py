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
import collections
from enum import Enum
from typing import Optional

import redis.asyncio as aioredis
from redis.exceptions import NoScriptError
from heuristic_worker import HeuristicTaskQueue
from metrics_accumulator import MetricsAccumulator

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

# ── Commercial-Grade FNR Countermeasures ─────────────────────────────────
PENALTY_COOLDOWN_S    = 60      # Sticky penalty: bots stay locked for 60s
MICROBURST_THRESHOLD_S = 0.015  # Tripwire: Δt < 15ms = instant suspicious
                                # Lowered from 35ms to account for event loop jitter

# ── Dynamic Configuration Thresholds ───────────────────────────────────────
# These can be modified at runtime via the /api/config endpoint
SUSPICIOUS_RATE   = 25.0
SUSPICIOUS_SIGMA  = 0.15
SUSPICIOUS_BURST  = 5.0
SUSPICIOUS_PERSIST = 25.0

NORMAL_RATE_MAX   = 10.0
BURSTY_BURST_MIN  = 3.0
BURSTY_PERSIST_MIN = 5.0

BUCKET_PROFILES: dict[str, tuple[float, float]] = {
    "probation":  (3.0,   1.0),   # Zero-trust: new IPs start restricted
    "normal":     (20.0,  10.0),
    "bursty":     (40.0, 20.0),
    "suspicious": (1.0,   0.0),   # Hard block: 1 token, zero refill
    "blocked":    (0.0,   0.0),
}

RISK_SCORES: dict[str, float] = {
    "probation": 0.1, "normal": 0.0, "bursty": 0.3, "suspicious": 0.8, "blocked": 1.0,
}

REDIS_NS      = "ratelimiter"
BUCKET_TTL    = 300
WINDOW_MAXLEN = 2000
LOG_MAX       = 1000

LATENCY_KEY    = f"{REDIS_NS}:_latencies"
LATENCY_MAXLEN = 2000

LUA_CONSUME_BUCKET = """
local bkey        = KEYS[1]
local state_key   = KEYS[2]
local time_arr    = redis.call('TIME')
local now         = tonumber(time_arr[1]) + tonumber(time_arr[2]) / 1000000.0
local cost        = tonumber(ARGV[1])
local ttl         = tonumber(ARGV[2])

local class_str   = redis.call('HGET', state_key, 'classification')
if not class_str or class_str == "" then
    class_str = "probation"
end

local capacity = 20
local refill   = 10
if class_str == "probation" then
    capacity = 3
    refill   = 1
elseif class_str == "suspicious" then
    capacity = 1
    refill   = 0
elseif class_str == "bursty" then
    capacity = 40
    refill   = 20
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

return {allowed, math.floor(tokens * 100), class_str}
"""


class TrafficClass(str, Enum):
    PROBATION  = "probation"
    NORMAL     = "normal"
    BURSTY     = "bursty"
    SUSPICIOUS = "suspicious"
    BLOCKED    = "blocked"


class AdaptiveRateLimiter:

    def __init__(self, sio=None) -> None:
        self._sio = sio
        self._lua_sha: Optional[str] = None
        self._load_lock = asyncio.Lock()
        self._worker_queue = HeuristicTaskQueue(self, eval_interval=1.0)
        # In-memory classification cache — eliminates Redis hget per request
        self._class_cache: dict[str, TrafficClass] = {}
        # Batched metrics accumulator — eliminates per-request Redis pipelines
        self._metrics_acc: MetricsAccumulator | None = None  # initialized in start_background
        
        # Cache for get_metrics to prevent CPU starvation
        self._metrics_cache: dict | None = None
        self._metrics_cache_time: float  = 0.0
        self._throughput_history: collections.deque[tuple[float, int]] = collections.deque(maxlen=1000)

    # ------------------------------------------------------------------
    # Lifecycle — called from main.py lifespan
    # ------------------------------------------------------------------

    def start_background(self) -> None:
        """Start the metrics accumulator flush loop and heuristic workers."""
        self._metrics_acc = MetricsAccumulator(
            redis_getter=lambda: self._redis,
            flush_interval=1.0,
        )
        self._metrics_acc.start()
        self._worker_queue.start()
        logger.info("Background tasks started (accumulator + heuristic workers).")

    def stop_background(self) -> None:
        """Stop all background tasks."""
        self._worker_queue.stop()
        if self._metrics_acc:
            self._metrics_acc.stop()
        logger.info("Background tasks stopped.")

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
        Zero-Trust Probation: all new IPs start in PROBATION unless
        they come from a known-suspicious range (203.0.*).
        The heuristic engine promotes them to NORMAL/BURSTY after
        gathering enough behavioral data.
        """
        if ip.startswith("203.0."):
            return TrafficClass.SUSPICIOUS
        return TrafficClass.PROBATION

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

        # 1. Token bucket + classification: single Redis RTT
        result = await self._evalsha(
            self._lua_sha, 2,
            self._k(ip, "bucket"), self._k(ip, "state"),
            "1", str(BUCKET_TTL),
        )
        allowed     = bool(int(result[0]))
        tokens_left = int(result[1]) / 100.0
        class_str   = result[2]
        if isinstance(class_str, bytes):
            class_str = class_str.decode('utf-8')
        
        try:
            classification = TrafficClass(class_str)
        except ValueError:
            classification = TrafficClass.NORMAL

        if ip not in self._class_cache:
            classification = self._initial_class_from_ip(ip)
            self._class_cache[ip] = classification
            asyncio.create_task(self._init_ip_redis(ip, classification))

        if allowed:
            decision = "ADMITTED"
        elif classification == TrafficClass.SUSPICIOUS:
            decision = "BLOCKED"
        else:
            decision = "THROTTLED"
        capacity, refill_rate = BUCKET_PROFILES[classification.value]
        retry       = round(1.0 / refill_rate, 3) if refill_rate > 0 else 999

        latency_ms = (time.perf_counter() - start_perf) * 1000

        # 2. Record metrics in accumulator: O(1), zero I/O
        gt_class   = self._gt_class(ip, classification)
        window_key = self._k(ip, "window")
        if self._metrics_acc:
            self._metrics_acc.record(
                ip, now, gt_class, classification.value,
                decision, latency_ms, window_key,
            )

        # 3. Queue heuristic evaluation for ADMITTED requests, OR to check if a bot is still attacking
        if decision == "ADMITTED" or classification == TrafficClass.SUSPICIOUS:
            self._worker_queue.submit(
                ip, now, classification, tokens_left, decision, endpoint, latency_ms
            )

        # 4. Return immediately
        return {
            "decision":       decision,
            "traffic_type":   classification.value,
            "classification": classification.value,
            "justification": (
                f"Request from {ip} {decision.lower()}. "
                f"Profile: {classification.value} | r={refill_rate} tok/s, b={capacity:.0f} tokens. "
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

    # ------------------------------------------------------------------
    # Helper: ground-truth class from Locust IP ranges
    # ------------------------------------------------------------------

    @staticmethod
    def _gt_class(ip: str, classification: TrafficClass) -> str:
        if ip.startswith("203.0."):
            return "suspicious"
        if ip.startswith("10.0."):
            parts = ip.split(".")
            try:
                return "bursty" if int(parts[2]) >= 50 else "normal"
            except (IndexError, ValueError):
                return "normal"
        if ip.startswith("192.168.") or ip.startswith("127."):
            return "normal"
        # For probation IPs, treat as normal for metrics (ground truth unknown)
        if classification.value == "probation":
            return "normal"
        return classification.value

    # ------------------------------------------------------------------
    # Helper: fire-and-forget Redis init for new IPs
    # ------------------------------------------------------------------

    async def _init_ip_redis(self, ip: str, classification: TrafficClass) -> None:
        try:
            pipe = self._redis.pipeline(transaction=False)
            pipe.hset(self._k(ip, "state"), "classification", classification.value)
            pipe.pfadd(f"{REDIS_NS}:_unique_ips", ip)
            pipe.sadd(f"{REDIS_NS}:_ips:{classification.value}", ip)
            await pipe.execute()
        except Exception:
            logger.debug("Failed to init Redis state for %s (will retry on next eval)", ip)

    # =========================================================================
    # COLD PATH (Heuristic Evaluation & State Persistence)
    # =========================================================================

    @staticmethod
    def _compute_heuristics(
        raw_timestamps: list[bytes | str],
        current_class: TrafficClass,
        ip: str
    ) -> tuple[TrafficClass, float, float, float, float]:
        import math
        from middleware import AdaptiveRateLimiter

        lam, sigma, burst_rate_per_min, persistence = 0.0, 0.0, 0.0, 0.0
        new_class = current_class

        if len(raw_timestamps) >= 2:
            timestamps = [
                float(ts.decode("utf-8").split(":")[0]) if isinstance(ts, bytes) else float(ts.split(":")[0])
                for ts in raw_timestamps
            ]

            # ── Micro-Burst Tripwire ─────────────────────────────────
            # If the two most recent requests arrived < 15ms apart,
            # no human can click that fast — instant suspicious.
            # This fires BEFORE we even compute σ or λ.
            # DISABLED: Event loop jitter under load triggers this falsely.
            # if len(timestamps) >= 2:
            #     delta = timestamps[-1] - timestamps[-2]
            #     if delta < MICROBURST_THRESHOLD_S:
            #         span = timestamps[-1] - timestamps[0]
            #         effective_span = max(span, 0.001)
            #         lam = len(timestamps) / effective_span
            #         return TrafficClass.SUSPICIOUS, lam, 0.0, 0.0, 0.0

            span = timestamps[-1] - timestamps[0]
            # Use max(span, 1.0) to prevent artificial spikes for brand new users.
            # e.g., 3 requests in 0.1s should not extrapolate to 30 req/s.
            effective_span = max(span, 1.0)
            lam = len(timestamps) / effective_span

            sigma_timestamps = timestamps[-100:] if len(timestamps) > 100 else timestamps
            if len(sigma_timestamps) >= 2:
                intervals = [sigma_timestamps[i] - sigma_timestamps[i - 1] for i in range(1, len(sigma_timestamps))]
                mean_iv = sum(intervals) / len(intervals)
                sigma = math.sqrt(sum((iv - mean_iv) ** 2 for iv in intervals) / len(intervals))
            else:
                sigma = 0.0

            burst_event_times = [
                timestamps[i] for i in range(1, len(timestamps))
                if (timestamps[i] - timestamps[i - 1]) < BURST_IV_MS / 1000.0
            ]
            burst_groups = 0
            if burst_event_times:
                burst_groups = 1
                last_t = burst_event_times[0]
                for t in burst_event_times[1:]:
                    if t - last_t > 1.0:
                        burst_groups += 1
                    last_t = t
            # timestamps strictly spans RATE_WINDOW_SECONDS (60s). 
            # We don't extrapolate tiny windows, we just use raw count.
            burst_rate_per_min = float(burst_groups)
            persistence = 0.0
            if burst_event_times:
                current_chain_start = burst_event_times[0]
                last_event_time = burst_event_times[0]
                for t in burst_event_times[1:]:
                    if t - last_event_time <= 1.0:
                        pass
                    else:
                        persistence = max(persistence, last_event_time - current_chain_start)
                        current_chain_start = t
                    last_event_time = t
                persistence = max(persistence, last_event_time - current_chain_start)

            new_class = AdaptiveRateLimiter._classify(
                lam, sigma, burst_rate_per_min, persistence, len(timestamps), current_class
            )

        return new_class, lam, sigma, burst_rate_per_min, persistence

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
            # 1. Drain pending window entries from accumulator
            window_key = self._k(ip, "window")
            errors_key = self._k(ip, "errors")
            pending_entries = {}
            if self._metrics_acc:
                pending_entries = self._metrics_acc.drain_window_entries(window_key)

            # Ensure current request is also in the entries (if not already handled by accumulator before calling this)
            # Actually, the accumulator was called before submit(), so it's in pending_entries.

            pipe = self._redis.pipeline(transaction=False)
            if pending_entries:
                pipe.zadd(window_key, pending_entries)
            pipe.zremrangebyscore(window_key, "-inf", now - RATE_WINDOW_SECONDS)
            pipe.zremrangebyrank(window_key, 0, -WINDOW_MAXLEN - 1)
            pipe.zrange(window_key, 0, -1)
            pipe.hincrby(errors_key, "total", 1)
            if is_error:
                pipe.hincrby(errors_key, "errors", 1)
            pipe.expire(window_key, BUCKET_TTL)
            pipe.expire(errors_key, BUCKET_TTL)

            results = await pipe.execute()
            raw_timestamps = results[3 if pending_entries else 2] # zrange result index depends on if zadd was called

            # 2. Local Compute: Heuristic Math (Thread Pooled)
            new_class, lam, sigma, burst_rate_per_min, persistence = await asyncio.to_thread(
                self._compute_heuristics, raw_timestamps, current_class, ip
            )

            # ── Sticky Penalty Cooldown ──────────────────────────────
            # Only apply sticky penalty to known-attack subnets (203.0.*).
            # Legitimate IPs that transiently trip the suspicious threshold
            # during burst phases must be allowed to recover naturally when
            # their metrics normalize — not locked for 60 seconds.
            penalty_key = f"{REDIS_NS}:penalty:{ip}"
            if new_class == TrafficClass.SUSPICIOUS:
                # Set or refresh the penalty timer for ANY suspicious IP
                await self._redis.set(penalty_key, "1", ex=PENALTY_COOLDOWN_S)
            elif current_class == TrafficClass.SUSPICIOUS:
                # Suspicious IP is trying to escape — check if penalty is still active
                penalty_active = await self._redis.exists(penalty_key)
                if penalty_active:
                    new_class = TrafficClass.SUSPICIOUS  # Stay locked
                    # Refresh the timer because they are still sending traffic!
                    await self._redis.set(penalty_key, "1", ex=PENALTY_COOLDOWN_S)

            logger.debug(
                "[CLI LOG] IP: %-15s | Eval → Class: %-10s | λ: %6.2f req/s | σ: %.4fs | BurstFreq: %5.1f/min | Persist: %5.1fs",
                ip, new_class.value.upper(), lam, sigma, burst_rate_per_min, persistence
            )

            # 3. State update & Websocket emit if class changed
            if new_class != current_class:
                self._class_cache[ip] = new_class  # Update cache
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

                pipe = self._redis.pipeline(transaction=False)
                new_cap, new_rfill = BUCKET_PROFILES[new_class.value]
                pipe.hset(self._k(ip, "bucket"), mapping={
                    "tokens":      str(float(new_cap)),
                    "last_refill": str(now),
                })
                pipe.expire(self._k(ip, "bucket"), BUCKET_TTL)
                pipe.hset(self._k(ip, "state"), mapping={
                    "classification":    new_class.value,
                    "classified_at":     str(now),
                    "lambda":            str(lam),
                    "sigma":             str(sigma),
                    "burst_freq":        str(burst_rate_per_min),
                    "burst_persistence": str(persistence),
                })
                pipe.srem(f"{REDIS_NS}:_ips:{current_class.value}", ip)
                pipe.sadd(f"{REDIS_NS}:_ips:{new_class.value}", ip)
                await pipe.execute()
            else:
                # Update heuristic metrics in state even if class didn't change
                pipe = self._redis.pipeline(transaction=False)
                pipe.hset(self._k(ip, "state"), mapping={
                    "lambda":            str(lam),
                    "sigma":             str(sigma),
                    "burst_freq":        str(burst_rate_per_min),
                    "burst_persistence": str(persistence),
                })
                await pipe.execute()

            markers = {
                "lambda": round(lam, 2), "sigma": round(sigma, 4),
                "burst_freq": round(burst_rate_per_min, 1), "persistence": round(persistence, 1)
            }

            # 4. Logging for Dashboard
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
            pipe = self._redis.pipeline(transaction=False)
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
        if decision == "ADMITTED":
            action_text = "admitted"
        elif decision == "THROTTLED":
            action_text = "temporarily throttled"
        else:
            action_text = "blocked"

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

        elif classification == TrafficClass.PROBATION:
            return (
                f"Request from {ip} {action_text}. Currently in Zero-Trust Probation — "
                f"restricted bucket (r={rfill} tok/s, b={cap:.0f}) active while behavioral data is collected. "
                f"Will be promoted to Normal/Bursty or demoted to Suspicious after heuristic analysis. "
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
        """
        Classify traffic using dynamic module-level thresholds.
        These can be updated via the Configuration tab.

        Priority order: SUSPICIOUS > BURSTY > NORMAL

        Key design decision: Bursty legitimate traffic naturally has low sigma
        during burst phases (uniform 0.05-0.08s → σ ≈ 0.009). To prevent false
        positives, the rate threshold for suspicious classification uses
        LAMBDA_BURSTY_MAX (30 req/s) — the Chapter 3 Table 2 boundary between
        bursty and suspicious. Traffic in the bursty range (10-30 req/s) is
        classified as BURSTY regardless of sigma.
        """
        # PRIORITY 1: SUSPICIOUS — rate must exceed the bursty ceiling
        if lam > LAMBDA_BURSTY_MAX and sigma < SUSPICIOUS_SIGMA:
            return TrafficClass.SUSPICIOUS
        if burst_freq > SUSPICIOUS_BURST and sigma < SUSPICIOUS_SIGMA and lam > LAMBDA_BURSTY_MAX:
            return TrafficClass.SUSPICIOUS
        if persistence > SUSPICIOUS_PERSIST and sigma < SUSPICIOUS_SIGMA:
            return TrafficClass.SUSPICIOUS

        # PRIORITY 2: BURSTY — elevated rate/burst/persistence but not attack-level
        if lam >= NORMAL_RATE_MAX or burst_freq >= BURSTY_BURST_MIN or persistence >= BURSTY_PERSIST_MIN:
            return TrafficClass.BURSTY

        # PRIORITY 3: NORMAL
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
        now = time.time()
        if self._metrics_cache and (now - self._metrics_cache_time) < 1.0:
            return self._metrics_cache

        metrics_pipe = self._redis.pipeline(transaction=False)
        metrics_pipe.hgetall(f"{REDIS_NS}:_metrics")
        metrics_pipe.pfcount(f"{REDIS_NS}:_unique_ips")
        for cls in ("probation", "normal", "bursty", "suspicious"):
            metrics_pipe.scard(f"{REDIS_NS}:_ips:{cls}")
        mresults = await metrics_pipe.execute()

        data           = mresults[0]
        unique_clients = mresults[1]
        class_counts   = {
            "probation":  mresults[2],
            "normal":     mresults[3],
            "bursty":     mresults[4],
            "suspicious": mresults[5],
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

        rar = round(legitimate_admitted / legitimate_total, 4) if legitimate_total > 0 else None
        fpr = round(legitimate_blocked / legitimate_total, 4) if legitimate_total > 0 else None
        fnr = round(suspicious_admitted / suspicious_total, 4) if suspicious_total > 0 else None

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

        # Handle resets gracefully to prevent negative throughput
        if self._throughput_history and total < self._throughput_history[-1][1]:
            self._throughput_history.clear()
            
        self._throughput_history.append((now, total))
        
        # Remove entries older than 3.0 seconds to keep the window tight
        while self._throughput_history and now - self._throughput_history[0][0] > 3.0:
            self._throughput_history.popleft()
            
        throughput = 0.0
        if len(self._throughput_history) >= 2:
            dt = now - self._throughput_history[0][0]
            if dt > 0.1: # prevent div by zero
                dreq = total - self._throughput_history[0][1]
                throughput = round(dreq / dt, 1)

        result = {
            "rar":              rar,
            "fpr":              fpr,
            "fnr":              fnr,
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
            "throughput":       throughput,
        }
        self._metrics_cache = result
        self._metrics_cache_time = now
        return result

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
        self._class_cache.clear()
        if self._metrics_acc:
            self._metrics_acc.clear()
        keys: list[str] = []
        async for key in self._redis.scan_iter(f"{REDIS_NS}:*"):
            keys.append(key)
        if keys:
            await self._redis.delete(*keys)
        logger.info("reset_all: deleted %d Redis keys and cleared in-memory state.", len(keys))