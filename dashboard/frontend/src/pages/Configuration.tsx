/**
 * Configuration.tsx
 * ==================
 * Preset modes (Strict/Balanced/Lenient): derive all 3 profiles from
 *   global Token Bucket sliders × preset multipliers.
 *
 * Custom mode: each profile card gets its own independent Refill Rate
 *   and Bucket Capacity sliders (matching Figma design).
 *   Supports named saved profiles with Recently Saved list.
 *
 * Backend wiring:
 *   GET /api/config  → load current values on mount
 *   PUT /api/config  → apply on Save
 */

import { useState, useEffect, useCallback } from "react";

const BACKEND = "http://localhost:8050";

// ── Types ──────────────────────────────────────────────────────────────────

type PresetKey = "strict" | "balanced" | "lenient" | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  icon: string;
  tag: string;
  accentColor: string;
  accentDim: string;
  description: string;
  normalMult: { refill: number; capacity: number };
  burstyMult: { refill: number; capacity: number };
  suspiciousMult: { refill: number; capacity: number };
  normalRateMax: number;
  burstyRateMax: number;
  suspiciousSigma: number;
}

interface ProfileValues {
  refill: number;
  cap: number;
}
interface CustomProfiles {
  normal: ProfileValues;
  bursty: ProfileValues;
  suspicious: ProfileValues;
}

interface SavedProfile {
  id: string;
  name: string;
  profiles: CustomProfiles;
  savedAt: string;
}

type SaveStatus = "idle" | "saving" | "success" | "error";

// ── Presets ────────────────────────────────────────────────────────────────

const PRESETS: Preset[] = [
  {
    key: "strict",
    label: "Strict",
    icon: "⊘",
    tag: "Block Aggressively",
    accentColor: "#ef4444",
    accentDim: "rgba(239,68,68,0.12)",
    description:
      "Low tolerance — most unusual patterns are flagged. Best for high-security or internal APIs.",
    normalMult: { refill: 0.8, capacity: 0.8 },
    burstyMult: { refill: 1.5, capacity: 1.6 },
    suspiciousMult: { refill: 0.15, capacity: 0.2 },
    normalRateMax: 8,
    burstyRateMax: 20,
    suspiciousSigma: 0.15,
  },
  {
    key: "balanced",
    label: "Balanced",
    icon: "⚖",
    tag: "Recommended",
    accentColor: "#6366f1",
    accentDim: "rgba(99,102,241,0.12)",
    description:
      "Default setting — balances security with usability. Suitable for most production workloads.",
    normalMult: { refill: 1.0, capacity: 1.0 },
    burstyMult: { refill: 1.8, capacity: 2.0 },
    suspiciousMult: { refill: 0.25, capacity: 0.3 },
    normalRateMax: 10,
    burstyRateMax: 30,
    suspiciousSigma: 0.1,
  },
  {
    key: "lenient",
    label: "Lenient",
    icon: "◎",
    tag: "Allow Bursts",
    accentColor: "#22c55e",
    accentDim: "rgba(34,197,94,0.12)",
    description:
      "High tolerance — accommodates bursty traffic. Best for consumer-facing or high-traffic APIs.",
    normalMult: { refill: 1.2, capacity: 1.3 },
    burstyMult: { refill: 2.2, capacity: 2.5 },
    suspiciousMult: { refill: 0.4, capacity: 0.5 },
    normalRateMax: 15,
    burstyRateMax: 50,
    suspiciousSigma: 0.05,
  },
  {
    key: "custom",
    label: "Custom",
    icon: "≡",
    tag: "Manual",
    accentColor: "#8b5cf6",
    accentDim: "rgba(139,92,246,0.12)",
    description:
      "Full control — define named classifications that inherit the global token bucket settings.",
    normalMult: { refill: 1.0, capacity: 1.0 },
    burstyMult: { refill: 2.0, capacity: 2.0 },
    suspiciousMult: { refill: 0.2, capacity: 0.25 },
    normalRateMax: 10,
    burstyRateMax: 30,
    suspiciousSigma: 0.1,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function r1(n: number) {
  return Math.round(n * 10) / 10;
}
function r0(n: number) {
  return Math.round(n);
}
function burstWindow(refill: number, cap: number) {
  return refill <= 0 ? "∞" : `~${r1(cap / refill)}s`;
}
function deriveProfiles(
  baseR: number,
  baseC: number,
  p: Preset,
): CustomProfiles {
  return {
    normal: {
      refill: r1(baseR * p.normalMult.refill),
      cap: r0(baseC * p.normalMult.capacity),
    },
    bursty: {
      refill: r1(baseR * p.burstyMult.refill),
      cap: r0(baseC * p.burstyMult.capacity),
    },
    suspicious: {
      refill: r1(baseR * p.suspiciousMult.refill),
      cap: r0(baseC * p.suspiciousMult.capacity),
    },
  };
}
function nowString() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

// ── Reusable Slider ────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  color = "var(--accent)",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
          }}
        >
          {label}
        </span>
        <div
          style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              let val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                onChange(val);
              }
            }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              fontWeight: 600,
              color,
              background: "transparent",
              border: "none",
              outline: "none",
              width: "55px",
              textAlign: "right",
              padding: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {unit}
          </span>
        </div>
      </div>
      <div style={{ position: "relative", height: 6, marginBottom: 5 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 4,
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            borderRadius: 4,
            background: color,
            transition: "width 0.05s",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            opacity: 0,
            cursor: "pointer",
            height: "100%",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          {min} {unit}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

// ── Shared card sub-components ─────────────────────────────────────────────

function CardHeader({
  title,
  badge,
  tagline,
  color,
  dimColor,
  icon,
}: {
  title: string;
  badge: string;
  tagline: string;
  color: string;
  dimColor: string;
  icon: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--radius-sm)",
          background: dimColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 5,
            marginTop: 2,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color,
              background: dimColor,
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
            }}
          >
            {badge}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            {tagline}
          </span>
        </div>
      </div>
    </div>
  );
}

