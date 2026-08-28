"""
heuristic_engine.py
====================
Heuristic Pattern Classification Engine
Implements Phase 1 and Phase 2 of the algorithm:
  - Step 1: Metadata extraction
  - Step 2: TrafficMonitor retrieval / initialization
  - Step 3: Behavioral marker computation
  - Step 4: Priority-ordered classification
  - Step 5: Token Bucket parameter mapping

Faithful to:
  - Chapter 3 pseudocode (HeuristicTokenBucketRateLimiter)
  - Chapter 3 Table 2 (Classification Thresholds)
  - Class Diagram: TrafficType, TrafficMonitor, HeuristicEngine
  - Activity Diagram: priority-ordered classification flow
  - Constraint 7: elapsed time > 0 guard
  - Constraint 8: n >= 2 guard for sigma
"""

import time
import statistics
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Deque, Optional


# =============================================================================
# SECTION 1: TrafficType Enum
# =============================================================================

class TrafficType(Enum):
    """
    Enumeration of the three traffic classifications.
    Priority order (highest to lowest): SUSPICIOUS > BURSTY > NORMAL
    Used as key for token bucket parameter mapping (Table 3, Chapter 3).
    """
    NORMAL             = "normal"
    BURSTY_LEGITIMATE  = "bursty"
    SUSPICIOUS_ABUSIVE = "suspicious"


# =============================================================================
# SECTION 2: Classification Thresholds
# Chapter 3, Table 2 — Heuristic Classification Threshold Values
# =============================================================================

NORMAL_RATE_MIN    = 1
NORMAL_RATE_MAX    = 10
BURSTY_RATE_MAX    = 30

NORMAL_SIGMA_MIN   = 0.5
SUSPICIOUS_SIGMA   = 0.1

NORMAL_BURST_MAX   = 2
BURSTY_BURST_MIN   = 3
BURSTY_BURST_MAX   = 5
SUSPICIOUS_BURST   = 5

NORMAL_PERSIST_MAX  = 5
BURSTY_PERSIST_MIN  = 5
BURSTY_PERSIST_MAX  = 30
SUSPICIOUS_PERSIST  = 30

MIN_HISTORY_FOR_ANALYSIS = 2

# =============================================================================
# FIX: Sliding-window rate computation — O(1) amortized
#
# WHY THIS EXISTS:
#   The original implementation computed λ as (n-1) / ΔT where ΔT spanned
#   the full 100-entry deque. Once a suspicious client's token bucket emptied,
#   admitted requests slowed, ΔT grew, and λ collapsed — causing the client
#   to be reclassified as Normal and its bucket refilled. This produced ~93%
#   FNR for suspicious traffic in Locust evaluation runs.
#
#   A previous fix attempt used a list comprehension filter on every call:
#       recent = [t for t in self.request_history if t >= cutoff]
#   This allocated a new list on every single request. At 200 concurrent
#   users it caused median latency to spike from ~3ms to ~2000ms.
#
#   This fix uses a dedicated `rate_window` deque per client. Timestamps
#   are appended in update_history() and evicted from the left in O(1)
#   per eviction via popleft(). No allocation on the hot path — O(1) amortized.
# =============================================================================
RATE_WINDOW_SECONDS = 30.0   # rolling window duration for λ computation


# =============================================================================
# SECTION 3: Token Bucket Parameter Profiles
# Chapter 3, Table 3 — Constraints 4 & 5: r2 < r0 < r1, b2 < b0 < b1
# =============================================================================

PROFILES: dict[TrafficType, dict] = {
    TrafficType.NORMAL: {
        "refill_rate": 10.0,
        "capacity":    20.0,
    },
    TrafficType.BURSTY_LEGITIMATE: {
        "refill_rate": 20.0,
        "capacity":    40.0,
    },
    TrafficType.SUSPICIOUS_ABUSIVE: {
        "refill_rate": 2.0,
        "capacity":    5.0,
    },
}

assert PROFILES[TrafficType.SUSPICIOUS_ABUSIVE]["refill_rate"] \
     < PROFILES[TrafficType.NORMAL]["refill_rate"] \
     < PROFILES[TrafficType.BURSTY_LEGITIMATE]["refill_rate"], \
    "Constraint 4 violated: r2 < r0 < r1 must hold"

assert PROFILES[TrafficType.SUSPICIOUS_ABUSIVE]["capacity"] \
     < PROFILES[TrafficType.NORMAL]["capacity"] \
     < PROFILES[TrafficType.BURSTY_LEGITIMATE]["capacity"], \
    "Constraint 5 violated: b2 < b0 < b1 must hold"


