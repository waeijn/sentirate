import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TrafficPoint } from "../../types";

// ── Figma-exact colors ────────────────────────────────────────────────────
const COLORS = {
  normal: "#30D158",
  bursty: "#FF9F0A",
  suspicious: "#FF453A",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div
          key={p.dataKey}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          <span
            style={{ color: "var(--text-dim)", textTransform: "capitalize" }}
          >
            {p.dataKey}:
          </span>
          <span
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
            }}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Custom legend — top right, matching Figma ─────────────────────────────
function ChartLegend() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      {Object.entries(COLORS).map(([key, color]) => (
        <div
          key={key}
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              textTransform: "capitalize",
            }}
          >
            {key}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  return (
    <div
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-md)",
        padding: 24,
      }}
    >
      {/* Header row — title left, legend right (matches Figma) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            API Traffic Over Time
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Classified by behavioral pattern — refreshes every 5s
          </p>
        </div>
        <ChartLegend />
      </div>

      {data.length === 0 ? (
        <div
          style={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 13,
            flexDirection: "column",
            gap: 8,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Waiting for traffic data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.normal} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.normal} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradBursty" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.bursty} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.bursty} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={COLORS.suspicious}
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor={COLORS.suspicious}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="normal"
              stroke={COLORS.normal}
              strokeWidth={2}
              fill="url(#gradNormal)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bursty"
              stroke={COLORS.bursty}
              strokeWidth={2}
              fill="url(#gradBursty)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="suspicious"
              stroke={COLORS.suspicious}
              strokeWidth={2}
              fill="url(#gradSuspicious)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
