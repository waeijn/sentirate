import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dashboard", "backend")))

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from dashboard.backend.core import middleware
from dashboard.backend.core.middleware import AdaptiveRateLimiter, TrafficClass
from dashboard.backend.api.routes import create_router, ConfigUpdate


@pytest.fixture
def limiter_with_mock_redis():
    limiter = AdaptiveRateLimiter()
    mock_redis = AsyncMock()
    mock_redis.hgetall = AsyncMock(return_value={})
    mock_redis.hset = AsyncMock(return_value=True)
    mock_redis.evalsha = AsyncMock()
    mock_redis.script_load = AsyncMock(return_value="mock_sha")

    # Patch the _redis property
    with patch.object(AdaptiveRateLimiter, "_redis", new=mock_redis):
        yield limiter, mock_redis


import httpx

@pytest.mark.asyncio
async def test_get_config_endpoint(limiter_with_mock_redis):
    limiter, _ = limiter_with_mock_redis
    app = FastAPI()
    app.include_router(create_router(limiter), prefix="/api")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/config")
        assert response.status_code == 200
        data = response.json()

        assert "thresholds" in data
        assert "profiles" in data
        assert data["thresholds"]["normal_rate_max"] == middleware.NORMAL_RATE_MAX
        assert data["thresholds"]["bursty_rate_max"] == middleware.LAMBDA_BURSTY_MAX
        assert data["thresholds"]["suspicious_sigma"] == middleware.SUSPICIOUS_SIGMA

        # Verify both standard and legacy alias keys are present
        assert "normal" in data["profiles"]
        assert "bursty" in data["profiles"]
        assert "suspicious" in data["profiles"]
        assert "bursty_legitimate" in data["profiles"]
        assert "suspicious_abusive" in data["profiles"]


@pytest.mark.asyncio
async def test_update_config_constraints_validation(limiter_with_mock_redis):
    limiter, _ = limiter_with_mock_redis
    app = FastAPI()
    app.include_router(create_router(limiter), prefix="/api")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Test Constraint 4 violation: suspicious_refill >= normal_refill
        invalid_refill_payload = {
            "normal_rate_max": 10.0,
            "bursty_rate_max": 30.0,
            "suspicious_sigma": 0.1,
            "normal_refill": 10.0,
            "normal_capacity": 20.0,
            "bursty_refill": 20.0,
            "bursty_capacity": 40.0,
            "suspicious_refill": 15.0,  # Invalid: 15 > 10
            "suspicious_capacity": 5.0,
        }
        res = await client.put("/api/config", json=invalid_refill_payload)
        assert res.status_code == 422
        assert "Constraint 4" in res.json()["error"]

        # Test Constraint 5 violation: suspicious_capacity >= normal_capacity
        invalid_cap_payload = {
            "normal_rate_max": 10.0,
            "bursty_rate_max": 30.0,
            "suspicious_sigma": 0.1,
            "normal_refill": 10.0,
            "normal_capacity": 20.0,
            "bursty_refill": 20.0,
            "bursty_capacity": 40.0,
            "suspicious_refill": 2.0,
            "suspicious_capacity": 25.0,  # Invalid: 25 > 20
        }
        res = await client.put("/api/config", json=invalid_cap_payload)
        assert res.status_code == 422
        assert "Constraint 5" in res.json()["error"]


@pytest.mark.asyncio
async def test_update_runtime_config_syncs_redis_and_globals(limiter_with_mock_redis):
    limiter, mock_redis = limiter_with_mock_redis

    result = await limiter.update_runtime_config(
        normal_rate_max=12.0,
        bursty_rate_max=45.0,
        suspicious_sigma=0.08,
        normal_capacity=25.0,
        normal_refill=12.0,
        bursty_capacity=55.0,
        bursty_refill=28.0,
        suspicious_capacity=4.0,
        suspicious_refill=1.5,
    )

    # Check globals were updated
    assert middleware.NORMAL_RATE_MAX == 12.0
    assert middleware.LAMBDA_BURSTY_MAX == 45.0
    assert middleware.SUSPICIOUS_SIGMA == 0.08
    assert middleware.BUCKET_PROFILES["normal"] == (25.0, 12.0)
    assert middleware.BUCKET_PROFILES["bursty"] == (55.0, 28.0)
    assert middleware.BUCKET_PROFILES["suspicious"] == (4.0, 1.5)

    # Check Redis hash was written
    mock_redis.hset.assert_called_once()
    call_args = mock_redis.hset.call_args
    assert call_args[0][0] == f"{middleware.REDIS_NS}:_config"
    mapping = call_args[1]["mapping"]
    assert mapping["normal:cap"] == "25.0"
    assert mapping["normal:refill"] == "12.0"
    assert mapping["bursty:cap"] == "55.0"
    assert mapping["bursty:refill"] == "28.0"
    assert mapping["suspicious:cap"] == "4.0"
    assert mapping["suspicious:refill"] == "1.5"
    assert mapping["normal_rate_max"] == "12.0"
    assert mapping["bursty_rate_max"] == "45.0"
    assert mapping["suspicious_sigma"] == "0.08"


@pytest.mark.asyncio
async def test_init_runtime_config_restores_from_redis(limiter_with_mock_redis):
    limiter, mock_redis = limiter_with_mock_redis

    stored_config = {
        b"normal:cap": b"22.0",
        b"normal:refill": b"11.0",
        b"bursty:cap": b"44.0",
        b"bursty:refill": b"22.0",
        b"suspicious:cap": b"2.0",
        b"suspicious:refill": b"0.5",
        b"normal_rate_max": b"9.0",
        b"bursty_rate_max": b"28.0",
        b"suspicious_sigma": b"0.12",
    }
    mock_redis.hgetall.return_value = stored_config

    await limiter.init_runtime_config()

    assert middleware.BUCKET_PROFILES["normal"] == (22.0, 11.0)
    assert middleware.BUCKET_PROFILES["bursty"] == (44.0, 22.0)
    assert middleware.BUCKET_PROFILES["suspicious"] == (2.0, 0.5)
    assert middleware.NORMAL_RATE_MAX == 9.0
    assert middleware.LAMBDA_BURSTY_MAX == 28.0
    assert middleware.SUSPICIOUS_SIGMA == 0.12
