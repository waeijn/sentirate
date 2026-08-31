import { useState } from "react";
import type { Alert, AlertSeverity } from "../../types";
import { AlertDetailsPanel } from "./AlertDetailsPanel";

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
  onNavigateToLogs?: (ipFilter?: string, ipHighlight?: string) => void;
}

export function RecentAlerts({ alerts, onNavigateToLogs }: RecentAlertsProps) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  return (
    <>
      <div
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--card-shadow)",
        padding: 24,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--normal)", boxShadow: "0 0 8px var(--normal)" }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
            Live Security Stream
          </h2>
        </div>
        <div style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {alerts.length} events
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
          flex: 1,
          maxHeight: 400,
          paddingRight: 8, // space for scrollbar
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
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 16px",
                display: "flex",
                gap: 12,
                alignItems: "center",
                transition: "all 0.15s",
                cursor: "pointer",
              }}
              onClick={() => setSelectedAlert(alert)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              {/* Status Dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: s.color,
                  boxShadow: `0 0 8px ${s.color}`,
                  flexShrink: 0,
                }}
              />
              
              {/* Status Badge */}
              <div
                style={{
                  background: s.bg,
                  color: s.color,
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {alert.statusText}
              </div>

              {/* IP Address */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text)",
                  }}
                >
                  {alert.ip}
                </span>
              </div>

              {/* Timestamp */}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {alert.timestamp}
              </span>

              {/* Arrow Icon */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--bg-hover)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer Link */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <a href="#logs" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          View Full Logs
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </a>
      </div>
      </div>
      
      <AlertDetailsPanel 
        alert={selectedAlert} 
        onClose={() => setSelectedAlert(null)}
        onNavigateToLogs={onNavigateToLogs}
      />
    </>
  );
}
