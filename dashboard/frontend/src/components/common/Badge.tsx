import type { Classification, Action, AlertSeverity } from "../../types";

// ── Figma prototype badge styles ───────────────────────────────────────────
// Pill shape, no visible border, solid dim background, colored text
// Border radius is full pill (999px) not var(--radius-sm)

const CLASS_STYLES: Record<Classification, { bg: string; color: string }> = {
  normal: {
    bg: "var(--normal-dim)",
    color: "var(--normal)",
  },
  bursty: {
    bg: "var(--bursty-dim)",
    color: "var(--bursty)",
  },
  suspicious: {
    bg: "var(--suspicious-dim)",
    color: "var(--suspicious)",
  },
};

const ACTION_STYLES: Record<Action, { bg: string; color: string }> = {
  allowed: {
    bg: "var(--normal-dim)",
    color: "var(--normal)",
  },
  throttled: {
    bg: "var(--bursty-dim)",
    color: "var(--bursty)",
  },
  blocked: {
    bg: "var(--suspicious-dim)",
    color: "var(--suspicious)",
  },
};

const CLASS_LABELS: Record<Classification, string> = {
  normal: "Normal",
  bursty: "Bursty",
  suspicious: "Suspicious",
};

const ACTION_LABELS: Record<Action, string> = {
  allowed: "Allowed",
  throttled: "Throttled",
  blocked: "Blocked",
};

export function ClassBadge({ type }: { type: Classification }) {
  const s = CLASS_STYLES[type];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "var(--radius-sm)",
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {CLASS_LABELS[type]}
    </span>
  );
}

export function ActionBadge({ type }: { type: Action }) {
  const s = ACTION_STYLES[type];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "var(--radius-sm)",
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {ACTION_LABELS[type]}
    </span>
  );
}

export function AlertDot({ severity }: { severity: AlertSeverity }) {
  const colors: Record<AlertSeverity, string> = {
    info: "var(--accent)",
    success: "var(--normal)",
    warning: "var(--bursty)",
    error: "var(--suspicious)",
  };
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[severity],
        flexShrink: 0,
        display: "inline-block",
        boxShadow: `0 0 6px ${colors[severity]}`,
        animation: "pulse-dot 2s ease infinite",
      }}
    />
  );
}