# =============================================================================
# SECTION 4: RequestMetadata
# =============================================================================

@dataclass
class RequestMetadata:
    """
    Data object carrying all metadata extracted from an incoming HTTP request.
    Step 1 of the algorithm — Input Interception.
    No payload inspection is performed (privacy-compliant, Layer 7 scope only).
    """
    ip_address:     str
    timestamp:      float
    endpoint:       str = "/"
    request_method: str = "GET"

    def get_header_data(self) -> dict:
        return {
            "ip_address":     self.ip_address,
            "timestamp":      self.timestamp,
            "endpoint":       self.endpoint,
            "request_method": self.request_method,
        }


# =============================================================================
# SECTION 5: TrafficMonitor
# =============================================================================

@dataclass
class TrafficMonitor:
    """
    Per-client behavioral state tracker.
    Stored in the hash map (dict) keyed by IP address.

    Two deques are maintained intentionally:

      request_history — bounded maxlen=100, used for σ (interval regularity).
                        Keeps the last 100 timestamps for stdev computation.

      rate_window     — unbounded, time-evicted via popleft() in O(1).
                        Used exclusively for λ computation.
                        Each timestamp is evicted at most once — O(1) amortized.

    WHY TWO DEQUES:
      Keeping them separate ensures σ stays stable (full recent history up to
      100 samples) while λ always reflects only the last RATE_WINDOW_SECONDS
      of activity, regardless of how long ago the client was first seen.
      This prevents the FNR collapse where blocked suspicious clients appear
      Normal because their ΔT grows as admitted requests slow down.
    """
    ip_address: str

    # Full recent history — used for σ computation only
    request_history: Deque[float] = field(
        default_factory=lambda: deque(maxlen=100)
    )

    # Sliding rate window — used exclusively for λ computation.
    # Unbounded: entries are evicted by time (not by count) via popleft().
    rate_window: Deque[float] = field(
        default_factory=lambda: deque()
    )

    # Burst tracking
    burst_log:   list = field(default_factory=list)
    burst_count: int  = 0

    # Persistence tracking
    elevated_since: Optional[float] = None

    # Current classification
    category: TrafficType = TrafficType.NORMAL

    # Token state
    tokens:           float = 20.0
    last_refill_time: float = field(default_factory=time.time)

    # Totals for metrics
    total_accepted: int   = 0
    total_rejected: int   = 0
    first_seen:     float = field(default_factory=time.time)
    last_seen:      float = field(default_factory=time.time)
    request_count:  int   = 0

    def update_history(self, ts: float):
        """
        Append timestamp to BOTH deques on every incoming request.
          - request_history auto-evicts oldest when maxlen=100 is exceeded.
          - rate_window grows freely; old entries evicted by time in get_request_rate().
        """
        self.request_history.append(ts)
        self.rate_window.append(ts)
        self.request_count += 1
        self.last_seen = ts

    def get_request_rate(self) -> float:
        """
        Equation 1: λ = (N-1) / ΔT computed over RATE_WINDOW_SECONDS window.

        Uses rate_window deque with O(1) amortized left-eviction:
          1. Compute cutoff = now - RATE_WINDOW_SECONDS
          2. popleft() while the oldest entry is before the cutoff
             — each timestamp is popped at most once across all calls
          3. Compute λ over the remaining entries in the window

        This ensures a suspicious client flooding at 100 req/s always
        registers λ ≈ 100 req/s even when most requests are blocked,
        because the window captures attempted requests — not just admitted ones.

        Constraint 7: minimum ΔT of 0.001s prevents division by zero.
        """
        
        now    = time.time()
        cutoff = now - RATE_WINDOW_SECONDS

        # Evict stale entries from the left — O(1) per eviction, O(1) amortized
        while self.rate_window and self.rate_window[0] < cutoff:
            self.rate_window.popleft()

        n = len(self.rate_window)
        if n < 2:
            return 0.0

        delta_t = self.rate_window[-1] - self.rate_window[0]
        delta_t = max(delta_t, 0.001)   # Constraint 7
        return (n - 1) / delta_t        # req/s — Equation 1
    
    
    def get_interval_regularity(self) -> float:
        """
        Equation 2: σ = stdev of inter-arrival intervals.
        Uses request_history (bounded 100-entry deque).
        Constraint 8: returns 999.0 if fewer than 2 samples.
        High σ = human-like (irregular). Low σ = bot-like (regular).
        """
        n = len(self.request_history)
        if n < MIN_HISTORY_FOR_ANALYSIS:
            return 999.0

        intervals = [
            self.request_history[i + 1] - self.request_history[i]
            for i in range(n - 1)
        ]
        try:
            return statistics.stdev(intervals)
        except statistics.StatisticsError:
            return 999.0

    def get_traffic_persistence(self) -> float:
        """How long this client has sustained an elevated request rate."""
        if self.elevated_since is None:
            return 0.0
        return time.time() - self.elevated_since

    
    def get_burst_frequency(self) -> int:
        """Burst events per 60-second window. Evicts expired entries on call."""
        now = time.time()
        self.burst_log = [t for t in self.burst_log if now - t <= 60.0]
        return len(self.burst_log)

    def get_average_interval(self) -> float:
        """Mean inter-arrival interval from recent history."""
        n = len(self.request_history)
        if n < 2:
            return 0.0
        intervals = [
            self.request_history[i + 1] - self.request_history[i]
            for i in range(n - 1)
        ]
        return sum(intervals) / len(intervals)

    def has_sufficient_history(self) -> bool:
        """True if enough data exists for heuristic analysis."""
        return len(self.request_history) >= MIN_HISTORY_FOR_ANALYSIS


