import { useState } from "react";
import { LogsTable } from "../components/logs/LogsTable";
import { RequestExplanationPanel } from "../components/logs/RequestExplanationPanel";
import { ExportReportDropdown } from "../components/logs/ExportReportDropdown";
import type { LogEntry } from "../types";

interface TrafficLogsProps {
  entries: LogEntry[];
  initialSearch?: string;
  highlightIp?: string;
}

export function TrafficLogs({ entries, initialSearch, highlightIp }: TrafficLogsProps) {
  const [selected, setSelected] = useState<LogEntry | null>(null);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Left: scrollable padded content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Traffic Logs &amp; Explainability
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Inspect individual requests and understand why enforcement actions
              were taken
            </p>
          </div>
          <ExportReportDropdown entries={entries} />
        </div>

        <LogsTable
          entries={entries}
          selected={selected}
          onSelect={setSelected}
          initialSearch={initialSearch}
          highlightIp={highlightIp}
        />
      </div>

      {/* ── Right: full-height drawer, flush to edge ── */}
      <RequestExplanationPanel
        entry={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
