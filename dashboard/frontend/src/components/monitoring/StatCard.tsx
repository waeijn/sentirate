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
  throughput: "#3b82f6",
  latency: "#8b5cf6",
  threats: "#ef4444",
  acceptance: "#22c55e",
};

export function StatCard({ data }: { data: StatCardData }) {
  const iconColor = ICON_COLORS[data.icon];

  return (
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
      {/* Subtle top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${iconColor}44, transparent)`,
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
          style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}
        >
          {data.label}
        </span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: `${iconColor}18`,
            border: `1px solid ${iconColor}33`,
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
          style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}
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
            style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }}
          >
            {data.link} →
          </span>
        )}
      </div>
    </div>
  );
}
