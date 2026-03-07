interface MiniBarProps {
  value: number; // 0–1
  color?: string;
}

export function MiniBar({ value, color }: MiniBarProps) {
  const clamped = Math.min(1, Math.max(0, value));

  // Auto-color based on value if not provided
  const autoColor =
    clamped > 0.7
      ? "var(--suspicious)"
      : clamped > 0.4
        ? "var(--bursty)"
        : "var(--normal)";

  const barColor = color ?? autoColor;

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped * 100}%`,
            background: barColor,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          fontFamily: "var(--font-mono)",
          width: 32,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {clamped.toFixed(2)}
      </span>
    </div>
  );
}
