"""
websocket_handler.py
=====================
Socket.IO real-time event handler for the dashboard.

Emits 'metrics_update' every 2 seconds with a payload that matches
the exact shape App.tsx expects:

  socket.on("metrics_update", (data: {
    timestamp: string,
    summary: SystemSummary,
    recent_events: LiveEvent[]
  }) => { ... })

Field names here must match types/index.ts exactly.
"""

import asyncio
import logging
import time
import random
from middleware import AdaptiveRateLimiter
from heuristic_engine import TrafficType

logger = logging.getLogger("websocket")


# =============================================================================
# Simulation profiles
# =============================================================================

SIMULATION_PROFILES = {
    "normal": {
        "ips":           [f"192.168.1.{i}" for i in range(10, 15)],
        "req_per_cycle": (1, 3),
        "interval":      (0.15, 0.5),
    },
    "bursty": {
        "ips":           [f"10.0.3.{i}" for i in range(20, 25)],
        "req_per_cycle": (5, 12),
        "interval":      (0.05, 0.12),
    },
    "suspicious": {
        "ips":           [f"203.0.113.{i}" for i in range(30, 35)],
        "req_per_cycle": (15, 25),
        "interval":      (0.025, 0.032),
    },
}


def register_socketio_events(sio, limiter: AdaptiveRateLimiter):
    """
    Registers all Socket.IO event handlers.
    Called once from main.py with the shared limiter instance.
    """

    simulation_running = {"active": False}
    broadcast_started  = {"done": False}

    # ── Connection lifecycle ──────────────────────────────────────────────────

    @sio.event
    async def connect(sid, environ):
        print(f"[WebSocket] Client connected: {sid}")
        # Start broadcast loop on first connection
        if not broadcast_started["done"]:
            broadcast_started["done"] = True
            asyncio.create_task(broadcast_metrics())
        # Immediate snapshot so dashboard populates instantly
        snapshot = await _build_metrics_payload(limiter)   
        await sio.emit("metrics_update", snapshot, to=sid)

    @sio.event
    async def disconnect(sid):
        print(f"[WebSocket] Client disconnected: {sid}")

    # ── Snapshot on demand ────────────────────────────────────────────────────

    @sio.event
    async def get_snapshot(sid, data=None):
        snapshot = await _build_metrics_payload(limiter)      
        await sio.emit("metrics_update", snapshot, to=sid)

    # ── Simulation control ────────────────────────────────────────────────────

    @sio.event
    async def start_simulation(sid, data=None):
        if simulation_running["active"]:
            await sio.emit("simulation_status", {"status": "already_running"}, to=sid)
            return
        simulation_running["active"] = True
        await sio.emit("simulation_status", {"status": "started"}, to=sid)
        logger.info("[Simulation] Started")
        asyncio.create_task(
            _run_simulation(sio, limiter, simulation_running),
            name="simulation",
        )

    @sio.event
    async def stop_simulation(sid, data=None):
        simulation_running["active"] = False
        await sio.emit("simulation_status", {"status": "stopped"}, to=sid)
        logger.info("[Simulation] Stopped")

    # ── Background metrics broadcast ──────────────────────────────────────────

    async def broadcast_metrics():
        """Push metrics_update to all connected clients every 3 seconds."""
        while True:
            await asyncio.sleep(3)
            try:
                payload = await _build_metrics_payload(limiter) # ← await added
                await sio.emit("metrics_update", payload)
            except Exception:
                logger.exception("[WebSocket] Broadcast error")


# =============================================================================
# Payload builder — must match App.tsx socket.on shape exactly
# =============================================================================

async def _build_metrics_payload(limiter: AdaptiveRateLimiter) -> dict:
    now = time.time()

    metrics, log_entries = await asyncio.gather(
        limiter.get_metrics(),
        limiter.get_log(),
    )

    # ── Classification breakdown ──────────────────────────────────────────
    cc = metrics.pop("class_counts", {})
    classifications = {
        "normal":     cc.get("normal",     0),
        "bursty":     cc.get("bursty",     0),
        "suspicious": cc.get("suspicious", 0),
        "blocked":    cc.get("blocked",    0),
    }

    active_clients = metrics.get("unique_clients", 0)
    total_accepted = metrics.get("total_admitted", 0)
    total_rejected = metrics.get("total_blocked",  0)

    # ── recent_events — shaped exactly for App.tsx LiveEvent interface ────
    recent_events = []
    for entry in log_entries[:20]:
        bucket  = entry.get("bucket", {})
        markers = entry.get("markers", {})
        cap     = bucket.get("capacity", 40)
        tokens  = bucket.get("current_tokens", cap)
        lam     = markers.get("lambda", 0.0)

        recent_events.append({
            "client_id":        entry.get("ip", "unknown"),
            "request_rate_min": round(lam * 60, 2),            
            "interval_jitter":  markers.get("sigma", None),
            "burst_count":       round(markers.get("burst_freq",   0.0), 1),
            "burst_persistence": round(markers.get("persistence",  0.0), 1),
            "bucket_fill":      round((tokens / cap * 100) if cap > 0 else 0, 1),
            "refill_rate":      bucket.get("refill_rate", 10.0),
            "bucket_capacity":  cap,
            "tokens_remaining": tokens,
            "retry_after":      bucket.get("seconds_until_token", 0),
            "allowed":          entry.get("decision", "ADMITTED") == "ADMITTED",
            "classification":   entry.get("classification", "normal"),
            "justification":    entry.get("justification", ""),
        })

    return {
        "timestamp": str(int(now * 1000)),
        "summary": {
            "active_clients":  active_clients,
            "total_accepted":  total_accepted,
            "total_rejected":  total_rejected,
            "total_requests":  metrics.get("total_requests", 0),
            "rar_percent":     round(metrics.get("rar", 1.0) * 100, 2),
            "fpr_percent":     round(metrics.get("fpr", 0.0) * 100, 2),
            "fnr_percent":     round(metrics.get("fnr", 0.0) * 100, 2),
            "avg_latency_ms":  metrics.get("avg_latency_ms", 0.0),
            "p95_latency_ms":  metrics.get("p95_latency_ms", 0.0),
            "classifications": classifications,
            "throughput":      0.0,
        },
        "recent_events": recent_events,
    }


# =============================================================================
# Simulation background task
# =============================================================================

async def _run_simulation(sio, limiter: AdaptiveRateLimiter, simulation_running: dict):
    """
    Continuously sends simulated traffic through the rate limiter.
    Each profile uses distinct IP ranges so the classifier sees
    genuinely different traffic patterns per class.
    """
    while simulation_running["active"]:
        for profile_name, profile in SIMULATION_PROFILES.items():
            if not simulation_running["active"]:
                break
            ip    = random.choice(profile["ips"])
            n_req = random.randint(*profile["req_per_cycle"])
            for _ in range(n_req):
                if not simulation_running["active"]:
                    break
                try:
                    await limiter.process_request(            
                        ip       = ip,
                        endpoint = "/api/data",
                        method   = "GET",
                    )
                except Exception:
                    logger.exception("[Simulation] process_request failed for ip=%s", ip)
                await asyncio.sleep(random.uniform(*profile["interval"]))