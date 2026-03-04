"""
Heuristic Pattern Classification Engine + Token Bucket
Fully aligned to SRS FR-1.1, FR-1.2, FR-1.3, FR-1.4
"""
import time
import statistics
import hashlib
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional

# ─── SRS FR-1.2.2 Normal Traffic Thresholds ──────────────────────────────────
NORMAL_RATE_MIN        = 5    # req/min
NORMAL_RATE_MAX        = 50   # req/min
NORMAL_JITTER_MIN      = 0.5  # seconds std dev (variable timing)
NORMAL_BURST_MAX       = 2    # bursts per 5-min window
NORMAL_ERROR_MAX       = 0.10 # 10%

# ─── SRS FR-1.2.3 Bursty Legitimate Thresholds ───────────────────────────────
BURSTY_RATE_MAX        = 200  # req/min
BURSTY_ERROR_MAX       = 0.15 # 15%
BURSTY_BURST_MIN       = 3    # bursts per 5-min
BURSTY_BURST_MAX       = 10
BURSTY_PERSIST_MAX     = 30   # seconds
BURSTY_JITTER_MIN      = 0.3  # seconds std dev

# ─── SRS FR-1.2.4 Suspicious Thresholds ──────────────────────────────────────
SUSPICIOUS_RATE_MIN    = 200  # req/min sustained
SUSPICIOUS_JITTER_MAX  = 0.1  # seconds std dev (mechanical)
SUSPICIOUS_ERROR_MIN   = 0.40 # 40%
SUSPICIOUS_PERSIST_MIN = 60   # seconds sustained burst

# ─── SRS FR-1.2.2/3/4 Token Bucket Profiles ──────────────────────────────────
PROFILES = {
    "normal": {
        "capacity":    200,                    # b₀ = 200 tokens
        "refill_rate": 100 / 60,               # r₀ = 100 req/min → tokens/sec
    },
    "bursty": {
        "capacity":    500,                    # b₁ = 500 tokens
        "refill_rate": 200 / 60,               # r₁ = 200 req/min
    },
    "suspicious": {
        "capacity":    50,                     # b₂ = 50 tokens
        "refill_rate": 20 / 60,                # r₂ = 20 req/min
    },
}

# SRS FR-1.3.3 Transition timing
BURSTY_TO_NORMAL_SECS   = 30   # gradual reduction
SUSPICIOUS_COOLDOWN     = 120  # seconds compliant before upgrading


# ─── Token Bucket (SRS FR-1.3.2) ─────────────────────────────────────────────

@dataclass
class TokenBucket:
    capacity:     float
    refill_rate:  float   # tokens per second
    _tokens:      float = field(init=False)
    _last_refill: float = field(init=False)

    def __post_init__(self):
        self._tokens      = self.capacity
        self._last_refill = time.time()

    def consume(self) -> bool:
        self._refill()
        if self._tokens >= 1.0:
            self._tokens -= 1.0
            return True
        return False

    def _refill(self):
        now           = time.time()
        elapsed       = now - self._last_refill
        self._tokens  = min(self.capacity, self._tokens + elapsed * self.refill_rate)
        self._last_refill = now

    @property
    def tokens_remaining(self) -> float:
        self._refill()
        return round(self._tokens, 2)

    @property
    def fill_percentage(self) -> float:
        return round((self.tokens_remaining / self.capacity) * 100, 1)

    @property
    def seconds_until_token(self) -> float:
        """SRS FR-1.4.2: Retry-After calculation."""
        self._refill()
        if self._tokens >= 1.0:
            return 0.0
        needed = 1.0 - self._tokens
        return round(needed / self.refill_rate, 1) if self.refill_rate > 0 else 999.0

    def adjust(self, capacity: float, refill_rate: float):
        """SRS FR-1.3.3: Smooth transition — preserve relative fill level."""
        ratio            = self._tokens / self.capacity if self.capacity > 0 else 1.0
        self.capacity    = capacity
        self.refill_rate = refill_rate
        self._tokens     = min(capacity, capacity * ratio)


# ─── Client State (SRS FR-1.3.4, FR-1.1.3) ───────────────────────────────────

