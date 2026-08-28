import { useState } from "react";
import { ClassBadge, ActionBadge } from "../common/Badge";
import type { LogEntry } from "../../types";

interface LogsTableProps {
  entries: LogEntry[];
  selected: LogEntry | null;
  onSelect: (entry: LogEntry | null) => void;
}

// ΓöÇΓöÇ Mini value bar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function ValueBar({
  value,
  max,
  color,
  unit,
  decimals = 2,
}: {
  value: number;
  max: number;
  color: string;
  unit: string;
  decimals?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          color,
          minWidth: 52,
          textAlign: "right",
        }}
      >
        {value.toFixed(decimals)}
        <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 2 }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

function SigmaBar({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        ΓÇö
      </span>
    );
  }
  const color =
    value < 0.1
      ? "var(--suspicious)"
      : value < 0.5
        ? "var(--bursty)"
        : "var(--normal)";
  return (
    <ValueBar value={value} max={2.0} color={color} unit="s" decimals={3} />
  );
}

// ΓöÇΓöÇ Pill toggle button (matches Figma prototype style) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        padding: "5px 14px",
        borderRadius: 20,
        border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
        background: active ? "var(--text)" : "transparent",
        color: active ? "var(--bg)" : "var(--text-muted)",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const COL_HEADERS = [
  { label: "Timestamp", centered: false },
  { label: "Client IP", centered: false },
  { label: "Rate (╬╗)", centered: false },
  { label: "Sigma (╧â)", centered: false },
  { label: "Burst Freq", centered: false },
  { label: "Persistence", centered: false },
  { label: "Classification", centered: false },
  { label: "Action", centered: false },
  { label: "Details", centered: true },
];

export function LogsTable({ entries, selected, onSelect }: LogsTableProps) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = entries.filter((e) => {
    const matchesSearch =
      e.clientIp.includes(search) ||
      e.timestamp.includes(search) ||
      e.classification.includes(search.toLowerCase());
    const matchesClass =
      classFilter === "all" || e.classification === classFilter;
    const matchesAction = actionFilter === "all" || e.action === actionFilter;
    return matchesSearch && matchesClass && matchesAction;
  });

  const toggle = (entry: LogEntry) =>
    onSelect(selected?.id === entry.id ? null : entry);

  // ΓöÇΓöÇ active filter count badge on the Filters button ΓöÇΓöÇ
  const activeFilterCount =
    (classFilter !== "all" ? 1 : 0) + (actionFilter !== "all" ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ΓöÇΓöÇ Toolbar ΓöÇΓöÇ */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 14px",
            flex: 1,
            maxWidth: 320,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by IP or timestamp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 13,
              flex: 1,
            }}
          />
        </div>

        {/* Filters toggle button */}
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${filtersOpen ? "var(--text)" : "var(--border)"}`,
            background: filtersOpen ? "var(--text)" : "transparent",
            color: filtersOpen ? "var(--bg)" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {/* funnel icon */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                background: filtersOpen ? "var(--bg)" : "var(--accent)",
                color: filtersOpen ? "var(--text)" : "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 10,
                padding: "1px 6px",
                lineHeight: 1.6,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ΓöÇΓöÇ Expandable filter panel ΓöÇΓöÇ */}
      {filtersOpen && (
        <div
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "16px 20px",
            display: "flex",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          {/* Classification group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Classification
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", "normal", "bursty", "suspicious"].map((key) => (
                <PillButton
                  key={key}
                  active={classFilter === key}
                  onClick={() => setClassFilter(key)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </PillButton>
              ))}
            </div>
          </div>

          {/* Action group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Action
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", "allowed", "throttled", "blocked"].map((key) => (
                <PillButton
                  key={key}
                  active={actionFilter === key}
                  onClick={() => setActionFilter(key)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </PillButton>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={() => {
                  setClassFilter("all");
                  setActionFilter("all");
                }}
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px 0",
                  textDecoration: "underline",
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ΓöÇΓöÇ Table ΓöÇΓöÇ */}
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {COL_HEADERS.map((h) => (
                  <th
                    key={h.label}
                    style={{
                      padding: "11px 14px",
                      textAlign: h.centered ? "center" : "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      whiteSpace: "nowrap",
                      background: "var(--bg-elevated)",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "48px 16px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}
                  >
                    {entries.length === 0
                      ? "No log entries yet ΓÇö start a simulation"
                      : "No results match your search"}
                  </td>
                </tr>
              )}
              {filtered.map((entry) => {
                const isSelected = selected?.id === entry.id;
                const rateColor =
                  entry.requestRate > 30
                    ? "var(--suspicious)"
                    : entry.requestRate > 10
                      ? "var(--bursty)"
                      : "var(--normal)";
                const burstColor =
                  entry.burstFreq > 5
                    ? "var(--suspicious)"
                    : entry.burstFreq >= 3
                      ? "var(--bursty)"
                      : "var(--normal)";
                const persistColor =
                  entry.persistence > 15
                    ? "var(--suspicious)"
                    : entry.persistence >= 5
                      ? "var(--bursty)"
                      : "var(--normal)";

                return (
                  <tr
                    key={entry.id}
                    onClick={() => toggle(entry)}
                    style={{
                      borderBottom: "1px solid var(--border)22",
                      background: isSelected
                        ? "var(--bg-hover)"
                        : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      borderLeft: isSelected
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-dim)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.timestamp}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.clientIp}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ValueBar
                        value={entry.requestRate}
                        max={100}
                        color={rateColor}
                        unit="req/s"
                        decimals={1}
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <SigmaBar value={entry.sigma} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ValueBar
                        value={entry.burstFreq}
                        max={10}
                        color={burstColor}
                        unit="/min"
                        decimals={0}
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ValueBar
                        value={entry.persistence}
                        max={60}
                        color={persistColor}
                        unit="s"
                        decimals={1}
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ClassBadge type={entry.classification} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ActionBadge type={entry.action} />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(entry);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: isSelected
                            ? "var(--accent)"
                            : "var(--text-muted)",
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 4,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.color =
                              "var(--text-muted)";
                        }}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
          }}
        >
          Showing {filtered.length} of {entries.length} entries
          {selected && (
            <span style={{ marginLeft: 12, color: "var(--accent)" }}>
              ┬╖ {selected.clientIp} selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
