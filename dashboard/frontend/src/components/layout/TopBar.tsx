interface TopBarProps {
  title: string;
  connected: boolean;
  onResetState?: () => void;
}

export function TopBar({
  title,
  connected,
  onResetState,
}: TopBarProps) {
  return (
    <header
      style={{
        height: 52,
        background: "var(--glass-bg)",
        borderBottom: "1px solid var(--glass-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        zIndex: 5,
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-display)",
          }}
        >
          SentiRate
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-muted)",
            letterSpacing: "0.01em",
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Connection status — matches Figma green dot + "System Online" */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "var(--normal)" : "var(--suspicious)",
              boxShadow: connected
                ? "0 0 0 2px var(--normal-glow), 0 0 8px var(--normal)"
                : "0 0 0 2px var(--suspicious-glow), 0 0 8px var(--suspicious)",
              display: "inline-block",
              animation: "pulse-dot 2.5s ease infinite",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: connected ? "var(--normal)" : "var(--suspicious)",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.01em",
            }}
          >
            {connected ? "System Online" : "Disconnected"}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />

        {/* Reset Metrics */}
        {onResetState && (
          <button
            onClick={onResetState}
            title="Reset all backend metrics and clear charts"
            style={{
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              color: "var(--suspicious)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              fontWeight: 600,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--border)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          >
            Reset Metrics
          </button>
        )}
      </div>
    </header>
  );
}
