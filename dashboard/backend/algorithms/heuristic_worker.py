"""
heuristic_worker.py — Background Heuristic Evaluation Queue
============================================================

Decouples heavy O(N) sliding-window math from the ASGI hot path.
Only ADMITTED requests that pass the per-IP debounce interval are queued.
Metrics for ALL requests (blocked, debounced, etc.) are handled by the
MetricsAccumulator — this worker only runs classification evaluations.
"""

import asyncio
import logging

logger = logging.getLogger("heuristic_worker")

_NUM_WORKERS = 20
_QUEUE_MAX   = 10_000


class HeuristicTaskQueue:

    def __init__(self, limiter, eval_interval: float = 1.0):
        self._limiter = limiter
        self._eval_interval = eval_interval
        self._last_eval: dict[str, float] = {}
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._worker_tasks: list[asyncio.Task] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._worker_tasks:
            return
        try:
            loop = asyncio.get_running_loop()
            for i in range(_NUM_WORKERS):
                task = loop.create_task(self._worker_loop(), name=f"heuristic_worker_{i}")
                self._worker_tasks.append(task)
            logger.info("Started %d heuristic background workers.", _NUM_WORKERS)
        except RuntimeError:
            pass  # no running loop yet

    def stop(self) -> None:
        for task in self._worker_tasks:
            if not task.done():
                task.cancel()
        self._worker_tasks.clear()
        logger.info("Heuristic background workers stopped.")

    # ------------------------------------------------------------------
    # Submit API  (called from hot path — must be non-blocking)
    # ------------------------------------------------------------------

    def submit(
        self,
        ip:           str,
        now:          float,
        classification,            # TrafficClass enum
        tokens_left:  float,
        decision:     str,
        endpoint:     str,
        latency_ms:   float,
    ) -> None:
        """
        Queue an ADMITTED request for full heuristic evaluation.

        Debounce: only one evaluation per IP per ``_eval_interval`` seconds.
        If debounced or queue full → silently skip (the MetricsAccumulator
        has already recorded this request's counters and window entry).
        """
        if not self._worker_tasks:
            self.start()

        last = self._last_eval.get(ip, 0.0)
        if now - last < self._eval_interval:
            return                     # debounced — metrics already recorded

        self._last_eval[ip] = now
        try:
            self._queue.put_nowait(
                (ip, now, classification, tokens_left, decision, endpoint, latency_ms)
            )
        except asyncio.QueueFull:
            pass                       # drop eval — metrics already recorded

    # ------------------------------------------------------------------
    # Worker loop
    # ------------------------------------------------------------------

    async def _worker_loop(self) -> None:
        while True:
            try:
                task_data = await self._queue.get()
                ip, now, classification, tokens_left, decision, endpoint, latency_ms = task_data
                await self._limiter._post_request_tasks(
                    ip, now, False, classification, tokens_left, decision, endpoint, latency_ms
                )
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Error in heuristic worker loop: %s", e)
