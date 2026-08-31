import { useState, useRef, useEffect } from "react";
import type { LogEntry } from "../../types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function ExportReportDropdown({ entries }: { entries: LogEntry[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const exportCSV = () => {
    const headers = [
      "Timestamp",
      "Source IP Address",
      "Request Rate (req/s)",
      "Interval Jitter (sigma)",
      "Burst Frequency (per min)",
      "Burst Persistence (s)",
      "Assigned Traffic Profile",
      "Token Bucket Fill (%)",
      "Token Bucket Capacity",
      "Tokens Remaining",
      "Final Action"
    ];

    const rows = entries.map((entry) => {
      return [
        entry.timestamp,
        entry.clientIp,
        entry.requestRate.toFixed(2),
        entry.sigma !== null ? entry.sigma.toFixed(3) : "N/A",
        entry.burstFreq.toFixed(1),
        entry.persistence.toFixed(1),
        entry.classification,
        entry.bucketFill.toFixed(1),
        entry.bucketCapacity,
        entry.tokensRemaining,
        entry.action,
      ].map(String);
    });

    const csvString = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
      
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `adaptive_rate_limiter_raw_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF("landscape");
    
    doc.setFontSize(16);
    doc.text("Raw Data Logging for Statistical Analysis", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Events Exported: ${entries.length}`, 14, 28);

    const headers = [
      "Timestamp",
      "IP Address",
      "Rate",
      "Jitter",
      "Burst Freq",
      "Persist",
      "Class",
      "Tokens",
      "Action"
    ];

    const rows = entries.map((entry) => {
      return [
        entry.timestamp,
        entry.clientIp,
        entry.requestRate.toFixed(1),
        entry.sigma !== null ? entry.sigma.toFixed(2) : "N/A",
        entry.burstFreq.toFixed(1),
        entry.persistence.toFixed(1),
        entry.classification,
        `${entry.tokensRemaining}/${entry.bucketCapacity}`,
        entry.action
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [44, 44, 60] },
      styles: { fontSize: 8 },
    });

    doc.save(`adaptive_rate_limiter_raw_logs_${Date.now()}.pdf`);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          padding: "8px 16px",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--accent-dim)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export Report
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 280,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Export Filtered ({entries.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              Respects current data & category filters
            </div>
          </div>
          
          <button
            onClick={exportCSV}
            style={{
              width: "100%", padding: "12px 16px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", textAlign: "left", transition: "background 0.15s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ color: "var(--normal)", marginTop: 2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Export as CSV</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Raw tabular data for Excel/Sheets</div>
            </div>
          </button>

          <button
            onClick={exportPDF}
            style={{
              width: "100%", padding: "12px 16px", background: "transparent", border: "none",
              display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", textAlign: "left", transition: "background 0.15s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ color: "var(--suspicious)", marginTop: 2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M10 9H8v6h2" />
                <path d="M14 9h-2v6h2" />
                <path d="M18 9h-2v6h2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Export as PDF (Report)</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Executive summary + audit table</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
