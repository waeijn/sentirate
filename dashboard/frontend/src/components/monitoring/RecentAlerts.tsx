import type { Alert, AlertSeverity } from "../../types";

// ── Figma-matching alert styles ────────────────────────────────────────────
// Dark solid backgrounds, not glowing — keeps the overall dark theme clean
const SEVERITY_STYLES: Record<
  AlertSeverity,
  { color: string; bg: string; border: string; icon: string }
> = {
  info: {
    color: "var(--accent)",
    bg: "var(--accent-dim)",
    border: "var(--accent-dim)",
    icon: "i",
  },
  success: {
    color: "var(--normal)",
    bg: "var(--normal-dim)",
    border: "var(--normal-glow)",
    icon: "✓",
  },
  warning: {
    color: "var(--bursty)",
    bg: "var(--bursty-dim)",
    border: "var(--bursty-glow)",
    icon: "⚠",
  },
  error: {
    color: "var(--suspicious)",
    bg: "var(--suspicious-dim)",
    border: "var(--suspicious-glow)",
    icon: "✕",
  },
};

interface RecentAlertsProps {
  alerts: Alert[];
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minHeight: 340,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
          Recent Alerts
        </h2>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Auto-updates
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {alerts.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              padding: "40px 0",
            }}
          >
            No alerts yet
          </div>
        )}
        {alerts.map((alert) => {
          const s = SEVERITY_STYLES[alert.severity];
          return (
            <div
              key={alert.id}
              className="fade-in"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: s.color,
                  flexShrink: 0,
                  marginTop: 1,
                  width: 14,
                  textAlign: "center",
                }}
              >
                {s.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  {alert.message}
                </p>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {alert.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
