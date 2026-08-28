import asyncio
import logging

logger = logging.getLogger("heuristic_worker")

class HeuristicTaskQueue:
    def __init__(self, limiter, eval_interval: float = 1.0):
        self._limiter = limiter
        self._eval_interval = eval_interval
        self._last_eval = {}
        self._queue = asyncio.Queue(maxsize=10000)
        self._worker_tasks = []

    def start(self):
        if not self._worker_tasks:
            try:
                loop = asyncio.get_running_loop()
                for i in range(50):
                    task = loop.create_task(self._worker_loop(), name=f"heuristic_worker_{i}")
                    self._worker_tasks.append(task)
                logger.info("Started 50 heuristic background workers.")
            except RuntimeError:
                pass # No running loop yet

    def stop(self):
        for task in self._worker_tasks:
            if not task.done():
                task.cancel()
        self._worker_tasks.clear()
        logger.info("Heuristic background workers stopped.")

    def submit(self, ip: str, now: float, classification, tokens_left: float, decision: str, endpoint: str, latency_ms: float):
        if not self._worker_tasks:
            self.start()
        last = self._last_eval.get(ip, 0.0)
        if now - last >= self._eval_interval:
            self._last_eval[ip] = now
            try:
                self._queue.put_nowait((ip, now, classification, tokens_left, decision, endpoint, latency_ms))
            except asyncio.QueueFull:
                self._fallback_lightweight(ip, now, classification, latency_ms, decision)
        else:
            self._fallback_lightweight(ip, now, classification, latency_ms, decision)

    def _fallback_lightweight(self, ip: str, now: float, classification, latency_ms: float, decision: str):
        asyncio.create_task(
            self._limiter._update_blocked_metrics(ip, now, classification, latency_ms, decision=decision),
            name=f"lightweight:{ip}"
        )

    async def _worker_loop(self):
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