function ValueRow({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 600,
          color,
        }}
      >
        {value} <span style={{ fontSize: 10, opacity: 0.6 }}>{unit}</span>
      </span>
    </div>
  );
}

function BurstRow({
  refill,
  cap,
  color,
}: {
  refill: number;
  cap: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        paddingTop: 8,
        marginTop: 4,
        borderTop: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        Burst window
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color }}>
        {burstWindow(refill, cap)}
      </span>
    </div>
  );
}

// ── Profile Card — preset mode (read-only) ─────────────────────────────────

function ProfileCard({
  title,
  badge,
  tagline,
  color,
  dimColor,
  icon,
  refill,
  cap,
  multR,
  multC,
}: {
  title: string;
  badge: string;
  tagline: string;
  color: string;
  dimColor: string;
  icon: string;
  refill: number;
  cap: number;
  multR: number;
  multC: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: "var(--radius)",
        padding: "20px 18px",
      }}
    >
      <CardHeader
        title={title}
        badge={badge}
        tagline={tagline}
        color={color}
        dimColor={dimColor}
        icon={icon}
      />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        {multR}× refill · {multC}× capacity
      </div>
      <ValueRow label="Refill Rate" value={refill} unit="tok/s" color={color} />
      <ValueRow
        label="Bucket Capacity"
        value={cap}
        unit="tokens"
        color={color}
      />
      <BurstRow refill={refill} cap={cap} color={color} />
    </div>
  );
}

// ── Profile Card — custom mode (with sliders) ──────────────────────────────

function CustomProfileCard({
  title,
  badge,
  tagline,
  color,
  dimColor,
  icon,
  values,
  onChange,
}: {
  title: string;
  badge: string;
  tagline: string;
  color: string;
  dimColor: string;
  icon: string;
  values: ProfileValues;
  onChange: (v: ProfileValues) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: "var(--radius)",
        padding: "20px 18px",
      }}
    >
      <CardHeader
        title={title}
        badge={badge}
        tagline={tagline}
        color={color}
        dimColor={dimColor}
        icon={icon}
      />
      <Slider
        label="Refill Rate"
        value={values.refill}
        min={0}
        max={500}
        step={1}
        unit="tok/s"
        color={color}
        onChange={(v) => onChange({ ...values, refill: v })}
      />
      <Slider
        label="Bucket Capacity"
        value={values.cap}
        min={0}
        max={1000}
        step={1}
        unit="tokens"
        color={color}
        onChange={(v) => onChange({ ...values, cap: v })}
      />
      <BurstRow refill={values.refill} cap={values.cap} color={color} />
    </div>
  );
}

// ── Panel wrapper ──────────────────────────────────────────────────────────

