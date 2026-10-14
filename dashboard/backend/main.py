"""
main.py
========
Application entry point — Redis-backed version.

What changed from the original:
  1. lifespan() replaces bare module-level startup code.
     Redis is initialised here before any request is served.
  2. Socket.IO uses AsyncRedisManager so events work correctly
     across all Uvicorn workers (--workers 4).
  3. shared_limiter = AdaptiveRateLimiter(sio=sio) — no longer takes
     zero args; receives sio for real-time dashboard events.
  4. All print() calls removed — logging handles output.

Launch commands:
  Development  : uvicorn main:socket_app --reload --host 0.0.0.0 --port 8050
  Defense demo : uvicorn main:socket_app --workers 4 --host 0.0.0.0 --port 8050
"""

import logging
import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import core.redis_client as rc
from core.middleware import AdaptiveRateLimiter

load_dotenv()

logger = logging.getLogger("main")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# =============================================================================
# Step 1 — Socket.IO server
# =============================================================================
# AsyncRedisManager routes all pub/sub through Redis so events emitted
# by worker A reach clients connected to worker B.
# Requires:  pip install "python-socketio[asyncio_client]" aiohttp
#
# If those packages are not yet installed, the except block falls back
# to the default in-memory manager (fine for --workers 1 development).
# =============================================================================

sio = socketio.AsyncServer(
    async_mode           = "asgi",
    client_manager       = socketio.AsyncRedisManager(REDIS_URL),
    cors_allowed_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://localhost:5173,http://localhost:5174,https://localhost:5174",
    ).split(","),
    logger               = False,
    engineio_logger      = False,
)
# =============================================================================
# Step 2 — Shared AdaptiveRateLimiter instance
# =============================================================================
# Created here at module level — same singleton pattern as the original.
# Redis is injected lazily via the redis_client module property inside
# the class, so constructing it before lifespan() runs is safe.
# =============================================================================

shared_limiter = AdaptiveRateLimiter(sio=sio)

# =============================================================================
# Step 3 — Lifespan (startup + shutdown)
# =============================================================================
# FastAPI calls this before the first request and after the last.
# Redis MUST be initialised here so shared_limiter._redis resolves
# correctly when the first request arrives.
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — connecting to Redis at %s", REDIS_URL)
    await rc.initialise(REDIS_URL)  
    logger.info("Redis ready.")
    await shared_limiter.init_runtime_config()
    shared_limiter.start_background()
    yield
    shared_limiter.stop_background()
    logger.info("Shutting down — closing Redis connection pool.")
    await rc.close()

# =============================================================================
# Step 4 — FastAPI app
# =============================================================================

app = FastAPI(
    title       = "Adaptive API Rate Limiting Middleware",
    description = "Heuristic Pattern Classification + Token Bucket Optimization",
    version     = "2.0.0",
    lifespan    = lifespan,
)

# CORS — allows the React dashboard (port 5173) to call this backend (port 8050)
app.add_middleware(
    CORSMiddleware,
    allow_origins     = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://localhost:5173,http://localhost:5174,https://localhost:5174",
    ).split(","),
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# =============================================================================
# Step 5 — Register routes and Socket.IO events
# =============================================================================
# Same pattern as the original — both modules receive shared_limiter.
# =============================================================================

from api.routes import create_router
from api.websocket import register_socketio_events

app.include_router(
    create_router(shared_limiter),
    prefix = "/api",
    tags   = ["Rate Limiter API"],
)

register_socketio_events(sio, shared_limiter)

# =============================================================================
# Step 6 — Root routes
# =============================================================================

@app.get("/")
async def root():
    use_https = os.getenv("USE_HTTPS", "false").lower() in ("true", "1", "yes")
    proto = "https" if use_https else "http"
    return {
        "service":   "Adaptive API Rate Limiting Middleware",
        "version":   "2.0.0",
        "status":    "online",
        "protocol":  proto.upper(),
        "dashboard": os.getenv("CORS_ORIGINS", f"{proto}://localhost:5173"),
        "backend":   os.getenv("CORE_API_URL",  "http://localhost:8000"),
        "docs":      "/docs",
    }

@app.get("/health")
async def health():
    redis = rc.get_redis()
    pong  = await redis.ping()
    return {
        "status":  "healthy",
        "service": "middleware",
        "redis":   pong,
    }

# =============================================================================
# Step 7 — ASGI app (FastAPI wrapped inside Socket.IO)
# =============================================================================

socket_app = socketio.ASGIApp(sio, app)

# =============================================================================
# Step 8 — Entry point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    host    = os.getenv("DASHBOARD_HOST", "localhost")
    port    = int(os.getenv("DASHBOARD_PORT", 8050))
    workers = int(os.getenv("WORKERS", 10))

    use_https = os.getenv("USE_HTTPS", "false").lower() in ("true", "1", "yes")
    ssl_kwargs = {}

    if use_https:
        backend_dir  = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(backend_dir))
        default_cert = os.path.join(project_root, "certs", "cert.pem")
        default_key  = os.path.join(project_root, "certs", "key.pem")

        cert_file = os.getenv("SSL_CERTFILE", default_cert)
        key_file  = os.getenv("SSL_KEYFILE", default_key)

        if os.path.exists(cert_file) and os.path.exists(key_file):
            logger.info("HTTPS enabled — using SSL cert: %s", cert_file)
            ssl_kwargs = {
                "ssl_certfile": cert_file,
                "ssl_keyfile":  key_file,
            }
        else:
            logger.warning(
                "USE_HTTPS is true but certificates were not found at %s / %s. Falling back to HTTP.",
                cert_file, key_file,
            )
    else:
        logger.info("HTTP enabled (USE_HTTPS=false).")

    uvicorn.run(
        "main:socket_app",
        host      = host,
        port      = port,
        workers   = workers,
        reload    = False,
        log_level = os.getenv("LOG_LEVEL", "warning").lower(),
        **ssl_kwargs,
    )