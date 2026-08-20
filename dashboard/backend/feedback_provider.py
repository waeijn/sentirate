"""
feedback_provider.py
=====================
Transparency Layer — FeedbackProvider
Implements Phase 4 of the algorithm:
  - Step 7: Return HTTP response + record log entry
  - Step 7: Update dashboard with current traffic state

LogEntry is expanded to match the frontend LiveEvent interface exactly:
  types/index.ts → interface LiveEvent
  Every field name and type here must match that interface.
"""

import time
from dataclasses import dataclass, field
from heuristic_engine import TrafficType, TrafficMonitor


# =============================================================================
# LogEntry — matches frontend LiveEvent interface exactly
# types/index.ts: interface LiveEvent { ... }
# =============================================================================

@dataclass
class LogEntry:
    """
    One enforcement decision record.
    Field names match the LiveEvent TypeScript interface in types/index.ts.
    """
    # Core identity
    client_id:        str
    timestamp:        float

    # Classification
    classification:   str           # "normal" | "bursty" | "suspicious"
    allowed:          bool          # True=ADMITTED False=BLOCKED

    # Behavioral markers
    request_rate_min: float         # lambda * 60 — req/min
    interval_jitter:  float | None  # sigma seconds
    burst_count:      int           # bursts/min
    burst_persistence: float        # seconds

    # Token bucket state at decision time
    bucket_fill:      float         # percentage 0-100
    bucket_capacity:  float         # b tokens
    refill_rate:      float         # r tokens/sec
    tokens_remaining: float         # T(t)
    retry_after:      float         # seconds

    # Transparency
    justification:    str
    matched_rules:    list

    # Running client totals
    total_accepted:   int
    total_rejected:   int

    # Internal only
    risk_score:       float = 0.0

    def to_dict(self) -> dict:
        """
        Serializes to dict matching LiveEvent interface.
        timestamp converted from Unix float to ISO string for new Date() on frontend.
        """
        return {
            "client_id":        self.client_id,
            "timestamp":        time.strftime(
                                    "%Y-%m-%dT%H:%M:%S",
                                    time.localtime(self.timestamp)
                                ),
            "classification":   self.classification,
            "allowed":          self.allowed,
            "request_rate_min": round(self.request_rate_min, 2),
            "interval_jitter":  round(self.interval_jitter, 4)
                                if self.interval_jitter is not None else None,
            "burst_count":      self.burst_count,
            "burst_persistence": round(self.burst_persistence, 2),
            "bucket_fill":      self.bucket_fill,
            "bucket_capacity":  self.bucket_capacity,
            "refill_rate":      self.refill_rate,
            "tokens_remaining": round(self.tokens_remaining, 3),
            "retry_after":      round(self.retry_after, 2),
            "justification":    self.justification,
            "matched_rules":    self.matched_rules,
            "total_accepted":   self.total_accepted,
            "total_rejected":   self.total_rejected,
        }


# =============================================================================
# FeedbackProvider
# =============================================================================

