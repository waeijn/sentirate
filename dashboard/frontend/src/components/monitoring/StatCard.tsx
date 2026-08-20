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

// ── Figma-matching icon colors ─────────────────────────────────────────────
const ICON_COLORS = {
  throughput: "#6366f1",
  latency: "#8b5cf6",
  threats: "#f87171",
  acceptance: "#4ade80",
};

// ─── Classification Accuracy Modal ────────────────────────────────────────

interface AccuracyModalProps {
  onClose: () => void;
  analytics?: {
    fpr: number;
    fnr: number;
    tpr: number;
    tnr: number;
    accuracy: number;
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
  const fpr = analytics?.fpr ?? 2.1;
  const fnr = analytics?.fnr ?? 1.4;
  const tpr = analytics?.tpr ?? 98.6;
  const tnr = analytics?.tnr ?? 97.9;
  const accuracy = analytics?.accuracy ?? 98.2;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: "#1c1c24",
          border: "1px solid #2e2e3e",
          borderRadius: 14,
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
            background: "#252530",
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
              {fpr.toFixed(1)}%
            </span>
          </div>
          <AnalyticsBar value={fpr * 10} color="var(--bursty)" />
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            Out of all legitimate traffic, {fpr.toFixed(1)}% was incorrectly
            flagged as suspicious.
          </p>
        </div>

        {/* FNR */}
        <div
          style={{
            background: "#252530",
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
              {fnr.toFixed(1)}%
            </span>
          </div>
          <AnalyticsBar value={fnr * 10} color="var(--suspicious)" />
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            Out of all malicious traffic, {fnr.toFixed(1)}% slipped through
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
              value: `${tpr.toFixed(1)}%`,
              color: "var(--normal)",
            },
            {
              label: "True Negative\nRate",
              value: `${tnr.toFixed(1)}%`,
              color: "var(--normal)",
            },
            {
              label: "Overall\nAccuracy",
              value: `${accuracy.toFixed(1)}%`,
              color: "var(--normal)",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#252530",
                border: "1px solid #2e2e3e",
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
        className="fade-in"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          position: "relative",
          overflow: "hidden",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--border-light)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        }}
      >
        {/* Subtle top accent — very low opacity so it doesn't tint the card */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `${iconColor}66`,
          }}
        />

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
            }}
          >
            {data.label}
          </span>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: `${iconColor}14`,
              border: `1px solid ${iconColor}28`,
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
