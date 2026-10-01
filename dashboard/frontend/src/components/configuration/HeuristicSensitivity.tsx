import type { SensitivityPreset } from "../../types";
import { ProfileCard } from "./ProfileCard";

interface HeuristicSensitivityProps {
  preset: SensitivityPreset;
  onPresetChange: (p: SensitivityPreset) => void;
  profiles: {
    normal: { refillRate: number; bucketCapacity: number };
    bursty: { refillRate: number; bucketCapacity: number };
    suspicious: { refillRate: number; bucketCapacity: number };
  };
  onProfileChange: (
    type: "normal" | "bursty" | "suspicious",
    key: "refillRate" | "bucketCapacity",
    value: number,
  ) => void;
}

const PRESETS: { id: SensitivityPreset; label: string; description: string }[] =
  [
    { id: "strict", label: "Strict", description: "Low tolerance" },
    { id: "balanced", label: "Balanced", description: "Default" },
    { id: "lenient", label: "Lenient", description: "High tolerance" },
    { id: "custom", label: "Custom", description: "Manual" },
  ];

const PROFILE_META = {
  normal: {
    label: "Normal User Profile",
    description: "Standard baseline traffic",
  },
  bursty: {
    label: "Bursty Legitimate...",
    description: "Burst-tolerant configuration",
  },
  suspicious: {
    label: "Suspicious Profile",
    description: "Restricted enforcement mode",
  },
};

export function HeuristicSensitivity({
  preset,
  onPresetChange,
  profiles,
  onProfileChange,
}: HeuristicSensitivityProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Section header */}
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--bursty-glow)",
              border: "1px solid var(--bursty)33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--bursty)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <div>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              Heuristic Sensitivity
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Choose a preset or switch to Custom to independently tune each
              traffic classification
            </p>
          </div>
        </div>

        {/* Preset tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}
        >
          {PRESETS.map((p, i) => {
            const isActive = preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onPresetChange(p.id)}
                style={{
                  padding: "14px 12px",
                  border: "none",
                  borderRight:
                    i < PRESETS.length - 1 ? "1px solid var(--border)" : "none",
                  background: isActive
                    ? "var(--bg-hover)"
                    : "var(--bg-elevated)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  position: "relative",
                  transition: "background 0.15s",
                }}
              >
                {p.id === "balanced" && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 9,
                      color: "var(--accent)",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    Default
                  </span>
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isActive ? "var(--accent)" : "var(--text-muted)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom active notice */}
        {preset === "custom" && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#1e2d42",
              border: "1px solid var(--accent)22",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--accent-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                Custom Profile Active{" "}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "var(--bg)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  marginLeft: 4,
                }}
              >
                Manual
              </span>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Full control — configure each classification's limits
                independently.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile cards */}
      {preset === "custom" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          {(["normal", "bursty", "suspicious"] as const).map((type) => (
            <ProfileCard
              key={type}
              type={type}
              label={PROFILE_META[type].label}
              description={PROFILE_META[type].description}
              refillRate={profiles[type].refillRate}
              bucketCapacity={profiles[type].bucketCapacity}
              onRefillChange={(v) => onProfileChange(type, "refillRate", v)}
              onCapacityChange={(v) =>
                onProfileChange(type, "bucketCapacity", v)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
