"""
api_routes.py
==============
REST API endpoints for the Adaptive API Rate Limiting Middleware.

All routes use the shared AdaptiveRateLimiter instance passed in from main.py.
This ensures every request processed here updates the SAME client hash map
that websocket_handler.py reads when emitting dashboard metrics.

Endpoints:
  GET  /api/health                → system health check
  GET  /api/metrics               → RAR, FPR, FNR + client counts
  GET  /api/clients               → all active TrafficMonitor states
  POST /api/request/{client_ip}   → process one request through full pipeline
  GET  /api/config                → current threshold + profile configuration
  GET  /api/logs                  → full enforcement log
  DELETE /api/clients             → reset all client state (for demo resets)

Why create_router(shared_limiter) instead of a global engine?
  The router is created as a function that receives the shared limiter.
  This is called dependency injection — the router doesn't create its own
  limiter, it uses the one given to it by main.py. This guarantees
  api_routes and websocket_handler operate on identical state.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from middleware import AdaptiveRateLimiter
import heuristic_engine
from heuristic_engine import (
    TrafficType,
    PROFILES,
    NORMAL_RATE_MAX,
    BURSTY_RATE_MAX,
    SUSPICIOUS_SIGMA,
    SUSPICIOUS_BURST,
    SUSPICIOUS_PERSIST,
    BURSTY_BURST_MIN,
    BURSTY_PERSIST_MIN,
)


# =============================================================================
# Request/Response Models (Pydantic)
# Pydantic validates incoming JSON bodies automatically —
# if a required field is missing or the wrong type, FastAPI returns HTTP 422
# =============================================================================

class ConfigUpdate(BaseModel):
    """
    Body model for PUT /api/config.
    Values here map directly to Chapter 3 Table 2 and Table 3 thresholds.
    Note: token values are not finalized per thesis — these are defaults.
    """
    normal_rate_max:      float = NORMAL_RATE_MAX
    bursty_rate_max:      float = BURSTY_RATE_MAX
    suspicious_sigma:     float = SUSPICIOUS_SIGMA
    normal_refill:        float = PROFILES[TrafficType.NORMAL]["refill_rate"]
    normal_capacity:      float = PROFILES[TrafficType.NORMAL]["capacity"]
    bursty_refill:        float = PROFILES[TrafficType.BURSTY_LEGITIMATE]["refill_rate"]
    bursty_capacity:      float = PROFILES[TrafficType.BURSTY_LEGITIMATE]["capacity"]
    suspicious_refill:    float = PROFILES[TrafficType.SUSPICIOUS_ABUSIVE]["refill_rate"]
    suspicious_capacity:  float = PROFILES[TrafficType.SUSPICIOUS_ABUSIVE]["capacity"]


# =============================================================================
# Router factory — receives shared_limiter from main.py
# =============================================================================

def create_router(limiter: AdaptiveRateLimiter) -> APIRouter:
    router = APIRouter()
    """
    Creates and returns the API router with all endpoints wired to
    the shared AdaptiveRateLimiter instance.

    Called once in main.py:
        app.include_router(create_router(shared_limiter), prefix="/api")
    """
    

    # ── Health ────────────────────────────────────────────────────────────────

    @router.get("/health")
    async def health():
        return {
            "status":  "healthy",
            "service": "Adaptive API Rate Limiting Middleware",
        }

    # ── Metrics (Chapter 3 Objective Function: RAR, FPR, FNR) ────────────────

    @router.get("/metrics")
    async def get_metrics():
        metrics = await limiter.get_metrics()   
        classifications = {
            "normal":     metrics.pop("normal_total",     0),
            "bursty":     metrics.pop("bursty_total",     0),
            "suspicious": metrics.pop("suspicious_total", 0),
            "blocked":    metrics.pop("blocked_total",    0),
        }
        active_clients = sum(classifications.values())

        return {
            **metrics,
            "active_clients":  active_clients,
            "classifications": classifications,
        }

    # ── Active Clients (TrafficMonitor states) ────────────────────────────────

    @router.get("/clients")
    async def get_clients():
        """
        Returns the current state of all active client IPs.
        Used by the dashboard Traffic Logs page.
        """
        clients = await limiter.get_all_clients()              # ← replaces limiter.system + limiter._buckets
 
        return {"clients": clients, "total": len(clients)}

    # ── Process Request (full 8-step pipeline) ────────────────────────────────

    @router.post("/request/{client_ip}")
    async def process_request(client_ip: str, endpoint: str = "/api/data"):
        """
        Runs one request through the full rate-limiting pipeline.
        Returns HTTP 200 if admitted, HTTP 429 if blocked.
        This is the endpoint Locust hits during the stress test.
        """
        result = await limiter.process_request(               # ← await + renamed
            ip       = client_ip,
            endpoint = endpoint,
            method   = "POST",
        )
 
        if result["decision"] == "BLOCKED":
            return JSONResponse(
                status_code = 429,
                headers     = {
                    "Retry-After":           str(result["bucket"]["seconds_until_token"]),
                    "X-RateLimit-Class":     result["traffic_type"],
                    "X-RateLimit-Remaining": str(result["bucket"]["current_tokens"]),
                },
                content = {
                    "error":          "Rate limit exceeded",
                    "decision":       "BLOCKED",
                    "classification": result["traffic_type"],
                    "justification":  result["justification"],
                    "retry_after":    result["bucket"]["seconds_until_token"],
                    "markers":        result["markers"],
                    "bucket":         result["bucket"],
                },
            )
 
        return {
            "decision":       "ADMITTED",
            "classification": result["traffic_type"],
            "justification":  result["justification"],
            "markers":        result["markers"],
            "bucket":         result["bucket"],
            "risk_score":     result["risk_score"],
            "monitor_totals": result["monitor_totals"],
        }

    # ── Raw Baseline Benchmarking ─────────────────────────────────────────────

    @router.post("/raw_request/{client_ip}")
    async def process_raw_request(client_ip: str):
        """
        RAW BASELINE MODE: Middleware completely bypassed.
        Always returns HTTP 200 immediately to measure absolute maximum server throughput.
        Used ONLY by the Baseline Testing locust profile.
        """
        return {
            "decision":       "ADMITTED",
            "classification": "raw_baseline",
            "justification":  "Rate limiter bypassed for benchmarking",
            "markers":        {},
            "bucket":         {},
            "risk_score":     0.0,
            "monitor_totals": {},
        }

    # ── Configuration (Chapter 3 Table 2 + Table 3 values) ───────────────────

    @router.get("/config")
    async def get_config():
        """
        Returns the current threshold and token bucket profile configuration.
        """
        import middleware
        return {
            "thresholds": {
                "normal_rate_max":    middleware.NORMAL_RATE_MAX,
                "bursty_rate_max":    30.0, # deprecated
                "suspicious_sigma":   middleware.SUSPICIOUS_SIGMA,
                "suspicious_burst":   middleware.SUSPICIOUS_BURST,
                "suspicious_persist": middleware.SUSPICIOUS_PERSIST,
                "bursty_burst_min":   middleware.BURSTY_BURST_MIN,
                "bursty_persist_min": middleware.BURSTY_PERSIST_MIN,
            },
            "profiles": {
                "normal": {"capacity": middleware.BUCKET_PROFILES["normal"][0], "refill_rate": middleware.BUCKET_PROFILES["normal"][1]},
                "bursty_legitimate": {"capacity": middleware.BUCKET_PROFILES["bursty"][0], "refill_rate": middleware.BUCKET_PROFILES["bursty"][1]},
                "suspicious_abusive": {"capacity": middleware.BUCKET_PROFILES["suspicious"][0], "refill_rate": middleware.BUCKET_PROFILES["suspicious"][1]},
            },
            "note": "Token bucket values are configurable defaults per thesis evaluation phase.",
        }

    @router.put("/config")
    async def update_config(config: ConfigUpdate):
        """
        Dynamically applies updated thresholds and token bucket profiles.
        """
        import middleware
        
        if not (config.suspicious_refill < config.normal_refill < config.bursty_refill):
            return JSONResponse(
                status_code = 422,
                content     = {"error": "Constraint 4 violated: suspicious_refill < normal_refill < bursty_refill"},
            )
        if not (config.suspicious_capacity < config.normal_capacity < config.bursty_capacity):
            return JSONResponse(
                status_code = 422,
                content     = {"error": "Constraint 5 violated: suspicious_capacity < normal_capacity < bursty_capacity"},
            )
 
        middleware.NORMAL_RATE_MAX  = config.normal_rate_max
        middleware.SUSPICIOUS_SIGMA = config.suspicious_sigma
 
        middleware.BUCKET_PROFILES["normal"]     = (config.normal_capacity, config.normal_refill)
        middleware.BUCKET_PROFILES["bursty"]     = (config.bursty_capacity, config.bursty_refill)
        middleware.BUCKET_PROFILES["suspicious"] = (config.suspicious_capacity, config.suspicious_refill)
 
        return {
            "status":  "applied",
            "message": "Configuration updated — changes are active immediately.",
            "config":  config.model_dump(),
        }
    
    # ── Enforcement Log ───────────────────────────────────────────────────────

    @router.get("/logs")
    async def get_logs():
        """
        Returns all enforcement log entries (newest first, max 1000).
        Used by the Traffic Logs page.
        """
        entries = await limiter.get_log()                      # ← await added
        return {
            "entries": entries,
            "total":   len(entries),
        }

    # ── Reset (for demo resets between use cases) ─────────────────────────────

    @router.delete("/clients")
    async def reset_clients():
        """
        Clears all client state, buckets, metrics, and logs from Redis.
        Use between demo use cases. Resets all RAR/FPR/FNR metrics to zero.
        """
        await limiter.reset_all()                              # ← replaces 3 .clear() calls
        return {
            "status":  "reset",
            "message": "All client states, buckets, and logs cleared.",
        }
 
    return router