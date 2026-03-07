import type { Classification, Action, AlertSeverity } from "../../types";

const CLASS_STYLES: Record<
  Classification,
  { bg: string; color: string; border: string }
> = {
  normal: {
    bg: "var(--normal-dim)",
    color: "var(--normal)",
    border: "var(--normal)",
  },
  bursty: {
    bg: "var(--bursty-dim)",
    color: "var(--bursty)",
    border: "var(--bursty)",
  },
  suspicious: {
    bg: "var(--suspicious-dim)",
    color: "var(--suspicious)",
    border: "var(--suspicious)",
  },
};

const ACTION_STYLES: Record<
  Action,
  { bg: string; color: string; border: string }
> = {
  allowed: {
    bg: "var(--normal-dim)",
    color: "var(--normal)",
    border: "var(--normal)",
  },
  throttled: {
    bg: "var(--bursty-dim)",
    color: "var(--bursty)",
    border: "var(--bursty)",
  },
  blocked: {
    bg: "var(--suspicious-dim)",
    color: "var(--suspicious)",
    border: "var(--suspicious)",
  },
};

export function ClassBadge({ type }: { type: Classification }) {
  const s = CLASS_STYLES[type];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}44`,
        borderRadius: "var(--radius-sm)",
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {type === "suspicious"
        ? "Suspicious"
        : type.charAt(0).toUpperCase() + type.slice(1)}
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
        border: `1px solid ${s.border}44`,
        borderRadius: "var(--radius-sm)",
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
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
