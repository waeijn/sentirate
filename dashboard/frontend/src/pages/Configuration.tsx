import { useState } from "react";
import { TokenBucketConfig } from "../components/configuration/TokenBucketConfig";
import { HeuristicSensitivity } from "../components/configuration/HeuristicSensitivity";
import type { SensitivityPreset } from "../types";

export function Configuration() {
  const [refillRate, setRefillRate] = useState(150);
  const [bucketCapacity, setBucketCapacity] = useState(300);
  const [preset, setPreset] = useState<SensitivityPreset>("balanced");
  const [saved, setSaved] = useState(false);

  const [profiles, setProfiles] = useState({
    normal: { refillRate: 150, bucketCapacity: 300 },
    bursty: { refillRate: 270, bucketCapacity: 600 },
    suspicious: { refillRate: 38, bucketCapacity: 75 },
  });

  const handleProfileChange = (
    type: "normal" | "bursty" | "suspicious",
    key: "refillRate" | "bucketCapacity",
    value: number,
  ) => {
    setProfiles((prev) => ({
      ...prev,
      [type]: { ...prev[type], [key]: value },
    }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 6,
            }}
          >
            Configuration
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Tune the token bucket algorithm and heuristic classification
            sensitivity
          </p>
        </div>
        <button
          onClick={handleSave}
          style={{
            background: saved ? "var(--normal)" : "var(--accent)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            cursor: "pointer",
            transition: "background 0.25s",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {saved ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {/* Token Bucket */}
      <TokenBucketConfig
        refillRate={refillRate}
        bucketCapacity={bucketCapacity}
        onChange={(r, b) => {
          setRefillRate(r);
          setBucketCapacity(b);
        }}
      />

      {/* Heuristic Sensitivity */}
      <HeuristicSensitivity
        preset={preset}
        onPresetChange={(p) => {
          setPreset(p);
        }}
        profiles={profiles}
        onProfileChange={handleProfileChange}
      />
    </div>
  );
}
