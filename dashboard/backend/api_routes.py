"""
API Routes — aligned to SRS FR-1.4.2, FR-1.5.2, FR-1.5.3
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from websocket_handler import engine

router = APIRouter()


class SimulationRequest(BaseModel):
    scenario: str
    duration: int
    users:    int

class ConfigUpdate(BaseModel):
    normal_rate_max:    float = 50
    bursty_rate_max:    float = 200
    suspicious_jitter:  float = 0.1
    normal_capacity:    int   = 200
    normal_refill:      int   = 100
    bursty_capacity:    int   = 500
    bursty_refill:      int   = 200
    suspicious_capacity: int  = 50
    suspicious_refill:  int   = 20


# ─── Health ───────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "healthy"}


# ─── Metrics (FR-1.5.2) ───────────────────────────────────────────────────────

@router.get("/metrics")
async def get_metrics():
    return engine.get_summary()


# ─── Clients (FR-1.5.2: Top 10 table) ────────────────────────────────────────

@router.get("/clients")
async def get_clients():
    clients = []
    for state in engine.clients.values():
        clients.append({
            "client_id":      state.client_id,
            "classification": state.classification,
            "rate_per_min":   round(state.request_rate_per_min, 1),
            "jitter":         round(state.interval_jitter, 3) if state.interval_jitter < 999 else None,
            "error_rate":     round(state.error_rate * 100, 1),
            "burst_count":    state.burst_count,
            "bucket_fill":    state.bucket.fill_percentage,
            "tokens":         state.bucket.tokens_remaining,
            "total_accepted": state.total_accepted,
            "total_rejected": state.total_rejected,
        })
    return {"clients": clients}


# ─── Single request (FR-1.4.1/1.4.2) ─────────────────────────────────────────

@router.post("/request/{client_id}")
async def process_request(client_id: str):
    result = engine.process_request(client_id)
    if not result["allowed"]:
        # FR-1.4.2: HTTP 429 with standard headers
        return JSONResponse(
            status_code=429,
            headers={
                "X-RateLimit-Limit":     str(result["refill_rate"]),
                "X-RateLimit-Remaining": str(result["tokens_remaining"]),
                "Retry-After":           str(result["retry_after"]),
            },
            content={
                "error":                "Rate limit exceeded",
                "classification":       result["classification"],
                "retry_after_seconds":  result["retry_after"],
                "current_rate_limit":   f"{result['refill_rate']} requests/minute",
            }
        )
    return result


# ─── Config (FR-1.5.3) ────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    return {
        "normal":     {"rate_max_per_min": 50,  "capacity": 200, "refill_per_min": 100},
        "bursty":     {"rate_max_per_min": 200, "capacity": 500, "refill_per_min": 200},
        "suspicious": {"rate_max_per_min": 999, "capacity": 50,  "refill_per_min": 20},
        "thresholds": {
            "jitter_suspicious_max": 0.1,
            "jitter_bursty_min":     0.3,
            "jitter_normal_min":     0.5,
            "error_rate_suspicious": 0.40,
            "burst_persist_suspicious": 60,
            "suspicious_cooldown_secs": 120,
        }
    }

@router.put("/config")
async def update_config(config: ConfigUpdate):
    return {"status": "updated", "config": config.model_dump(),
            "note": "Restart server to apply threshold changes"}


# ─── Logs / Justification export (FR-1.5.3) ──────────────────────────────────

@router.get("/logs/justifications")
async def get_justifications():
    logs = []
    for state in engine.clients.values():
        logs.append({
            "client_id":      state.client_id,
            "classification": state.classification,
            "history":        list(state.classification_history),
            "rate_per_min":   round(state.request_rate_per_min, 1),
            "jitter":         round(state.interval_jitter, 3) if state.interval_jitter < 999 else None,
            "error_rate":     round(state.error_rate * 100, 1),
        })
    return {"justifications": logs}


# ─── Reset ────────────────────────────────────────────────────────────────────

@router.delete("/clients")
async def reset_clients():
    engine.clients.clear()
    return {"status": "reset"}