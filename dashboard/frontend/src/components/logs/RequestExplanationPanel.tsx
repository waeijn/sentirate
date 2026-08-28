import { ClassBadge, ActionBadge } from "../common/Badge";
import type { LogEntry, Classification } from "../../types";

interface RequestExplanationPanelProps {
  entry: LogEntry | null;
  onClose: () => void;
}

// ΓöÇΓöÇ Marker row with raw value display ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function markerLabel(
  marker: string,
  value: number,
  sigma?: number | null,
): string {
  if (marker === "Rate (╬╗)") {
    if (value > 30) return `Above suspicious threshold (> 30 req/s)`;
    if (value > 10) return `In bursty range (11ΓÇô30 req/s)`;
    return `Within normal range (Γëñ 10 req/s)`;
  }
  if (marker === "Sigma (╧â)") {
    if (sigma === null || sigma === undefined) return "Insufficient history";
    if (sigma < 0.1) return "Very low ΓÇö machine-like timing precision";
    if (sigma < 0.5) return "Low ΓÇö semi-regular timing";
    return "High ΓÇö natural human timing variability";
  }
  if (marker === "Burst Frequency") {
    if (value > 5) return `Above suspicious threshold (> 5/min)`;
    if (value >= 3) return `In bursty range (3ΓÇô5/min)`;
    return `Within normal range (0ΓÇô2/min)`;
  }
  if (marker === "Persistence") {
    if (value > 60) return `Above suspicious threshold (> 60s)`;
    if (value >= 5) return `In bursty range (5ΓÇô60s)`;
    return `Low ΓÇö brief activity (< 5s)`;
  }
  return "";
}

function markerColor(
  marker: string,
  value: number,
  sigma?: number | null,
): string {
  if (marker === "Rate (╬╗)") {
    return value > 30
      ? "var(--suspicious)"
      : value > 10
        ? "var(--bursty)"
        : "var(--normal)";
  }
  if (marker === "Sigma (╧â)") {
    if (sigma === null || sigma === undefined) return "var(--text-muted)";
    return sigma < 0.1
      ? "var(--suspicious)"
      : sigma < 0.5
        ? "var(--bursty)"
        : "var(--normal)";
  }
  if (marker === "Burst Frequency") {
    return value > 5
      ? "var(--suspicious)"
      : value >= 3
        ? "var(--bursty)"
        : "var(--normal)";
  }
  if (marker === "Persistence") {
    return value > 60
      ? "var(--suspicious)"
      : value >= 5
        ? "var(--bursty)"
        : "var(--normal)";
  }
  return "var(--normal)";
}

interface MarkerRowProps {
  label: string;
  value: number | null;
  max: number;
  unit: string;
  decimals?: number;
  sigma?: number | null; // passed for sigma-specific logic
}

function MarkerRow({
  label,
  value,
  max,
  unit,
  decimals = 2,
  sigma,
}: MarkerRowProps) {
  const displayValue = value ?? 0;
  const color = markerColor(label, displayValue, sigma ?? value);
  const pct = Math.min(100, (displayValue / max) * 100);
  const hint = markerLabel(label, displayValue, sigma ?? value);

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color,
            fontFamily: "var(--font-mono)",
          }}
        >
          {value === null ? "ΓÇö" : displayValue.toFixed(decimals)}
          {value !== null && (
            <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>
              {unit}
            </span>
          )}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 5,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        {hint}
      </p>
    </div>
  );
}

const CLASS_COLOR: Record<Classification, string> = {
  normal: "var(--normal)",
  bursty: "var(--bursty)",
  suspicious: "var(--suspicious)",
};