class FeedbackProvider:

    def __init__(self, dashboard_link: str = "http://localhost:5173"):
        self.dashboard_link = dashboard_link

        self.justification_templates: dict[TrafficType, str] = {
            TrafficType.NORMAL: (
                "Traffic pattern is within normal operational parameters. "
                "Request rate and timing variability are consistent with "
                "standard human API usage. Default token bucket profile "
                "applied (r={r} tokens/sec, b={b} tokens)."
            ),
            TrafficType.BURSTY_LEGITIMATE: (
                "Traffic pattern indicates a legitimate burst — elevated "
                "request rate consistent with batch operations or application "
                "sync. Token bucket capacity expanded to accommodate surge "
                "(r={r} tokens/sec, b={b} tokens)."
            ),
            TrafficType.SUSPICIOUS_ABUSIVE: (
                "Traffic pattern exhibits characteristics of automated or "
                "abusive behavior. One or more suspicious markers detected: "
                "high rate, excessive burst frequency, or prolonged "
                "persistence. Token bucket severely restricted "
                "(r={r} tokens/sec, b={b} tokens). "
                "Request throttled to protect API availability."
            ),
        }

        self._log: list[LogEntry] = []

    def generate_justification(
        self,
        traffic_type: TrafficType,
        refill_rate:  float,
        capacity:     float,
    ) -> str:
        template = self.justification_templates[traffic_type]
        return template.format(r=refill_rate, b=capacity)

    def create_protocol_message(
        self,
        is_blocked:      bool,
        monitor:         TrafficMonitor,
        traffic_type:    TrafficType,
        markers:         dict,
        risk_score:      float,
        justification:   str,
        bucket_snapshot: dict,
        retry_after:     float = 0.0,
    ) -> dict:
        """
        createProtocolMessage(isBlocked: boolean): HTTPResponse
        Builds HTTP response AND records LogEntry in one call.
        bucket_snapshot passed from middleware so all bucket fields are captured.
        """
        allowed     = not is_blocked
        decision    = "BLOCKED" if is_blocked else "ADMITTED"
        status_code = 429 if is_blocked else 200

        matched_rules = _build_matched_rules(traffic_type, markers)

        log_entry = LogEntry(
            client_id         = monitor.ip_address,
            timestamp         = time.time(),
            classification    = traffic_type.value,
            allowed           = allowed,
            request_rate_min  = round(markers.get("lambda", 0.0) * 60, 2),
            interval_jitter   = markers.get("sigma"),
            burst_count       = markers.get("burst_freq", 0),
            burst_persistence = markers.get("persistence", 0.0),
            bucket_fill       = bucket_snapshot.get("fill_percentage", 0.0),
            bucket_capacity   = bucket_snapshot.get("bucket_capacity", 0.0),
            refill_rate       = bucket_snapshot.get("refill_rate", 0.0),
            tokens_remaining  = bucket_snapshot.get("current_tokens", 0.0),
            retry_after       = retry_after,
            justification     = justification,
            matched_rules     = matched_rules,
            total_accepted    = monitor.total_accepted,
            total_rejected    = monitor.total_rejected,
            risk_score        = risk_score,
        )
        self._log.append(log_entry)

        response = {
            "status_code":   status_code,
            "decision":      decision,
            "allowed":       allowed,
            "ip_address":    monitor.ip_address,
            "traffic_type":  traffic_type.value,
            "risk_score":    risk_score,
            "markers":       markers,
            "justification": justification,
            "matched_rules": matched_rules,
        }

        if is_blocked:
            response["retry_after"] = retry_after
            response["message"] = (
                f"Rate limit exceeded. Traffic classified as "
                f"{traffic_type.value.upper()}. "
                f"Retry after {retry_after:.1f} seconds."
            )
        else:
            response["message"] = "Request admitted."

        return response

    def log_to_visual_dashboard(self, data: dict) -> None:
        ts  = time.strftime("%H:%M:%S", time.localtime(
              data.get("timestamp", time.time())))
        ip  = data.get("ip_address", "unknown")
        cls = data.get("traffic_type", "unknown").upper()
        dec = data.get("decision", "?")
        print(f"  [{ts}] {ip:<18} | {cls:<20} | {dec}")

    def get_log(self) -> list[dict]:
        return [e.to_dict() for e in self._log]

    def get_summary_metrics(self, monitors: dict) -> dict:
        total_accepted = sum(1 for e in self._log if e.allowed)
        total_blocked  = sum(1 for e in self._log if not e.allowed)
        total          = total_accepted + total_blocked

        rar = round(total_accepted / total, 4) if total > 0 else 1.0

        false_positives = sum(
            1 for e in self._log
            if not e.allowed and e.classification in ("normal", "bursty")
        )
        total_legit = sum(
            1 for e in self._log
            if e.classification in ("normal", "bursty")
        )
        fpr = round(false_positives / total_legit, 4) if total_legit > 0 else 0.0

        false_negatives = sum(
            1 for e in self._log
            if e.allowed and e.classification == "suspicious"
        )
        total_suspicious = sum(
            1 for e in self._log if e.classification == "suspicious"
        )
        fnr = round(false_negatives / total_suspicious, 4) \
              if total_suspicious > 0 else 0.0

        return {
            "total_requests": total,
            "total_accepted": total_accepted,
            "total_blocked":  total_blocked,
            "rar":            rar,
            "fpr":            fpr,
            "fnr":            fnr,
            "rar_percent":    round(rar  * 100, 2),
            "fpr_percent":    round(fpr  * 100, 2),
            "fnr_percent":    round(fnr  * 100, 2),
        }


# =============================================================================
# Helper — build matched_rules list
# =============================================================================

def _build_matched_rules(traffic_type: TrafficType, markers: dict) -> list:
    from heuristic_engine import (
        NORMAL_RATE_MAX, BURSTY_RATE_MAX,
        SUSPICIOUS_SIGMA, SUSPICIOUS_BURST, SUSPICIOUS_PERSIST,
        BURSTY_BURST_MIN, BURSTY_PERSIST_MIN,
    )

    rules   = []
    lam     = markers.get("lambda", 0.0)
    sigma   = markers.get("sigma")
    burst   = markers.get("burst_freq", 0)
    persist = markers.get("persistence", 0.0)

    if traffic_type == TrafficType.SUSPICIOUS_ABUSIVE:
        if lam > BURSTY_RATE_MAX:
            rules.append(
                f"HIGH_RATE: λ={lam:.2f} req/s > {BURSTY_RATE_MAX} req/s"
            )
        if sigma is not None and sigma < SUSPICIOUS_SIGMA:
            rules.append(
                f"ROBOTIC_TIMING: σ={sigma:.4f}s < {SUSPICIOUS_SIGMA}s"
            )
        if burst > SUSPICIOUS_BURST:
            rules.append(
                f"BURST_FLOOD: {burst} bursts/min > {SUSPICIOUS_BURST}/min"
            )
        if persist > SUSPICIOUS_PERSIST:
            rules.append(
                f"HIGH_PERSISTENCE: {persist:.1f}s > {SUSPICIOUS_PERSIST}s"
            )

    elif traffic_type == TrafficType.BURSTY_LEGITIMATE:
        if lam >= NORMAL_RATE_MAX:
            rules.append(
                f"ELEVATED_RATE: λ={lam:.2f} req/s in bursty range"
            )
        if burst >= BURSTY_BURST_MIN:
            rules.append(
                f"BURST_PATTERN: {burst} bursts/min in bursty range"
            )
        if persist >= BURSTY_PERSIST_MIN:
            rules.append(
                f"MODERATE_PERSISTENCE: {persist:.1f}s in bursty range"
            )

    else:
        rules.append(
            f"NORMAL_RATE: λ={lam:.2f} req/s within normal range"
        )
        if sigma is not None and sigma < 999:
            rules.append(
                f"HUMAN_TIMING: σ={sigma:.4f}s — natural timing variability"
            )

    return rules