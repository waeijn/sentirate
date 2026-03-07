"""
WebSocket handler + traffic simulator
Aligned to SRS FR-1.5.2 (dashboard), FR-1.2.2/3/4 (traffic patterns)
"""
import asyncio
import random
import time
from datetime import datetime
from heuristic_engine import RateLimiterEngine

engine    = RateLimiterEngine()
sim_state = {"running": False, "scenario": "mixed", "task": None}


def make_id(prefix: str, n: int) -> str:
    return f"{prefix}_{n:03d}"


async def simulate_traffic(sio, scenario: str, users: int):
    """
    Simulate per SRS FR-1.2.2/3/4 behavioral profiles:

    normal     → 5-50 req/min, σ > 0.5s jitter, ≤2 bursts/5min
    bursty     → 50-200 req/min, σ > 0.3s jitter, 3-10 bursts
    suspicious → >200 req/min sustained, σ < 0.1s (robotic)
    """
    pools = {
        "normal":     [make_id("normal",     i) for i in range(max(1, users))],
        "bursty":     [make_id("bursty",     i) for i in range(max(1, users // 3))],
        "suspicious": [make_id("suspicious", i) for i in range(max(1, users // 5))],
    }

    active = (
        {"normal":     pools["normal"]}     if scenario == "normal"     else
        {"bursty":     pools["bursty"]}     if scenario == "bursty"     else
        {"suspicious": pools["suspicious"]} if scenario == "suspicious" else
        pools
    )

    while sim_state["running"]:
        events     = []
        tick_start = time.time()

        for pool_type, pool in active.items():
            client_id = random.choice(pool)

            if pool_type == "normal":
                # FR-1.2.2: 5-50 req/min → ~0.1-0.8 req/s
                # σ > 0.5s — very irregular human timing
                count = random.randint(1, 4)
                for _ in range(count):
                    is_error = random.random() < 0.05  # <10% error rate
                    result   = engine.process_request(client_id, is_error=is_error)
                    events.append(result)
                    await asyncio.sleep(random.uniform(0.3, 1.5))  # high jitter

            elif pool_type == "bursty":
                # FR-1.2.3: 50-200 req/min, σ > 0.3s, burst 3-10 times
                count = random.randint(5, 15)
                for _ in range(count):
                    is_error = random.random() < 0.10  # <15% error rate
                    result   = engine.process_request(client_id, is_error=is_error)
                    events.append(result)
                    await asyncio.sleep(random.uniform(0.03, 0.12))  # moderate jitter

            elif pool_type == "suspicious":
                # FR-1.2.4: >200 req/min, σ < 0.1s (robotic), sustained
                count = random.randint(20, 40)
                for _ in range(count):
                    is_error = random.random() < 0.50  # high error rate
                    result   = engine.process_request(client_id, is_error=is_error)
                    events.append(result)
                    await asyncio.sleep(0.008)  # 8ms fixed = very regular = bot

        # SRS FR-1.5.2: emit every ~5 seconds (paced by tick)
        summary = engine.get_summary()
        await sio.emit("metrics_update", {
            "timestamp":     datetime.now().isoformat(),
            "summary":       summary,
            "recent_events": events[-30:],
        })

        elapsed = time.time() - tick_start
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)


def register_socketio_events(sio):

    @sio.event
    async def connect(sid, environ):
        print(f"[WS] Connected: {sid}")
        await sio.emit("connection_status", {
            "status":  "connected",
            "message": "Connected to Adaptive Rate Limiter Dashboard"
        }, to=sid)

    @sio.event
    async def disconnect(sid):
        print(f"[WS] Disconnected: {sid}")

    @sio.event
    async def start_simulation(sid, data):
        scenario = data.get("scenario", "mixed")
        users    = int(data.get("users", 10))

        if sim_state["running"]:
            await sio.emit("simulation_status", {"status": "already_running"}, to=sid)
            return

        engine.clients.clear()
        sim_state["running"]  = True
        sim_state["scenario"] = scenario
        sim_state["task"]     = asyncio.create_task(
            simulate_traffic(sio, scenario, users)
        )
        await sio.emit("simulation_status", {
            "status": "started", "scenario": scenario, "users": users,
        })
        print(f"[SIM] Started — scenario={scenario}, users={users}")

    @sio.event
    async def stop_simulation(sid, data=None):
        if sim_state["task"]:
            sim_state["task"].cancel()
            sim_state["task"] = None
        sim_state["running"] = False
        await sio.emit("simulation_status", {"status": "stopped"})
        print("[SIM] Stopped")

    @sio.event
    async def get_snapshot(sid, data=None):
        summary = engine.get_summary()
        await sio.emit("metrics_update", {
            "timestamp":     datetime.now().isoformat(),
            "summary":       summary,
            "recent_events": [],
        }, to=sid)