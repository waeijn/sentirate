import { useState } from "react";
import type { ReactNode } from "react";

type Page = "monitoring" | "logs" | "configuration";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const NAV_ITEMS: { id: Page; label: string; description: string; icon: ReactNode }[] = [
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Real-time throughput & alerts",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "logs",
    label: "Traffic Logs",
    description: "Traffic Metrics & Heuristics",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Token buckets & sensitivity",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    ),
  },
];

export function Sidebar({ activePage, onNavigate, isDark, setIsDark }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? 64 : "var(--sidebar-w)",
        minHeight: "100vh",
        /* ── Figma: sidebar is same black as main background ── */
        background: "var(--bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s ease",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "20px 0" : "20px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img src="/logo.png" alt="SentiRate Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        {!collapsed && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: 0.3,
              }}
            >
              Dashboard
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Overview
            </div>
          </div>
        )}
      </div>

      {/* Nav Label */}
      {!collapsed && (
        <div
          style={{
            padding: "16px 16px 8px",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Navigation
        </div>
      )}

      {/* Nav Items */}
      <nav
        style={{
          flex: 1,
          padding: "4px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "9px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: isActive ? "var(--accent)" : "transparent",
                color: isActive ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                width: "100%",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--bg-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
                }
              }}
            >
              <div style={{ flexShrink: 0 }}>{item.icon}</div>
              {!collapsed && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: isActive ? "rgba(255,255,255,0.8)" : "var(--text-dim)" }}>
                    {item.description}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle & Collapse */}
      <div style={{ padding: "16px 8px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
        {!collapsed && (
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--bg-elevated)", padding: 4 }}>
            <button
              onClick={() => setIsDark(false)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 0", border: "none", background: !isDark ? "var(--bg-hover)" : "transparent",
                color: !isDark ? "var(--text)" : "var(--text-muted)", fontSize: 12, fontWeight: !isDark ? 600 : 500,
                borderRadius: 4, cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              Light
            </button>
            <button
              onClick={() => setIsDark(true)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 0", border: "none", background: isDark ? "var(--bg-hover)" : "transparent",
                color: isDark ? "var(--text)" : "var(--text-muted)", fontSize: 12, fontWeight: isDark ? 600 : 500,
                borderRadius: 4, cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              Dark
            </button>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "8px 0" : "8px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 12,
            cursor: "pointer",
            width: "100%",
            borderRadius: "var(--radius-sm)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {collapsed ? (
              <polyline points="13 17 18 12 13 7" />
            ) : (
              <polyline points="11 17 6 12 11 7" />
            )}
            {collapsed ? (
              <polyline points="6 17 11 12 6 7" />
            ) : (
              <polyline points="18 17 13 12 18 7" />
            )}
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
        {!collapsed && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              padding: "8px 12px 0",
              opacity: 0.6,
            }}
          >
            v2.4.1
          </div>
        )}
      </div>
    </aside>
  );
}
