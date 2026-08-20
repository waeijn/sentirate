"""
mock_backend.py
================
Mock API Host / Server
Architecture Diagram: «API Host / Server» (Internal)

This is the protected backend that the middleware forwards admitted requests to.
For the CLI demo and prototype phase, this is a lightweight stub that always
returns HTTP 200 with a mock response.

In Phase 2 (evaluation), this is replaced by a real application server.
The middleware code requires NO changes — only the BACKEND_URL in middleware.py
needs to be updated to point at the real server.

Run on: port 8000
  uvicorn mock_backend:app --port 8000
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time

app = FastAPI(title="Mock Backend API — Protected Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message":   "Request reached the protected backend successfully.",
        "server":    "Mock API Host",
        "timestamp": time.time(),
        "status":    "ok",
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(path: str, request: Request):
    """
    Catches all forwarded requests from the middleware.
    Architecture Diagram: Forwarded Request → API Host/Server
    """
    return {
        "message":        f"Forwarded request to /{path} processed successfully.",
        "method":         request.method,
        "path":           f"/{path}",
        "forwarded_from": "Adaptive API Rate Limiting Middleware",
        "timestamp":      time.time(),
        "status":         "ok",
    }


@app.get("/internal/health")
async def health():
    return {"status": "online", "service": "Mock Backend API"}