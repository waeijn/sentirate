"""
redis_client.py — Async Redis singleton for the Adaptive Rate Limiter.

Centralises connection creation so middleware, routes, and Socket.IO
can all share one connection pool without passing the client object
through every constructor.

Usage:
    # In main.py lifespan startup:
    await redis_client.initialise("redis://localhost:6379/0")

    # Anywhere else:
    from redis_client import get_redis
    redis = get_redis()
    await redis.get("some-key")
"""

from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool

logger = logging.getLogger("redis_client")

# Module-level singleton — one pool shared across all workers in a process.
_pool: Optional[ConnectionPool] = None
_client: Optional[aioredis.Redis] = None


async def initialise(url: str = "redis://localhost:6379/0") -> aioredis.Redis:
    global _client
    _client = aioredis.from_url(
        url,
        max_connections       = 500,
        socket_connect_timeout = 2.0,
        socket_timeout         = 1.0,
        retry_on_timeout       = True,
        decode_responses       = True,
    )
    pong = await _client.ping()
    if not pong:
        raise ConnectionError("Redis ping failed — is the container running?")
    logger.info("Redis connected at %s", url)
    return _client
 
 
def get_redis() -> aioredis.Redis:
    if _client is None:
        raise RuntimeError("Redis not initialised — call await initialise() first.")
    return _client
 
 
async def close() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None
        logger.info("Redis connection closed.")