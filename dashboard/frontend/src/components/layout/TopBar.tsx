interface TopBarProps {
  breadcrumbs?: string[];
  title?: string;
  connected: boolean;
  onResetState?: () => void;
}

export function TopBar({
  breadcrumbs,
  title,
  connected,
  onResetState,
}: TopBarProps) {
  // Use explicit breadcrumbs if provided, else construct from title
  const crumbs = breadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs
    : ["Dashboard", title || "Overview"];

  return (
    <header
      style={{
        height: 60,
        boxSizing: "border-box",
        background: "var(--glass-bg)",
        borderBottom: "1px solid var(--border)",
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
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {idx > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    userSelect: "none",
                  }}
                >
                  /
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isLast ? 600 : 500,
                  color: isLast ? "var(--text)" : "var(--text-muted)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: isLast ? "-0.01em" : "0.01em",
                }}
              >
                {crumb}
              </span>
            </span>
          );
        })}
      </nav>

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