# =============================================================================
# SECTION 6: HeuristicEngine
# =============================================================================

class HeuristicEngine:
    """
    Priority-ordered classification engine.
    Priority: SUSPICIOUS > BURSTY_LEGITIMATE > NORMAL
    This ordering ensures the most harmful profile is never underdetected.
    """

    def classify(self, monitor: TrafficMonitor) -> TrafficType:
        """Step 4 — priority-ordered classification."""
        if not monitor.has_sufficient_history():
            return TrafficType.NORMAL

        lam         = monitor.get_request_rate()
        sigma       = monitor.get_interval_regularity()
        burst_freq  = monitor.get_burst_frequency()
        persistence = monitor.get_traffic_persistence()

        # PRIORITY 1: SUSPICIOUS_ABUSIVE
        if lam > BURSTY_RATE_MAX and sigma < SUSPICIOUS_SIGMA:
            return TrafficType.SUSPICIOUS_ABUSIVE
        if burst_freq > SUSPICIOUS_BURST and sigma < SUSPICIOUS_SIGMA:
            return TrafficType.SUSPICIOUS_ABUSIVE
        if persistence > SUSPICIOUS_PERSIST:
            return TrafficType.SUSPICIOUS_ABUSIVE

        # PRIORITY 2: BURSTY_LEGITIMATE
        if (lam >= NORMAL_RATE_MAX or
                burst_freq >= BURSTY_BURST_MIN or
                persistence >= BURSTY_PERSIST_MIN):
            return TrafficType.BURSTY_LEGITIMATE

        # PRIORITY 3: NORMAL (default)
        return TrafficType.NORMAL

    def get_optimization_params(self, traffic_type: TrafficType) -> dict:
        """Step 5 — retrieve (r, b) for the assigned classification."""
        return PROFILES[traffic_type].copy()

    def calculate_score(self, rate: float, reg: float, burst: int) -> float:
        """Normalized risk score in [0.0, 1.0]. Used for logging and dashboard."""
        rate_score  = min(1.0, rate / (BURSTY_RATE_MAX + 10))
        sigma_score = max(0.0, 1.0 - (reg / NORMAL_SIGMA_MIN)) if reg < NORMAL_SIGMA_MIN else 0.0
        burst_score = min(1.0, burst / (SUSPICIOUS_BURST + 1))
        return round((rate_score * 0.4 + sigma_score * 0.4 + burst_score * 0.2), 3)

    def generate_justification(
        self,
        monitor:      TrafficMonitor,
        traffic_type: TrafficType,
        lam:          float,
        sigma:        float,
        burst_freq:   int,
        persistence:  float,
    ) -> str:
        """Human-readable justification for the enforcement decision."""
        profile  = PROFILES[traffic_type]
        label    = traffic_type.value.upper().replace("_", " ")
        reasons  = []

        if traffic_type == TrafficType.SUSPICIOUS_ABUSIVE:
            if lam > BURSTY_RATE_MAX:
                reasons.append(
                    f"request rate λ={lam:.2f} req/s exceeds suspicious threshold "
                    f"({BURSTY_RATE_MAX} req/s)"
                )
            if sigma < SUSPICIOUS_SIGMA:
                reasons.append(
                    f"interval regularity σ={sigma:.4f}s below bot-detection "
                    f"threshold ({SUSPICIOUS_SIGMA}s) — machine-like precision"
                )
            if burst_freq > SUSPICIOUS_BURST:
                reasons.append(
                    f"burst frequency={burst_freq}/min exceeds threshold "
                    f"({SUSPICIOUS_BURST}/min)"
                )
            if persistence > SUSPICIOUS_PERSIST:
                reasons.append(
                    f"persistence={persistence:.1f}s exceeds threshold "
                    f"({SUSPICIOUS_PERSIST}s)"
                )

        elif traffic_type == TrafficType.BURSTY_LEGITIMATE:
            if lam >= NORMAL_RATE_MAX:
                reasons.append(
                    f"request rate λ={lam:.2f} req/s in bursty range "
                    f"({NORMAL_RATE_MAX}–{BURSTY_RATE_MAX} req/s)"
                )
            if burst_freq >= BURSTY_BURST_MIN:
                reasons.append(
                    f"burst frequency={burst_freq}/min in bursty range "
                    f"({BURSTY_BURST_MIN}–{BURSTY_BURST_MAX}/min)"
                )
            if persistence >= BURSTY_PERSIST_MIN:
                reasons.append(
                    f"persistence={persistence:.1f}s in bursty range "
                    f"({BURSTY_PERSIST_MIN}–{BURSTY_PERSIST_MAX}s)"
                )

        else:
            reasons.append(
                f"request rate λ={lam:.2f} req/s within normal range "
                f"(≤{NORMAL_RATE_MAX} req/s)"
            )
            if sigma < 999.0:
                reasons.append(
                    f"interval regularity σ={sigma:.4f}s indicates natural "
                    f"human timing (>{NORMAL_SIGMA_MIN}s)"
                )

        reason_text = "; ".join(reasons) if reasons else "all markers within normal range"
        return (
            f"Client {monitor.ip_address} classified as {label}. "
            f"Reason: {reason_text}. "
            f"Token Bucket assigned: r={profile['refill_rate']} tokens/sec, "
            f"b={profile['capacity']} tokens."
        )