@dataclass
class ClientState:
    client_id:           str
    # SRS FR-1.1.3: Last 100 requests per client
    timestamps:          Deque[float] = field(default_factory=lambda: deque(maxlen=100))
    # SRS FR-1.2.5: Last 20 classifications
    classification_history: Deque[str] = field(default_factory=lambda: deque(maxlen=20))
    classification:      str   = "normal"
    burst_count:         int   = 0          # bursts in current 5-min window
    burst_start:         Optional[float] = None  # when current burst began
    error_count:         int   = 0
    request_count:       int   = 0
    last_suspicious_time: Optional[float] = None  # for cooldown (FR-1.3.3)
    bucket:              TokenBucket = field(
        default_factory=lambda: TokenBucket(
            PROFILES["normal"]["capacity"],
            PROFILES["normal"]["refill_rate"]
        )
    )
    total_accepted:      int   = 0
    total_rejected:      int   = 0
    # SRS FR-1.1.3: state persists 300s after last request
    last_seen:           float = field(default_factory=time.time)

    def record_request(self, is_error: bool = False):
        now = time.time()
        self.timestamps.append(now)
        self.request_count += 1
        self.last_seen = now
        if is_error:
            self.error_count += 1

    @property
    def request_rate_per_min(self) -> float:
        """SRS FR-1.1.2: Requests per 60-second sliding window."""
        now    = time.time()
        recent = [t for t in self.timestamps if now - t <= 60.0]
        return (len(recent) / 60.0) * 60  # req/min

    @property
    def request_rate_per_sec(self) -> float:
        now    = time.time()
        recent = [t for t in self.timestamps if now - t <= 5.0]
        return len(recent) / 5.0

    @property
    def interval_jitter(self) -> float:
        """SRS FR-1.1.2: Std deviation of inter-request time gaps."""
        if len(self.timestamps) < 4:
            return 999.0
        intervals = [
            self.timestamps[i + 1] - self.timestamps[i]
            for i in range(len(self.timestamps) - 1)
        ]
        try:
            return statistics.stdev(intervals)
        except statistics.StatisticsError:
            return 999.0

    @property
    def error_rate(self) -> float:
        if self.request_count == 0:
            return 0.0
        return self.error_count / self.request_count

    @property
    def burst_persistence_secs(self) -> float:
        """How long current burst has been sustained."""
        if self.burst_start is None:
            return 0.0
        return time.time() - self.burst_start

    @property
    def is_suspicious_cooldown_over(self) -> bool:
        """SRS FR-1.3.3: 120s compliant behavior before upgrading from suspicious."""
        if self.last_suspicious_time is None:
            return True
        return (time.time() - self.last_suspicious_time) >= SUSPICIOUS_COOLDOWN


# ─── Heuristic Classifier (SRS FR-1.2) ───────────────────────────────────────

class HeuristicClassifier:

    def classify(self, state: ClientState) -> tuple[str, list[str]]:
        """
        Returns (classification, matched_rules) for FR-1.2.5 justification logging.
        """
        rate      = state.request_rate_per_min
        jitter    = state.interval_jitter
        err_rate  = state.error_rate
        persist   = state.burst_persistence_secs
        matched   = []

        # ── FR-1.2.4: Suspicious triggers (ANY condition) ────────────────────
        if rate > SUSPICIOUS_RATE_MIN and persist > SUSPICIOUS_PERSIST_MIN:
            matched.append(f"HIGH_RATE_SUSTAINED: {rate:.0f} req/min > {SUSPICIOUS_RATE_MIN} sustained {persist:.0f}s > {SUSPICIOUS_PERSIST_MIN}s")

        if jitter < SUSPICIOUS_JITTER_MAX and len(state.timestamps) >= 4:
            matched.append(f"ROBOTIC_TIMING: σ={jitter:.3f}s < {SUSPICIOUS_JITTER_MAX}s threshold")

        if err_rate > SUSPICIOUS_ERROR_MIN:
            matched.append(f"HIGH_ERROR_RATE: {err_rate*100:.0f}% > {SUSPICIOUS_ERROR_MIN*100:.0f}%")

        if matched:
            state.last_suspicious_time = time.time()
            if state.burst_start is None:
                state.burst_start = time.time()
            return "suspicious", matched

        # ── FR-1.3.3: Cooldown — suspicious needs 120s clean before upgrade ──
        if state.classification == "suspicious" and not state.is_suspicious_cooldown_over:
            matched.append(f"SUSPICIOUS_COOLDOWN: {120 - (time.time() - (state.last_suspicious_time or 0)):.0f}s remaining")
            return "suspicious", matched

        # ── FR-1.2.3: Bursty Legitimate (ANY combination) ────────────────────
        bursty_signals = 0

        if BURSTY_RATE_MAX >= rate > NORMAL_RATE_MAX and err_rate < BURSTY_ERROR_MAX:
            bursty_signals += 1
            matched.append(f"ELEVATED_RATE: {rate:.0f} req/min (50-200 range)")

        if BURSTY_BURST_MIN <= state.burst_count <= BURSTY_BURST_MAX and persist < BURSTY_PERSIST_MAX:
            bursty_signals += 1
            matched.append(f"BURST_PATTERN: {state.burst_count} bursts, persist={persist:.0f}s")

        if jitter > BURSTY_JITTER_MIN:
            bursty_signals += 1
            matched.append(f"VARIABLE_TIMING: σ={jitter:.3f}s > {BURSTY_JITTER_MIN}s (human-like)")

        if bursty_signals >= 1 and rate > NORMAL_RATE_MAX:
            if state.burst_start is None:
                state.burst_start = time.time()
            state.burst_count += 1
            return "bursty", matched

        # ── FR-1.2.2: Normal (ALL conditions) ────────────────────────────────
        state.burst_start = None
        state.burst_count = max(0, state.burst_count - 1)
        matched.append(f"NORMAL_RATE: {rate:.0f} req/min, σ={jitter:.3f}s")
        return "normal", matched

    def adapt_bucket(self, state: ClientState):
        """SRS FR-1.3.1/1.3.3: Adjust (r, b) based on classification."""
        profile = PROFILES[state.classification]
        new_cap  = profile["capacity"]
        new_rate = profile["refill_rate"]

        # FR-1.3.3: Normal→Bursty: immediate elevation
        # FR-1.3.3: Any→Suspicious: immediate restriction
        # FR-1.3.3: Bursty→Normal: handled by smooth adjust
        state.bucket.adjust(new_cap, new_rate)

    def generate_justification(self, state: ClientState, matched_rules: list[str]) -> str:
        """SRS FR-1.5.3: Human-readable classification justification."""
        lines = [
            f"Client {state.client_id} classified as {state.classification.upper()} because:"
        ]
        for rule in matched_rules:
            lines.append(f"  - {rule}")
        lines.append(
            f"  Applied Token Bucket: r={state.bucket.refill_rate*60:.0f} req/min, "
            f"b={state.bucket.capacity:.0f} tokens"
        )
        return "\n".join(lines)


