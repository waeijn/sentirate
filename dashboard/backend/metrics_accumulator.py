"""
metrics_accumulator.py — Batched In-Memory Metrics for Adaptive Rate Limiter
=============================================================================

Replaces per-request Redis I/O (asyncio.create_task + pipeline) with O(1)
in-memory recording. A single background loop flushes all accumulated
counters, window entries, per-IP state, and latencies to Redis once per second.

At 5000 concurrent users this reduces Redis pipeline calls from ~5000/s to 1/s.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import redis.asyncio as aioredis

logger = logging.getLogger("metrics_accumulator")

REDIS_NS       = "ratelimiter"
LATENCY_KEY    = f"{REDIS_NS}:_latencies"
LATENCY_MAXLEN = 2000
BUCKET_TTL     = 300


class MetricsAccumulator:
    """
    Batches all per-request metric updates in memory and flushes to Redis
    periodically.  Eliminates per-request Redis I/O and asyncio.create_task
    spawning on the hot path.
    """

    def __init__(self, redis_getter, flush_interval: float = 1.0):
        self._get_redis = redis_getter          # callable returning aioredis.Redis
        self._flush_interval = flush_interval

        # Global metric counters  (key → int)
        self._global: dict[str, int] = defaultdict(int)

        # Per-IP state increments (ip → {field → int})
        self._per_ip_incr: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Per-IP last_seen        (ip → str(timestamp))
        self._per_ip_last_seen: dict[str, str] = {}

        # Sliding-window entries  (window_key → {member: score, …})
        self._window_entries: dict[str, dict[str, float]] = defaultdict(dict)

        # Latency samples
        self._latencies: list[str] = []

        # Background flush task
        self._flush_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._flush_task is None or self._flush_task.done():
            loop = asyncio.get_running_loop()
            self._flush_task = loop.create_task(self._flush_loop(), name="metrics_flush")
            logger.info("Metrics accumulator flush loop started (interval=%.1fs).", self._flush_interval)

    def stop(self) -> None:
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
            logger.info("Metrics accumulator flush loop stopped.")

    # ------------------------------------------------------------------
    # Hot-path API  — O(1), zero I/O
    # ------------------------------------------------------------------

    def record(
        self,
        ip:                str,
        now:               float,
        gt_class:          str,
        current_class_val: str,
        decision:          str,
        latency_ms:        float,
        window_key:        str,
    ) -> None:
        """Called once per request on the hot path.  Must be O(1) with no I/O."""
        member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"

        # ── Global metrics ────────────────────────────────────────────
        self._global["total_requests"] += 1
        if decision == "BLOCKED":
            self._global["blocked"] += 1
            self._global[f"{gt_class}_blocked"] += 1
        else:
            self._global["admitted"] += 1
            self._global[f"{gt_class}_admitted"] += 1
        self._global[f"{gt_class}_total"] += 1

        # ── Per-IP state ──────────────────────────────────────────────
        self._per_ip_incr[ip]["request_count"] += 1
        if decision == "BLOCKED":
            self._per_ip_incr[ip]["total_rejected"] += 1
        else:
            self._per_ip_incr[ip]["total_accepted"] += 1
        self._per_ip_last_seen[ip] = str(now)

        # ── Window entry (for λ / σ computation) ─────────────────────
        self._window_entries[window_key][member] = now

        # ── Latency sample ────────────────────────────────────────────
        self._latencies.append(f"{latency_ms:.3f}")

    # ------------------------------------------------------------------
    # Drain API  — called by heuristic worker before evaluation
    # ------------------------------------------------------------------

    def drain_window_entries(self, window_key: str) -> dict[str, float]:
        """Return and clear all pending window entries for *window_key*."""
        return self._window_entries.pop(window_key, {})

    # ------------------------------------------------------------------
    # Background flush
    # ------------------------------------------------------------------

    async def _flush_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self._flush_interval)
                await self._flush()
            except asyncio.CancelledError:
                # Final flush on shutdown
                try:
                    await self._flush()
                except Exception:
                    pass
                break
            except Exception:
                logger.exception("Metrics flush failed")

    async def _flush(self) -> None:
        """Batch all accumulated data into a single Redis pipeline."""
        if (
            not self._global
            and not self._per_ip_incr
            and not self._window_entries
            and not self._latencies
        ):
            return

        redis: aioredis.Redis = self._get_redis()
        metrics_key = f"{REDIS_NS}:_metrics"

        # ── Snapshot & clear ──────────────────────────────────────────
        g_snap  = dict(self._global);           self._global.clear()
        ip_snap = dict(self._per_ip_incr);      self._per_ip_incr.clear()
        ls_snap = dict(self._per_ip_last_seen); self._per_ip_last_seen.clear()
        w_snap  = dict(self._window_entries);   self._window_entries.clear()
        l_snap  = list(self._latencies);        self._latencies.clear()

        pipe = redis.pipeline(transaction=False)

        # ── Global metrics ────────────────────────────────────────────
        for field, value in g_snap.items():
            pipe.hincrby(metrics_key, field, value)
        pipe.expire(metrics_key, 86400)

        # ── Per-IP state ──────────────────────────────────────────────
        for ip, counters in ip_snap.items():
            state_key = f"{REDIS_NS}:{ip}:state"
            for field, value in counters.items():
                pipe.hincrby(state_key, field, value)
            if ip in ls_snap:
                pipe.hset(state_key, "last_seen", ls_snap[ip])
            pipe.expire(state_key, BUCKET_TTL)

        # ── Window entries ────────────────────────────────────────────
        for window_key, entries in w_snap.items():
            if entries:
                pipe.zadd(window_key, entries)
                pipe.expire(window_key, BUCKET_TTL)

        # ── Latencies ────────────────────────────────────────────────
        if l_snap:
            pipe.lpush(LATENCY_KEY, *l_snap)
            pipe.ltrim(LATENCY_KEY, 0, LATENCY_MAXLEN - 1)
            pipe.expire(LATENCY_KEY, 3600)

        await pipe.execute()

    # ------------------------------------------------------------------
    # Reset
    # ------------------------------------------------------------------

    def clear(self) -> None:
        """Discard all pending data (called on state reset between tests)."""
        self._global.clear()
        self._per_ip_incr.clear()
        self._per_ip_last_seen.clear()
        self._window_entries.clear()
        self._latencies.clear()
