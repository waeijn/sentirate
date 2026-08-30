import { StatCard } from "../components/monitoring/StatCard";
import { TrafficChart } from "../components/monitoring/TrafficChart";
import { RecentAlerts } from "../components/monitoring/RecentAlerts";
import type { StatCardData, TrafficPoint, Alert } from "../types";

interface MonitoringProps {
  stats: StatCardData[];
  chartData: TrafficPoint[];
  alerts: Alert[];
  analytics?: {
    fpr: number | null;
    fnr: number | null;
    tpr: number | null;
    tnr: number | null;
    accuracy: number | null;
  };
}

export function Monitoring({
  stats,
  chartData,
  alerts,
  analytics,
}: MonitoringProps) {
  return (
    <div
      style={{
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {/* Page header */}
      <div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 8,
            letterSpacing: -0.5,
          }}
        >
          Real-Time Monitoring
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>
          Live overview of your API traffic patterns and system health
        </p>
      </div>

      {/* Stat cards — pass analytics only to the acceptance rate card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
      >
        {stats.map((s, i) => (
          <div key={i} style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard
              data={s}
              analytics={s.icon === "acceptance" ? analytics : undefined}
            />
          </div>
        ))}
      </div>

      {/* Chart + Alerts */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}
      >
        <TrafficChart data={chartData} />
        <RecentAlerts alerts={alerts} />
      </div>
    </div>
  );
}
