interface TokenBucketConfigProps {
  refillRate: number;
  bucketCapacity: number;
  onChange: (r: number, b: number) => void;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {label}
          </span>
          {hint && (
            <span
              title={hint}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "1px solid var(--border-light)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "var(--text-muted)",
                cursor: "help",
              }}
            >
              ?
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              width: 72,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              textAlign: "right",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
          accentColor: "var(--accent)",
          cursor: "pointer",
          height: 4,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {min} {unit}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

export function TokenBucketConfig({
  refillRate,
  bucketCapacity,
  onChange,
}: TokenBucketConfigProps) {
  const burstTolerance = (bucketCapacity / refillRate).toFixed(1);

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 28,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent)33",
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
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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
            Token Bucket Algorithm
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Baseline refill speed and burst capacity — used to seed
            classification presets
          </p>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Slider
          label="Refill Rate (r)"
          hint="Number of tokens added per second to the bucket"
          value={refillRate}
          min={10}
          max={500}
          unit="req/s"
          onChange={(r) => onChange(r, bucketCapacity)}
        />
        <Slider
          label="Bucket Capacity (b)"
          hint="Maximum number of tokens the bucket can hold (burst allowance)"
          value={bucketCapacity}
          min={50}
          max={1000}
          unit="tokens"
          onChange={(b) => onChange(refillRate, b)}
        />
      </div>

      {/* Effective burst tolerance */}
      <div
        style={{
          marginTop: 24,
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Effective burst tolerance
        </span>
        <span
          style={{
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            color: "var(--text)",
            fontWeight: 600,
          }}
        >
          {bucketCapacity} tokens + {refillRate} tok/s = ~{burstTolerance}s
        </span>
      </div>
    </div>
  );
}
