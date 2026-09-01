import { useState } from "react";
import type { StatCardData } from "../../types";

const ICONS = {
  throughput: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  latency: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  threats: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  acceptance: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const ICON_COLORS = {
  throughput: "var(--accent)",
  latency: "var(--accent-2)",
  threats: "var(--suspicious)",
  acceptance: "var(--normal)",
};

const ICON_BGS = {
  throughput: "var(--accent-dim)",
  latency: "rgba(139, 92, 246, 0.12)", // accent-2 dim
  threats: "var(--suspicious-dim)",
  acceptance: "var(--normal-dim)",
};

const ICON_GLOWS = {
  throughput: "var(--accent-glow)",
  latency: "rgba(139, 92, 246, 0.15)", // accent-2 glow
  threats: "var(--suspicious-glow)",
  acceptance: "var(--normal-glow)",
};

// ─── Classification Accuracy Modal ────────────────────────────────────────

interface AccuracyModalProps {
  onClose: () => void;
  analytics?: {
    fpr: number | null;
    fnr: number | null;
    tpr: number | null;
    tnr: number | null;
    accuracy: number | null;
  };
}

function AnalyticsBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: 4,
        background: "var(--border)",
        borderRadius: 2,
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, value)}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.6s ease",
        }}
      />
    </div>
  );
}

function ClassificationAccuracyModal({
  onClose,
  analytics,
}: AccuracyModalProps) {
  const fpr = analytics?.fpr;
  const fnr = analytics?.fnr;
  const tpr = analytics?.tpr;
  const tnr = analytics?.tnr;
  const accuracy = analytics?.accuracy;

  return (
    <div
      onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          padding: 28,
          width: 440,
          maxWidth: "92vw",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              Classification Accuracy
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              False positive &amp; false negative analysis
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

        {/* FPR */}
        <div
          style={{
            background: "var(--bg-hover)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--bursty)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}
              >
                False Positive Rate (FPR)
              </span>
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--bursty)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {fpr != null ? `${fpr.toFixed(1)}%` : "N/A"}
            </span>
          </div>
          <AnalyticsBar value={fpr != null ? fpr * 10 : 0} color="var(--bursty)" />
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            Out of all legitimate traffic, {fpr != null ? `${fpr.toFixed(1)}%` : "N/A"} was incorrectly
            flagged as suspicious.
          </p>
        </div>

        {/* FNR */}
        <div
          style={{
            background: "var(--bg-hover)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--suspicious)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}
              >
                False Negative Rate (FNR)
              </span>
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--suspicious)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {fnr != null ? `${fnr.toFixed(1)}%` : "N/A"}
            </span>
          </div>
          <AnalyticsBar value={fnr != null ? fnr * 10 : 0} color="var(--suspicious)" />
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            Out of all malicious traffic, {fnr != null ? `${fnr.toFixed(1)}%` : "N/A"} slipped through
            without being detected.
          </p>
        </div>

        {/* Summary row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
          }}
        >
          {[
            {
              label: "True Positive\nRate",
              value: tpr != null ? `${tpr.toFixed(1)}%` : "N/A",
              color: "var(--normal)",
            },
            {
              label: "True Negative\nRate",
              value: tnr != null ? `${tnr.toFixed(1)}%` : "N/A",
              color: "var(--normal)",
            },
            {
              label: "Overall\nAccuracy",
              value: accuracy != null ? `${accuracy.toFixed(1)}%` : "N/A",
              color: "var(--normal)",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 8,
                  whiteSpace: "pre-line",
                  lineHeight: 1.4,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: item.color,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────

export function StatCard({
  data,
  analytics,
}: {
  data: StatCardData;
  analytics?: AccuracyModalProps["analytics"];
}) {
  const [showModal, setShowModal] = useState(false);
  const iconColor = ICON_COLORS[data.icon];

  return (
    <>
      {showModal && (
        <ClassificationAccuracyModal
          onClose={() => setShowModal(false)}
          analytics={analytics}
        />
      )}

      <div
        style={
          {
            "--card-glow": ICON_GLOWS[data.icon as keyof typeof ICON_GLOWS],
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            border: "2px solid var(--glass-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--card-shadow)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
            overflow: "hidden",
            transition: "border-color 0.2s",
          } as React.CSSProperties
        }
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--border-light)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)";
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {data.label}
          </span>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: ICON_BGS[data.icon as keyof typeof ICON_BGS],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: iconColor,
            }}
          >
            {ICONS[data.icon]}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
              letterSpacing: -1,
            }}
          >
            {data.value}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 400,
            }}
          >
            {data.unit}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: data.deltaPositive ? "var(--normal)" : "var(--suspicious)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              {data.deltaPositive ? (
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              ) : (
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              )}
            </svg>
            {data.delta}
          </span>
          {data.link && (
            <span
              onClick={() => setShowModal(true)}
              style={{
                fontSize: 11,
                color: "var(--accent)",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.7";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
            >
              {data.link} →
            </span>
          )}
        </div>
      </div>
    </>
  );
}