// ΓöÇΓöÇ Matched rules list ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function MatchedRules({ rules }: { rules: string[] }) {
  if (!rules || rules.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <h4
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 10,
          letterSpacing: 0.3,
        }}
      >
        Matched Rules
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rules.map((rule, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              lineHeight: 1.5,
            }}
          >
            {rule}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestExplanationPanel({
  entry,
  onClose,
}: RequestExplanationPanelProps) {
  return (
    <div
      style={{
        width: entry ? 340 : 0,
        minWidth: entry ? 340 : 0,
        transition: "width 0.25s ease, min-width 0.25s ease",
        overflow: "hidden",
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        borderLeft: entry ? "1px solid var(--border)" : "none",
      }}
    >
      {entry && (
        <>
          {/* Header */}
          <div
            style={{
              padding: "20px 20px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 3,
                }}
              >
                Request Explanation
              </h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Why this enforcement action was taken
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                transition: "color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-muted)";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {/* Meta rows */}
            {[
              { label: "Client IP", value: entry.clientIp },
              { label: "Timestamp", value: entry.timestamp },
            ].map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Classification
              </span>
              <ClassBadge type={entry.classification} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Action
              </span>
              <ActionBadge type={entry.action} />
            </div>

            <div
              style={{
                height: 1,
                background: "var(--border)",
                marginBottom: 18,
              }}
            />

            {/* Justification ΓÇö from backend if available, fallback otherwise */}
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 10,
                letterSpacing: 0.3,
              }}
            >
              Explanation
            </h4>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 18,
              }}
            >
              {entry.justification ||
                (entry.classification === "suspicious"
                  ? `Classified as Suspicious. One or more behavioral markers exceeded thresholds: rate ╬╗=${entry.requestRate.toFixed(1)} req/s, ╧â=${entry.sigma?.toFixed(3) ?? "N/A"}s, burst freq=${entry.burstFreq}/min, persistence=${entry.persistence.toFixed(1)}s. Token bucket restricted to r=${entry.refillRate} tok/s, b=${entry.bucketCapacity} tokens.`
                  : entry.classification === "bursty"
                    ? `Classified as Bursty Legitimate. Rate ╬╗=${entry.requestRate.toFixed(1)} req/s is in the elevated range (11ΓÇô30 req/s). Pattern is consistent with batch operations or app sync. Token bucket expanded to r=${entry.refillRate} tok/s, b=${entry.bucketCapacity} tokens.`
                    : `Classified as Normal. Rate ╬╗=${entry.requestRate.toFixed(1)} req/s is within the normal range (Γëñ 10 req/s). Default token bucket applied: r=${entry.refillRate} tok/s, b=${entry.bucketCapacity} tokens.`)}
            </p>

            {/* Matched rules */}
            <MatchedRules rules={entry.matchedRules} />

            <div
              style={{
                height: 1,
                background: "var(--border)",
                marginBottom: 18,
              }}
            />

            {/* Behavioral Markers ΓÇö raw values */}
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 16,
                letterSpacing: 0.3,
              }}
            >
              Behavioral Markers
            </h4>
            <MarkerRow
              label="Rate (╬╗)"
              value={entry.requestRate}
              max={100}
              unit="req/s"
              decimals={1}
            />
            <MarkerRow
              label="Sigma (╧â)"
              value={entry.sigma ?? 0}
              max={2.0}
              unit="s"
              decimals={3}
              sigma={entry.sigma}
            />
            <MarkerRow
              label="Burst Frequency"
              value={entry.burstFreq}
              max={10}
              unit="/min"
              decimals={0}
            />
            <MarkerRow
              label="Persistence"
              value={entry.persistence}
              max={60}
              unit="s"
              decimals={1}
            />

            <div
              style={{
                height: 1,
                background: "var(--border)",
                marginBottom: 14,
              }}
            />

            {/* Token bucket state */}
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 10,
                letterSpacing: 0.3,
              }}
            >
              Token Bucket State
            </h4>
            {[
              { label: "Refill Rate", value: `${entry.refillRate} tok/s` },
              { label: "Capacity", value: `${entry.bucketCapacity} tokens` },
              {
                label: "Tokens Remaining",
                value: `${entry.tokensRemaining.toFixed(1)}`,
              },
              {
                label: "Bucket Fill",
                value: `${entry.bucketFill.toFixed(0)}%`,
              },
              ...(entry.retryAfter > 0
                ? [
                    {
                      label: "Retry After",
                      value: `${entry.retryAfter.toFixed(1)}s`,
                    },
                  ]
                : []),
            ].map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 7,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: `2px solid ${CLASS_COLOR[entry.classification]}33`,
              background: `${CLASS_COLOR[entry.classification]}08`,
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Token bucket profile:{" "}
              <span
                style={{
                  color: CLASS_COLOR[entry.classification],
                  fontWeight: 600,
                }}
              >
                r={entry.refillRate} tok/s, b={entry.bucketCapacity} tokens
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