# =============================================================================
# SECTION 7: MiddlewareSystem
# =============================================================================

class MiddlewareSystem:
    """
    Central registry — owns the hash map of TrafficMonitor instances.
    O(1) average-case lookup per client IP.
    """

    def __init__(self):
        self._registry: dict[str, TrafficMonitor] = {}
        self.engine:    HeuristicEngine            = HeuristicEngine()

    def get_or_create(self, ip: str) -> TrafficMonitor:
        if ip not in self._registry:
            self._registry[ip] = TrafficMonitor(ip_address=ip)
        return self._registry[ip]

    def process(self, metadata: RequestMetadata) -> dict:
        """Full Phase 1 + Phase 2 pipeline."""
        ip  = metadata.ip_address
        ts  = metadata.timestamp

        monitor = self.get_or_create(ip)
        monitor.update_history(ts)

        lam         = monitor.get_request_rate()
        sigma       = monitor.get_interval_regularity()
        burst_freq  = monitor.get_burst_frequency()
        persistence = monitor.get_traffic_persistence()

        traffic_type = self.engine.classify(monitor)
        params       = self.engine.get_optimization_params(traffic_type)

        # Step 8: persistence tracking
        if lam > NORMAL_RATE_MAX and monitor.elevated_since is None:
            monitor.elevated_since = ts
        elif lam <= NORMAL_RATE_MAX:
            monitor.elevated_since = None

        # Record burst event only on state transition into elevated
        if lam > NORMAL_RATE_MAX and monitor.elevated_since == ts:
            monitor.burst_log.append(ts)

        monitor.category = traffic_type

        score         = self.engine.calculate_score(lam, sigma, burst_freq)
        justification = self.engine.generate_justification(
            monitor, traffic_type, lam, sigma, burst_freq, persistence
        )

        return {
            "ip_address":   ip,
            "timestamp":    ts,
            "traffic_type": traffic_type,
            "params":       params,
            "markers": {
                "lambda":      round(lam, 4),
                "sigma":       round(sigma, 4) if sigma < 999 else None,
                "burst_freq":  burst_freq,
                "persistence": round(persistence, 2),
            },
            "risk_score":    score,
            "justification": justification,
            "monitor":       monitor,
        }

    def get_all_monitors(self) -> dict[str, TrafficMonitor]:
        return self._registry

    def evict_stale(self, ttl_seconds: float = 300.0):
        now   = time.time()
        stale = [ip for ip, m in self._registry.items()
                 if now - m.last_seen > ttl_seconds]
        for ip in stale:
            del self._registry[ip]
            
