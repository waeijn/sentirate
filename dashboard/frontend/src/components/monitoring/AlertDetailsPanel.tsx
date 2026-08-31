import type { Alert } from "../../types";

interface AlertDetailsPanelProps {
  alert: Alert | null;
  onClose: () => void;
  onNavigateToLogs?: (ipFilter?: string, ipHighlight?: string) => void;
}

export function AlertDetailsPanel({ alert, onClose, onNavigateToLogs }: AlertDetailsPanelProps) {
  if (!alert) return null;

  const isSuspicious = alert.statusText.toLowerCase() === "suspicious";
  const isBursty = alert.statusText.toLowerCase() === "bursty";
  
  // Figma-matching colors based on severity
  const color = isSuspicious ? "var(--suspicious)" : isBursty ? "var(--bursty)" : "var(--normal)";
  const bgDim = isSuspicious ? "var(--suspicious-dim)" : isBursty ? "var(--bursty-dim)" : "var(--normal-dim)";
  const titleText = isSuspicious ? "Suspicious traffic blocked" : isBursty ? "Bursty traffic throttled/expanded" : "Legitimate traffic allowed";
  const severityText = isSuspicious ? "Critical" : isBursty ? "Warning" : "Info";

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 40,
          animation: "fadeIn 0.2s ease-out forwards",
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
      
      {/* Slide-over panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 440,
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.3s ease-out forwards",
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        
        {/* Header */}
        <div style={{ padding: "24px 24px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: bgDim, display: "flex", alignItems: "center", justifyContent: "center", color }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                Security Event
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
                Alert Details
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: "var(--bg-hover)", border: "none", width: 28, height: 28, borderRadius: "50%", 
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", cursor: "pointer" 
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Main Status Block */}
          <div style={{ background: bgDim, border: `1px solid ${color}`, borderRadius: "var(--radius-sm)", padding: "16px 20px" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
              {titleText}
            </span>
          </div>

          {/* Grid Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Severity
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                {severityText}
              </div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Timestamp
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                {alert.timestamp}
              </div>
            </div>
          </div>

          {/* IP Address Row */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              Originating IP Address
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                {alert.ip}
              </span>
              <button 
                onClick={() => navigator.clipboard.writeText(alert.ip)}
                style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
            </div>
          </div>

          {/* Analysis Row */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/></svg>
              Impact & Mitigation Analysis
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
              {alert.message}
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div style={{ padding: 24, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
          <button 
            onClick={() => {
              if (onNavigateToLogs) onNavigateToLogs(alert.ip);
              onClose();
            }}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }} 
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-2)"} 
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
          >
            Filter Logs by {alert.ip}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          
          <button 
            onClick={() => {
              if (onNavigateToLogs) onNavigateToLogs(undefined, alert.ip);
              onClose();
            }}
            style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }} 
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} 
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Inspect Traffic Diagnostics
          </button>
        </div>
      </div>
    </>
  );
}
