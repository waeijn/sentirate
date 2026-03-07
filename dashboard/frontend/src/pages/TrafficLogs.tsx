import { useState } from "react";
import { LogsTable } from "../components/logs/LogsTable";
import { RequestExplanationPanel } from "../components/logs/RequestExplanationPanel";
import type { LogEntry } from "../types";

interface TrafficLogsProps {
  entries: LogEntry[];
}

export function TrafficLogs({ entries }: TrafficLogsProps) {
  const [selected, setSelected] = useState<LogEntry | null>(null);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Left: scrollable padded content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
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
            Traffic Logs &amp; Explainability
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Inspect individual requests and understand why enforcement actions
            were taken
          </p>
        </div>

        <LogsTable
          entries={entries}
          selected={selected}
          onSelect={setSelected}
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