function Panel({
  children,
  title,
  subtitle,
  iconBg,
  iconColor,
  iconChar,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  iconChar: string;
}) {
  return (
    <div
      className="glass-panel"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-md)",
        marginBottom: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "18px 28px",
          borderBottom: "1px solid var(--border)",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: iconColor,
          }}
        >
          {iconChar}
        </span>
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      <div style={{ padding: "28px 28px 20px" }}>{children}</div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function Configuration() {
  const [baseRefill, setBaseRefill] = useState(10);
  const [baseCap, setBaseCap] = useState(20);
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);

  const [customProfiles, setCustomProfiles] = useState<CustomProfiles>({
    normal: { refill: 10, cap: 20 },
    bursty: { refill: 20, cap: 40 },
    suspicious: { refill: 2, cap: 5 },
  });

  // ── Saved profiles (persisted in localStorage) ────────────────────────────
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("saved_profiles") ?? "[]");
    } catch {
      return [];
    }
  });
  const [saveName, setSaveName] = useState("");
  const [showSaveBox, setShowSaveBox] = useState(false);

  const persistSaved = (profiles: SavedProfile[]) => {
    setSavedProfiles(profiles);
    localStorage.setItem("saved_profiles", JSON.stringify(profiles));
  };

  const handleSaveProfile = () => {
    if (!saveName.trim()) return;
    const entry: SavedProfile = {
      id: Date.now().toString(),
      name: saveName.trim(),
      profiles: customProfiles,
      savedAt: nowString(),
    };
    persistSaved([entry, ...savedProfiles]);
    setSaveName("");
    setShowSaveBox(false);
  };

  const handleLoadProfile = (p: SavedProfile) => {
    setCustomProfiles(p.profiles);
    setPreset(PRESETS[3]);
  };

  const handleRemoveProfile = (id: string) => {
    persistSaved(savedProfiles.filter((p) => p.id !== id));
  };

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const derivedProfiles = deriveProfiles(baseRefill, baseCap, preset);
  const activeProfiles =
    preset.key === "custom" ? customProfiles : derivedProfiles;
  const isDirty = preset.key !== "balanced";
  const accentColor = preset.accentColor;

  // active saved profile name (most recently saved, for banner display)
  const activeSavedName =
    preset.key === "custom" && savedProfiles.length > 0
      ? savedProfiles[0].name
      : null;

  // ── Load from backend ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND}/api/config`)
      .then((r) => r.json())
      .then((data) => {
        const p = data.profiles;
        const nr = p?.normal?.refill_rate ?? 10;
        const nc = p?.normal?.capacity ?? 20;
        setBaseRefill(nr);
        setBaseCap(nc);
        setCustomProfiles({
          normal: {
            refill: p?.normal?.refill_rate ?? 10,
            cap: p?.normal?.capacity ?? 20,
          },
          bursty: {
            refill: p?.bursty?.refill_rate ?? 20,
            cap: p?.bursty?.capacity ?? 40,
          },
          suspicious: {
            refill: p?.suspicious?.refill_rate ?? 2,
            cap: p?.suspicious?.capacity ?? 5,
          },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePresetSelect = (p: Preset) => {
    if (p.key === "custom" && preset.key !== "custom") {
      setCustomProfiles(deriveProfiles(baseRefill, baseCap, preset));
    }
    setPreset(p);
    setSaveStatus("idle");
  };

  // ── Save to backend ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    const ap = activeProfiles;
    const payload = {
      normal_rate_max: preset.normalRateMax,
      bursty_rate_max: preset.burstyRateMax,
      suspicious_sigma: preset.suspiciousSigma,
      normal_refill: ap.normal.refill,
      normal_capacity: ap.normal.cap,
      bursty_refill: ap.bursty.refill,
      bursty_capacity: ap.bursty.cap,
      suspicious_refill: ap.suspicious.refill,
      suspicious_capacity: ap.suspicious.cap,
    };
    try {
      const res = await fetch(`${BACKEND}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveStatus("success");
        setSaveMsg("Configuration applied — active immediately.");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setSaveMsg(data.error ?? "Failed to apply.");
        setTimeout(() => setSaveStatus("idle"), 4000);
      }
    } catch {
      setSaveStatus("error");
      setSaveMsg("Cannot reach middleware — is the server running?");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [baseRefill, baseCap, preset, activeProfiles]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {/* Token Bucket panel — hidden in custom mode */}
      {preset.key !== "custom" && (
        <Panel
          title="Token Bucket"
          subtitle="Base refill rate and capacity — profile multipliers are applied below"
          iconBg="var(--accent-dim)"
          iconColor="var(--accent)"
          iconChar="⬡"
        >
          {loading && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              Loading from backend…
            </div>
          )}
          <Slider
            label="Refill Rate (r)"
            value={baseRefill}
            min={0}
            max={500}
            step={1}
            unit="req/s"
            color="linear-gradient(90deg,#6366f1,#8b5cf6)"
            onChange={setBaseRefill}
          />
          <Slider
            label="Bucket Capacity (b)"
            value={baseCap}
            min={0}
            max={1000}
            step={1}
            unit="tokens"
            color="linear-gradient(90deg,#6366f1,#8b5cf6)"
            onChange={setBaseCap}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Effective burst tolerance
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
              }}
            >
              {baseCap} tokens + {baseRefill} tok/s ={" "}
              <strong style={{ color: "var(--text)" }}>
                {burstWindow(baseRefill, baseCap)}
              </strong>
            </span>
          </div>
        </Panel>
      )}

      {/* Heuristic Sensitivity panel */}
      <Panel
        title="Heuristic Sensitivity"
        subtitle="Choose how aggressively traffic is classified — rate limits are always synced from the Token Bucket above"
        iconBg="var(--bursty-dim)"
        iconColor="var(--bursty)"
        iconChar="◈"
      >
        {/* Preset tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 0,
            marginBottom: 14,
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}
        >
          {PRESETS.map((p, i) => {
            const active = preset.key === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handlePresetSelect(p)}
                style={{
                  background: active ? "var(--bg-elevated)" : "transparent",
                  border: "none",
                  borderRight: i < 3 ? "1px solid var(--border)" : "none",
                  borderBottom: active
                    ? `2px solid ${p.accentColor}`
                    : "2px solid transparent",
                  padding: "14px 8px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {p.key === "balanced" && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: p.accentColor,
                      letterSpacing: "0.05em",
                    }}
                  >
                    Default
                  </span>
                )}
                <span
                  style={{
                    fontSize: 18,
                    color: active ? p.accentColor : "var(--text-muted)",
                    marginTop: p.key === "balanced" ? 8 : 0,
                  }}
                >
                  {p.icon}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: active ? p.accentColor : "var(--text-dim)",
                  }}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active preset description banner — pure dark bg, only colored left border */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 18px",
            marginBottom: 20,
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            border: "1px solid var(--glass-border)",
            borderLeft: `3px solid ${accentColor}`,
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <span style={{ fontSize: 18, marginTop: 1, color: accentColor }}>
            {preset.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: accentColor,
                }}
              >
                {preset.label} Mode
              </span>
              {/* Show saved profile name if in custom mode */}
              {activeSavedName && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-dim)",
                    borderBottom: `1px dashed ${accentColor}88`,
                    paddingBottom: 1,
                  }}
                >
                  {activeSavedName}
                </span>
              )}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: accentColor,
                  background: `${accentColor}22`,
                  padding: "1px 6px",
                  borderRadius: 3,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.06em",
                }}
              >
                {preset.tag}
              </span>
              {preset.key === "custom" && isDirty && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--bursty)",
                  }}
                >
                  ⊙ Unsaved changes
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.5,
              }}
            >
              {preset.description}
            </div>
          </div>
        </div>

        {/* Standard Profiles label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
            }}
          >
            Standard Profiles
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: accentColor,
              background: `${accentColor}18`,
              padding: "2px 8px",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {preset.key === "custom"
              ? "≡ Custom — independently configured"
              : "↔ Synced to Token Bucket"}
          </span>
        </div>

        {/* Profile cards */}
        <div style={{ display: "flex", gap: 16 }}>
          {preset.key === "custom" ? (
            <>
              <CustomProfileCard
                title="Normal Users"
                badge="Normal User"
                tagline="Standard baseline traffic"
                color="var(--normal)"
                dimColor="var(--normal-dim)"
                icon="👤"
                values={customProfiles.normal}
                onChange={(v) =>
                  setCustomProfiles((p) => ({ ...p, normal: v }))
                }
              />
              <CustomProfileCard
                title="Bursty Legitimate"
                badge="Bursty Legitimate"
                tagline="Burst-tolerant configuration"
                color="var(--bursty)"
                dimColor="var(--bursty-dim)"
                icon="⚡"
                values={customProfiles.bursty}
                onChange={(v) =>
                  setCustomProfiles((p) => ({ ...p, bursty: v }))
                }
              />
              <CustomProfileCard
                title="Suspicious / Abusive"
                badge="Suspicious / Abusive"
                tagline="Restricted enforcement mode"
                color="var(--suspicious)"
                dimColor="var(--suspicious-dim)"
                icon="⚠"
                values={customProfiles.suspicious}
                onChange={(v) =>
                  setCustomProfiles((p) => ({ ...p, suspicious: v }))
                }
              />
            </>
          ) : (
            <>
              <ProfileCard
                title="Normal Users"
                badge="Normal User"
                tagline="Standard baseline traffic"
                color="var(--normal)"
                dimColor="var(--normal-dim)"
                icon="👤"
                refill={derivedProfiles.normal.refill}
                cap={derivedProfiles.normal.cap}
                multR={preset.normalMult.refill}
                multC={preset.normalMult.capacity}
              />
              <ProfileCard
                title="Bursty Legitimate"
                badge="Bursty Legitimate"
                tagline="Burst-tolerant configuration"
                color="var(--bursty)"
                dimColor="var(--bursty-dim)"
                icon="⚡"
                refill={derivedProfiles.bursty.refill}
                cap={derivedProfiles.bursty.cap}
                multR={preset.burstyMult.refill}
                multC={preset.burstyMult.capacity}
              />
              <ProfileCard
                title="Suspicious / Abusive"
                badge="Suspicious / Abusive"
                tagline="Restricted enforcement mode"
                color="var(--suspicious)"
                dimColor="var(--suspicious-dim)"
                icon="⚠"
                refill={derivedProfiles.suspicious.refill}
                cap={derivedProfiles.suspicious.cap}
                multR={preset.suspiciousMult.refill}
                multC={preset.suspiciousMult.capacity}
              />
            </>
          )}
        </div>

        {/* Custom profiles section */}
        {preset.key === "custom" && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  Custom Profiles
                </span>
                {savedProfiles.length > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: accentColor,
                      background: `${accentColor}18`,
                      padding: "2px 7px",
                      borderRadius: 3,
                    }}
                  >
                    {savedProfiles.length} profile
                    {savedProfiles.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSaveBox((s) => !s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${accentColor}`,
                  background: `${accentColor}18`,
                  color: accentColor,
                  cursor: "pointer",
                }}
              >
                + New Custom Profile
              </button>
            </div>

            {/* Name input */}
            {showSaveBox && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Profile name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                  style={{
                    flex: 1,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "9px 14px",
                    color: "var(--text)",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  onClick={handleSaveProfile}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    padding: "7px 16px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: accentColor,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveBox(false);
                    setSaveName("");
                  }}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    padding: "7px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Recently Saved profiles */}
      {preset.key === "custom" && savedProfiles.length > 0 && (
        <div
          className="glass-panel"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--normal)", fontSize: 13 }}>✓</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              Recently Saved · {savedProfiles.length} Profile
              {savedProfiles.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div
            style={{
              padding: "8px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {savedProfiles.map((sp) => (
              <div
                key={sp.id}
                onClick={() => handleLoadProfile(sp)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    accentColor + "66")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border)")
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: accentColor,
                      display: "inline-block",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {sp.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 1,
                      }}
                    >
                      {sp.profiles.normal.refill} tok/s ·{" "}
                      {sp.profiles.normal.cap} tokens · {sp.savedAt}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: accentColor, fontSize: 14 }}>⊙</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProfile(sp.id);
                    }}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--suspicious)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 3,
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.opacity = "0.7")
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div
        className="glass-panel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            marginRight: "auto",
          }}
        >
          Reset sensitivity to a preset
        </span>

        {/* Preset shortcut buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          {PRESETS.filter((p) => p.key !== "custom").map((p) => (
            <button
              key={p.key}
              onClick={() => handlePresetSelect(p)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "5px 12px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${preset.key === p.key ? p.accentColor : "var(--border)"}`,
                background:
                  preset.key === p.key ? `${p.accentColor}18` : "transparent",
                color:
                  preset.key === p.key ? p.accentColor : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12 }}>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>

        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
            margin: "0 4px",
          }}
        />

        {/* Save status */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            minWidth: 180,
          }}
        >
          {saveStatus === "success" && (
            <span style={{ color: "var(--normal)" }}>✓ {saveMsg}</span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: "var(--suspicious)" }}>✗ {saveMsg}</span>
          )}
          {saveStatus === "saving" && (
            <span style={{ color: accentColor }}>… Sending to backend</span>
          )}
          {saveStatus === "idle" && (
            <span style={{ color: "var(--text-muted)" }}>
              {isDirty ? "Unsaved changes" : "No unsaved changes"}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 500,
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background:
              saveStatus === "saving" ? `${accentColor}88` : accentColor,
            color: "#fff",
            cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {saveStatus === "saving" ? "Applying…" : "Apply Changes"}
        </button>
      </div>
    </div>
  );
}
