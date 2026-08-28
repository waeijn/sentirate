interface TopBarProps {
  title: string;
  connected: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onResetState?: () => void;
}

export function TopBar({
  title,
  connected,
  isDark,
  onToggleTheme,
  onResetState,
}: TopBarProps) {
  return (
    <header
      style={{
        height: 52,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Title */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-dim)",
          letterSpacing: "0.01em",
          fontFamily: "var(--font-display)",
        }}
      >
        {title}
      </span>

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

        {/* Theme toggle — matches Figma sun/moon icon */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "5px 10px",
            borderRadius: "var(--radius-sm)",
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border-light)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border)";
          }}
        >
          {isDark ? (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>Light</span>
            </>
          ) : (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </>
          )}
        </button>

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
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
