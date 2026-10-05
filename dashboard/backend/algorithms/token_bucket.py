"""
token_bucket.py
================
Token Bucket Enforcer
Implements Phase 3 of the algorithm:
  - Step 6: Compute T(t) and enforce rate limit (Equation 3)

Faithful to:
  - Chapter 3, Equation 3: T(t) = min(b, T(t-1) + r·Δt)
  - Class Diagram: «Enforcer» TokenBucket
  - Chapter 3 Constraints 1, 2, 3 (token bounds, refill positivity)
  - Sequence Diagram: Middleware → TokenBucketController.updateParameters(r,b)
                                 → TokenBucketController.requestToken()
"""

import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    """
    «Enforcer» TokenBucket — from class diagram.

    Implements the Token Bucket algorithm as defined in Chapter 3, Equation 3:
        T(t) = min(b, T(t-1) + r·Δt)

    The min() function enforces Constraint 1 (token ceiling = b).
    Constraint 2: refill_rate > 0 always (no permanent blocking).
    Constraint 3: bucket_capacity > 0 always (never zero-capacity).

    Attributes match class diagram:
        - refillRate (r):      float  — tokens added per second
        - bucketCapacity (b):  float  — maximum token ceiling
        - currentTokens:       float  — T(t), current token count
        - lastRefill:          float  — timestamp of last refill (long in diagram → float in Python)
    """

    refill_rate:      float         # r — tokens per second
    bucket_capacity:  float         # b — maximum tokens (ceiling)
    current_tokens:   float = field(init=False)
    last_refill:      float = field(init=False)

    def __post_init__(self):
        """
        Initialize token count to full capacity.
        New clients start with a full bucket (baseline profile).
        """
        # Enforce Constraints 2 and 3 on initialization
        assert self.refill_rate > 0,     "Constraint 2: refill_rate must be > 0"
        assert self.bucket_capacity > 0, "Constraint 3: bucket_capacity must be > 0"

        self.current_tokens = self.bucket_capacity   # start full
        self.last_refill    = time.time()

    # ──────────────────────────────────────────────────────────────────────────
    # Core Token Bucket Operations (matching class diagram method signatures)
    # ──────────────────────────────────────────────────────────────────────────

    def refill(self) -> None:
        """
        refill(): void — from class diagram.
        Equation 3: T(t) = min(b, T(t-1) + r·Δt)
        Called internally before every allow_request() check.
        """
        now      = time.time()
        delta_t  = now - self.last_refill                          # Δt
        added    = self.refill_rate * delta_t                      # r · Δt
        # Constraint 1: token count bounded by [0, b]
        self.current_tokens = min(
            self.bucket_capacity,                                   # ceiling = b
            self.current_tokens + added                            # T(t-1) + r·Δt
        )
        self.last_refill = now

    def allow_request(self) -> bool:
        """
        allowRequest(): boolean — from class diagram.
        Step 6 of algorithm:
          IF T(t) >= 1 → consume 1 token → return True  (ADMITTED)
          ELSE         → return False                    (BLOCKED)
        """
        self.refill()   # always refill before checking

        if self.current_tokens >= 1.0:
            self.current_tokens -= 1.0   # consume one token
            return True                  # ADMITTED → HTTP 200

        return False                     # BLOCKED  → HTTP 429

    def update_parameters(self, new_r: float, new_b: float) -> None:
        """
        updateParameters(newR: float, newB: float): void — from class diagram.
        Step 5 → Step 6 bridge: called by middleware after classification
        to apply the new (r, b) profile before the token check.

        Sequence Diagram: TokenBucketController.updateParameters(r, b)
        is called immediately after HeuristicClassifier returns TrafficType.

        Preserves relative fill ratio during parameter transitions
        so clients are not penalized or rewarded unfairly mid-session.
        Constraint 2 and 3 enforced on new values.
        """
        assert new_r > 0, "Constraint 2: new refill_rate must be > 0"
        assert new_b > 0, "Constraint 3: new bucket_capacity must be > 0"

        # Refill with old parameters first to get accurate current_tokens
        self.refill()

        # Preserve fill ratio: if bucket was 50% full, keep it 50% full
        # This prevents abusive clients from gaming parameter transitions
        ratio = self.current_tokens / self.bucket_capacity if self.bucket_capacity > 0 else 1.0

        self.refill_rate     = new_r
        self.bucket_capacity = new_b
        # Constraint 1: new token count bounded by new capacity
        self.current_tokens  = min(new_b, new_b * ratio)

    # ──────────────────────────────────────────────────────────────────────────
    # Read-only Properties (for logging, dashboard, and CLI output)
    # ──────────────────────────────────────────────────────────────────────────

    @property
    def tokens_remaining(self) -> float:
        """Current token count after a passive refill (non-consuming)."""
        self.refill()
        return round(self.current_tokens, 3)

    @property
    def fill_percentage(self) -> float:
        """Bucket fullness as a percentage (0–100%)."""
        return round((self.tokens_remaining / self.bucket_capacity) * 100, 1)

    @property
    def seconds_until_token(self) -> float:
        """
        How many seconds until the next token becomes available.
        Used for the Retry-After header in HTTP 429 responses.
        Constraint 2 ensures this never divides by zero.
        """
        self.refill()
        if self.current_tokens >= 1.0:
            return 0.0
        needed = 1.0 - self.current_tokens
        return round(needed / self.refill_rate, 2)

    def snapshot(self) -> dict:
        """Returns current bucket state as a dict for logging and dashboard."""
        return {
            "refill_rate":     self.refill_rate,
            "bucket_capacity": self.bucket_capacity,
            "current_tokens":  round(self.current_tokens, 3),
            "fill_percentage": self.fill_percentage,
            "seconds_until_token": self.seconds_until_token,
        }