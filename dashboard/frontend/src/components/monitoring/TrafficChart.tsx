import { useState, useCallback, useMemo } from "react";
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
  normal: "#10b981", // Emerald Green
  bursty: "#f59e0b", // Amber
  suspicious: "#e11d48", // Rose Red
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const timeStr = typeof label === "number" 
    ? new Date(label).toLocaleTimeString([], { hour12: false }) 
    : label;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 16px",
        fontSize: 12,
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{timeStr}</div>
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

const LEGEND_COLORS = {
  normal: { color: "var(--normal)", bg: "var(--normal-dim)" },
  bursty: { color: "var(--bursty)", bg: "var(--bursty-dim)" },
  suspicious: { color: "var(--suspicious)", bg: "var(--suspicious-dim)" },
};

function ChartLegend({ percentages }: { percentages: Record<string, number> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {Object.entries(LEGEND_COLORS).map(([key, style]) => (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: style.bg,
            border: `1px solid ${style.bg}`,
            padding: "4px 10px",
            borderRadius: 12,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: style.color,
              boxShadow: `0 0 6px ${style.color}`,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: style.color,
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {key}: {percentages[key] || 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrafficChart({ data, uptime = 0 }: { data: TrafficPoint[], uptime?: number }) {
  const [pinned, setPinned] = useState<{ active: boolean; index?: number; payload?: any; label?: any; coord?: {x: number, y: number} }>({ active: false });

  const handleChartClick = useCallback((state: any) => {
    if (!state) return;
    if (pinned.active) {
      // Unpin on second click
      setPinned({ active: false });
    } else if (state.activeTooltipIndex != null) {
      setPinned({ 
        active: true, 
        index: state.activeTooltipIndex,
        payload: state.activePayload,
        label: state.activeLabel,
        coord: state.activeCoordinate
      });
    }
  }, [pinned.active]);

  const formatUptime = (seconds: number) => {
    if (seconds == null) return "Live";
    if (seconds < 60) return `Live (${seconds}s)`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `Live (${m}m ${s}s)`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `Live (${h}h ${min}m)`;
  };
  
  // Calculate percentages
  let totalNormal = 0;
  let totalBursty = 0;
  let totalSuspicious = 0;
  data.forEach((d) => {
    totalNormal += d.normal;
    totalBursty += d.bursty;
    totalSuspicious += d.suspicious;
  });
  const total = totalNormal + totalBursty + totalSuspicious;
  const percentages = {
    normal: total ? Math.round((totalNormal / total) * 100) : 0,
    bursty: total ? Math.round((totalBursty / total) * 100) : 0,
    suspicious: total ? Math.round((totalSuspicious / total) * 100) : 0,
  };

  const chartTicks = useMemo(() => {
    if (data.length < 2) return [];
    const min = data[0].time;
    const max = data[data.length - 1].time;
    const INTERVAL = 10_000; // 10-second snap
    const firstTick = Math.ceil(min / INTERVAL) * INTERVAL;
    const result: number[] = [];
    for (let t = firstTick; t <= max; t += INTERVAL) {
      result.push(t);
    }
    return result;
  }, [data]);

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "2px solid var(--glass-border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--card-shadow)",
        padding: 24,
      }}
    >
      {/* Header row — title left, controls right */}
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
            Classified by behavioral pattern — refreshes every 2s
          </p>
        </div>
        
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {/* Window Selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 12px",
              background: "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 11 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Window:
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 500 }}>
              <span style={{ color: "var(--accent)", background: "var(--accent-dim)", padding: "2px 8px", borderRadius: 4 }}>
                {formatUptime(uptime)}
              </span>
              
              
              
            </div>
          </div>
          
          {/* Legend */}
          <ChartLegend percentages={percentages} />
        </div>
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
        <div style={{ position: "relative", width: "100%", height: 280 }}><ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: "crosshair" }}
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
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={chartTicks}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour12: false })}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={false}
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
            <Tooltip content={!pinned.active ? <CustomTooltip /> : <></>} />

            <Area
              type="monotone"
              dataKey="normal"
              stroke={COLORS.normal}
              strokeWidth={2}
              fill="url(#gradNormal)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="linear"
            />
            <Area
              type="monotone"
              dataKey="bursty"
              stroke={COLORS.bursty}
              strokeWidth={2}
              fill="url(#gradBursty)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="linear"
            />
            <Area
              type="monotone"
              dataKey="suspicious"
              stroke={COLORS.suspicious}
              strokeWidth={2}
              fill="url(#gradSuspicious)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="linear"
            />
          </AreaChart>
        </ResponsiveContainer>{pinned.active && pinned.coord && (<div style={{ position: 'absolute', left: pinned.coord.x + 10, top: pinned.coord.y - 20, pointerEvents: 'none', zIndex: 100 }}><div style={{ position: 'absolute', top: -12, left: 12, background: 'var(--accent)', color: 'var(--bg)', fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px 4px 0 0', zIndex: 101 }}>PINNED</div><CustomTooltip active={true} payload={pinned.payload} label={pinned.label} /></div>)}</div>
      )}
    </div>
  );
}
