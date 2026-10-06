import time
import pytest
from dashboard.backend.algorithms.token_bucket import TokenBucket

def test_token_bucket_initialization():
    """Test that the bucket initializes full based on constraints."""
    bucket = TokenBucket(refill_rate=10.0, bucket_capacity=50.0)
    assert bucket.refill_rate == 10.0
    assert bucket.bucket_capacity == 50.0
    assert bucket.current_tokens == 50.0
    assert bucket.fill_percentage == 100.0

def test_token_bucket_consumption():
    """Test that a request consumes exactly 1 token."""
    bucket = TokenBucket(refill_rate=10.0, bucket_capacity=50.0)
    
    allowed = bucket.allow_request()
    assert allowed is True
    # 50 - 1 = 49 (plus a tiny microsecond refill)
    assert 49.0 <= bucket.tokens_remaining < 49.01

def test_token_bucket_depletion():
    """Test that the bucket correctly blocks when empty."""
    # Small capacity, no refill to force empty state quickly
    bucket = TokenBucket(refill_rate=0.0001, bucket_capacity=2.0)
    
    assert bucket.allow_request() is True  # Consumes token 1 (1 left)
    assert bucket.allow_request() is True  # Consumes token 2 (0 left)
    assert bucket.allow_request() is False # Blocked!

def test_token_bucket_refill(monkeypatch):
    """Test the refill math (T(t) = min(b, T(t-1) + r * dt))."""
    bucket = TokenBucket(refill_rate=10.0, bucket_capacity=50.0)
    
    # Drain 5 tokens
    for _ in range(5):
        bucket.allow_request()
    
    # Bucket should be around 45
    assert 45.0 <= bucket.tokens_remaining < 45.1
    
    # Mock time.time() to simulate 2 seconds passing
    # 2 seconds * 10 tokens/sec = 20 tokens refilled (capped at 50)
    original_time = time.time
    mock_time = original_time() + 2.0
    monkeypatch.setattr(time, "time", lambda: mock_time)
    
    bucket.refill()
    
    # Should hit the ceiling of 50
    assert bucket.current_tokens == 50.0

def test_update_parameters():
    """Test that updating parameters preserves the fill ratio."""
    bucket = TokenBucket(refill_rate=10.0, bucket_capacity=100.0)
    
    # Drain 50 tokens (so it's exactly 50% full)
    for _ in range(50):
        bucket.allow_request()
        
    assert 49.9 <= bucket.fill_percentage <= 50.1
    
    # Update parameters to a smaller bucket (e.g. strict mode)
    bucket.update_parameters(new_r=5.0, new_b=20.0)
    
    # It should still be 50% full! (10 tokens out of 20)
    assert bucket.bucket_capacity == 20.0
    assert bucket.refill_rate == 5.0
    assert 9.9 <= bucket.tokens_remaining <= 10.1
    assert 49.9 <= bucket.fill_percentage <= 50.1