# ─── Rate Limiter Engine (SRS FR-1.4) ─────────────────────────────────────────

class RateLimiterEngine:
    def __init__(self):
        self.clients:    dict[str, ClientState] = {}
        self.classifier: HeuristicClassifier    = HeuristicClassifier()

    def get_or_create(self, client_id: str) -> ClientState:
        if client_id not in self.clients:
            self.clients[client_id] = ClientState(client_id=client_id)
        return self.clients[client_id]

    def process_request(self, client_id: str, is_error: bool = False) -> dict:
        """
        Full pipeline per SRS AR-3.1.1:
        Metadata → Markers → Classification → Token Bucket → Decision
        """
        state = self.get_or_create(client_id)
        state.record_request(is_error=is_error)

        # Step 1: Classify (FR-1.2)
        classification, matched_rules = self.classifier.classify(state)
        state.classification = classification
        state.classification_history.append(classification)

        # Step 2: Adapt token bucket (FR-1.3.1)
        self.classifier.adapt_bucket(state)

        # Step 3: Enforce (FR-1.4.1)
        allowed = state.bucket.consume()
        if allowed:
            state.total_accepted += 1
        else:
            state.total_rejected += 1

        # Step 4: Justification log (FR-1.5.3)
        justification = self.classifier.generate_justification(state, matched_rules)

        # Step 5: Build response (FR-1.4.2)
        retry_after = state.bucket.seconds_until_token if not allowed else 0

        return {
            "client_id":         client_id,
            "allowed":           allowed,
            "classification":    classification,
            "matched_rules":     matched_rules,
            "justification":     justification,
            # Behavioral markers
            "request_rate_min":  round(state.request_rate_per_min, 2),
            "request_rate_sec":  round(state.request_rate_per_sec, 2),
            "interval_jitter":   round(state.interval_jitter, 4) if state.interval_jitter < 999 else None,
            "error_rate":        round(state.error_rate, 3),
            "burst_count":       state.burst_count,
            "burst_persistence": round(state.burst_persistence_secs, 1),
            # Token bucket state
            "bucket_fill":       state.bucket.fill_percentage,
            "bucket_capacity":   state.bucket.capacity,
            "refill_rate":       round(state.bucket.refill_rate * 60, 1),  # in req/min
            "tokens_remaining":  state.bucket.tokens_remaining,
            "retry_after":       retry_after,
            # Totals
            "total_accepted":    state.total_accepted,
            "total_rejected":    state.total_rejected,
        }

    def get_summary(self) -> dict:
        """SRS FR-1.5.2: Dashboard metrics."""
        self._evict_stale_clients()
        total_accepted  = sum(c.total_accepted for c in self.clients.values())
        total_rejected  = sum(c.total_rejected for c in self.clients.values())
        classifications = {"normal": 0, "bursty": 0, "suspicious": 0}
        for c in self.clients.values():
            classifications[c.classification] += 1

        # Top 10 clients by request volume (FR-1.5.2)
        top_clients = sorted(
            [
                {
                    "client_id":      c.client_id,
                    "classification": c.classification,
                    "rate_per_min":   round(c.request_rate_per_min, 1),
                    "accepted":       c.total_accepted,
                    "rejected":       c.total_rejected,
                    "bucket_fill":    c.bucket.fill_percentage,
                }
                for c in self.clients.values()
            ],
            key=lambda x: x["rate_per_min"],
            reverse=True
        )[:10]

        return {
            "active_clients":  len(self.clients),
            "total_accepted":  total_accepted,
            "total_rejected":  total_rejected,
            "classifications": classifications,
            "top_clients":     top_clients,
        }

    def _evict_stale_clients(self):
        """SRS FR-1.3.4: Evict clients inactive for 300 seconds."""
        now   = time.time()
        stale = [cid for cid, c in self.clients.items() if now - c.last_seen > 300]
        for cid in stale:
            del self.clients[cid]