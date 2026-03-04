import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TrafficPoint } from "../../types";

interface TrafficChartProps {
  data: TrafficPoint[];
}

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

export function TrafficChart({ data }: TrafficChartProps) {
  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 16,
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
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradBursty" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              formatter={(value) => (
                <span
                  style={{
                    color: "var(--text-dim)",
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey="normal"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#gradNormal)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="bursty"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gradBursty)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="suspicious"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gradSuspicious)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
