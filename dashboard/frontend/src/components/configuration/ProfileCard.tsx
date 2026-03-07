import type { JSX } from "react";
import type { Classification } from "../../types";

interface ProfileCardProps {
  type: Classification;
  label: string;
  description: string;
  refillRate: number;
  bucketCapacity: number;
  onRefillChange: (v: number) => void;
  onCapacityChange: (v: number) => void;
}

const PROFILE_STYLES: Record<
  Classification,
  {
    color: string;
    bg: string;
    border: string;
    icon: JSX.Element;
  }
> = {
  normal: {
    color: "var(--normal)",
    bg: "var(--normal-dim)",
    border: "var(--normal)",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  bursty: {
    color: "var(--bursty)",
    bg: "var(--bursty-dim)",
    border: "var(--bursty)",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  suspicious: {
    color: "var(--suspicious)",
    bg: "var(--suspicious-dim)",
    border: "var(--suspicious)",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

function MiniSlider({
  label,
  value,
  min,
  max,
  unit,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: color,
          cursor: "pointer",
          height: 3,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{min}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{max}</span>
      </div>
    </div>
  );
}

export function ProfileCard({
  type,
  label,
  description,
  refillRate,
  bucketCapacity,
  onRefillChange,
  onCapacityChange,
}: ProfileCardProps) {
  const s = PROFILE_STYLES[type];

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${s.border}33`,
        borderRadius: "var(--radius)",
        padding: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: s.bg,
              color: s.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {s.icon}
          </div>
          <div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            >
              {label}
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}
            >
              {description}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: s.color,
            background: s.bg,
            border: `1px solid ${s.border}33`,
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          Editing
        </span>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <MiniSlider
          label="Refill Rate (r)"
          value={refillRate}
          min={5}
          max={500}
          unit="tok/s"
          color={s.color}
          onChange={onRefillChange}
        />
        <MiniSlider
          label="Bucket Capacity (b)"
          value={bucketCapacity}
          min={50}
          max={2000}
          unit="tokens"
          color={s.color}
          onChange={onCapacityChange}
        />
      </div>
    </div>
  );
}
