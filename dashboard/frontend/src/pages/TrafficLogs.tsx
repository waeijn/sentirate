import { LogsTable } from "../components/logs/LogsTable";
import type { LogEntry } from "../types";

interface TrafficLogsProps {
  entries: LogEntry[];
}

export function TrafficLogs({ entries }: TrafficLogsProps) {
  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        height: "100%",
      }}
    >
      {/* Page header */}
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Traffic Logs & Explainability
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Inspect individual requests and understand why enforcement actions
          were taken
        </p>
      </div>

      <LogsTable entries={entries} />
    </div>
  );
}
