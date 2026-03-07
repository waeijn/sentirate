interface TopBarProps {
  title: string;
  connected: boolean;
}

export function TopBar({ title, connected }: TopBarProps) {
  return (
    <header
      style={{
        height: 52,
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
        {title}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "var(--normal)" : "var(--suspicious)",
              boxShadow: connected
                ? "0 0 8px var(--normal)"
                : "0 0 8px var(--suspicious)",
              display: "inline-block",
              animation: "pulse-dot 2s ease infinite",
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: connected ? "var(--normal)" : "var(--suspicious)",
            }}
          >
            {connected ? "System Online" : "Disconnected"}
          </span>
        </div>

        {/* Settings icon */}
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 6,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
        </button>
      </div>
    </header>
  );
}
