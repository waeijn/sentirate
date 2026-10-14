import { useEffect } from "react";

interface ConfigWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfigWarningModal({
  isOpen,
  onConfirm,
  onCancel,
}: ConfigWarningModalProps) {
  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(245, 158, 11, 0.35)",
          borderRadius: "var(--radius)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          padding: "26px 28px",
          width: 480,
          maxWidth: "94vw",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.75), 0 0 30px rgba(245, 158, 11, 0.12)",
        }}
      >
        {/* Header with Icon and Close Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f59e0b",
              flexShrink: 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <button
            onClick={onCancel}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Title and Subtitle */}
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            marginBottom: 6,
            letterSpacing: "-0.02em",
          }}
        >
          Warning: Live Configuration
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          You are navigating to the live algorithm configuration view. Parameters modified here take effect <strong style={{ color: "var(--text)" }}>immediately at runtime without restarting the server</strong>.
        </p>

        {/* Warning Bullet Points Box */}
        <div
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.22)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 16px",
            marginBottom: 22,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#f59e0b", fontSize: 13, marginTop: 1 }}>⚡</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "var(--text)" }}>Immediate Enforcement:</strong> Token bucket refill rates and burst capacities update active client limits in real time.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#f59e0b", fontSize: 13, marginTop: 1 }}>🛡</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "var(--text)" }}>False Positive Risk:</strong> Overly restrictive heuristic thresholds can cause legitimate users to be throttled or blocked.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#f59e0b", fontSize: 13, marginTop: 1 }}>⚙</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "var(--text)" }}>Profile Constraints:</strong> Capacity and refill rates must satisfy the hierarchy: <em>Suspicious &lt; Normal &lt; Bursty</em>.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: "9px 20px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "none";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            Proceed to Configuration
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
