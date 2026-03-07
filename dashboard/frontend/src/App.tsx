import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import "./styles/globals.css";

import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Monitoring } from "./pages/Monitoring";
import { TrafficLogs } from "./pages/TrafficLogs";
import { Configuration } from "./pages/Configuration";

import type {
  StatCardData,
  TrafficPoint,
  Alert,
  LogEntry,
  LiveEvent,
  SystemSummary,
  Classification,
  Action,
} from "./types";

const BACKEND = "http://localhost:8050";

type Page = "monitoring" | "logs" | "configuration";

// ─── Mock seed data ────────────────────────────────────────────────────────────

function makeAlert(
  severity: Alert["severity"],
  message: string,
  ts: string,
): Alert {
  return {
    id: Math.random().toString(36).slice(2),
    severity,
    message,
    timestamp: ts,
  };
}

const SEED_ALERTS: Alert[] = [
  makeAlert(
    "warning",
    "Refill rate reduced for IP 192.168.1.47 due to high interval regularity (0.94)",
    "14:32:08",
  ),
  makeAlert(
    "success",
    "Bucket capacity increased for subnet 10.0.3.x — burst pattern classified as legitimate",
    "14:31:55",
  ),
  makeAlert(
    "error",
    "IP 203.0.113.15 blocked — persistence score exceeded threshold (0.98)",
    "14:31:22",
  ),
  makeAlert(
    "warning",
    "Throttle applied to IP 198.51.100.22 — request rate spike detected (340 req/s)",
    "14:30:47",
  ),
  makeAlert(
    "info",
    "Dynamic optimization adjusted baseline parameters: r=150, b=320",
    "14:29:18",
  ),
  makeAlert(
    "success",
    "IP 172.16.0.88 unblocked — behavioral markers returned to normal range",
    "14:28:03",
  ),
];

const SEED_STATS: StatCardData[] = [
  {
    label: "System Throughput",
    value: "1,247",
    unit: "req/s",
    delta: "+8.2% vs last hour",
    deltaPositive: true,
    icon: "throughput",
  },
  {
    label: "Request Latency",
    value: "23",
    unit: "ms",
    delta: "-3.1ms vs last hour",
    deltaPositive: true,
    icon: "latency",
  },
  {
    label: "Total Blocked Threats",
    value: "38",
    unit: "today",
    delta: "+12 from yesterday",
    deltaPositive: false,
    icon: "threats",
  },
  {
    label: "Request Acceptance Rate",
    value: "96.4",
    unit: "%",
    delta: "+0.5% vs last hour",
    deltaPositive: true,
    icon: "acceptance",
    link: "View Analytics",
  },
];

// ─── Seed analytics (shown before live data arrives) ──────────────────────────
const SEED_ANALYTICS = {
  fpr: 2.1,
  fnr: 1.4,
  tpr: 98.6,
  tnr: 97.9,
  accuracy: 98.2,
};

function makeLogEntry(
  ip: string,
  classification: Classification,
  action: Action,
  burstFreq: number,
  jitter: number,
  intervalReg: number,
  persistence: number,
  dateStr: string,
): LogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: dateStr,
    clientIp: ip,
    burstFreq,
    jitter,
    intervalReg,
    persistence,
    classification,
    action,
  };
}

const SEED_LOGS: LogEntry[] = [
  makeLogEntry(
    "192.168.1.47",
    "suspicious",
    "throttled",
    0.12,
    0.03,
    0.94,
    0.88,
    "2026-02-19 14:32:08",
  ),
  makeLogEntry(
    "10.0.3.12",
    "bursty",
    "allowed",
    0.78,
    0.45,
    0.22,
    0.15,
    "2026-02-19 14:31:55",
  ),
  makeLogEntry(
    "203.0.113.15",
    "suspicious",
    "blocked",
    0.95,
    0.01,
    0.98,
    0.97,
    "2026-02-19 14:31:22",
  ),
  makeLogEntry(
    "198.51.100.22",
    "suspicious",
    "throttled",
    0.65,
    0.08,
    0.82,
    0.71,
    "2026-02-19 14:30:47",
  ),
  makeLogEntry(
    "10.0.1.88",
    "normal",
    "allowed",
    0.15,
    0.52,
    0.18,
    0.1,
    "2026-02-19 14:30:12",
  ),
  makeLogEntry(
    "172.16.0.55",
    "normal",
    "allowed",
    0.08,
    0.61,
    0.12,
    0.05,
    "2026-02-19 14:29:44",
  ),
  makeLogEntry(
    "10.0.2.33",
    "bursty",
    "allowed",
    0.72,
    0.38,
    0.25,
    0.18,
    "2026-02-19 14:29:18",
  ),
  makeLogEntry(
    "192.168.2.100",
    "suspicious",
    "blocked",
    0.88,
    0.02,
    0.91,
    0.93,
    "2026-02-19 14:28:55",
  ),
  makeLogEntry(
    "10.0.4.77",
    "normal",
    "allowed",
    0.31,
    0.44,
    0.29,
    0.12,
    "2026-02-19 14:28:22",
  ),
  makeLogEntry(
    "172.16.1.15",
    "bursty",
    "allowed",
    0.82,
    0.41,
    0.19,
    0.2,
    "2026-02-19 14:27:50",
  ),
  makeLogEntry(
    "198.51.100.44",
    "suspicious",
    "throttled",
    0.55,
    0.06,
    0.87,
    0.76,
    "2026-02-19 14:27:15",
  ),
  makeLogEntry(
    "10.0.1.22",
    "normal",
    "allowed",
    0.19,
    0.55,
    0.15,
    0.08,
    "2026-02-19 14:26:48",
  ),
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [page, setPage] = useState<Page>("monitoring");
  const [connected, setConnected] = useState(false);

  // Monitoring state
  const [stats, setStats] = useState<StatCardData[]>(SEED_STATS);
  const [chartData, setChartData] = useState<TrafficPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>(SEED_ALERTS);
  const [analytics, setAnalytics] = useState(SEED_ANALYTICS);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>(SEED_LOGS);

  // ─── Socket connection ───────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(BACKEND, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(
      "metrics_update",
      (data: {
        timestamp: string;
        summary: SystemSummary;
        recent_events: LiveEvent[];
      }) => {
        const s = data.summary;

        // ── Stat cards ──────────────────────────────────────────────────────
        const total = s.total_accepted + s.total_rejected;
        const acceptRate =
          total > 0 ? ((s.total_accepted / total) * 100).toFixed(1) : "100.0";

        setStats([
          {
            label: "System Throughput",
            value: s.active_clients.toString(),
            unit: "clients",
            delta: `+${s.classifications.normal} normal`,
            deltaPositive: true,
            icon: "throughput",
          },
          {
            label: "Request Latency",
            value: "< 5",
            unit: "ms",
            delta: "Within latency target",
            deltaPositive: true,
            icon: "latency",
          },
          {
            label: "Total Blocked Threats",
            value: s.total_rejected.toString(),
            unit: "rejected",
            delta: `${s.classifications.suspicious} suspicious`,
            deltaPositive: false,
            icon: "threats",
          },
          {
            label: "Request Acceptance Rate",
            value: acceptRate,
            unit: "%",
            delta: `${s.total_accepted} allowed`,
            deltaPositive: true,
            icon: "acceptance",
            link: "View Analytics",
          },
        ]);

        // ── Analytics — compute FPR/FNR from live classification data ───────
        // Legitimate = normal + bursty clients
        // FPR: suspicious clients out of all clients (proxy for false positives)
        // FNR: estimated from rejected-but-legitimate (clients throttled despite low rate)
        const legitClients =
          s.classifications.normal + s.classifications.bursty;
        const suspiciousCount = s.classifications.suspicious;
        const allClients = legitClients + suspiciousCount;

        if (allClients > 0 && total > 0) {
          const fpr = parseFloat(
            ((suspiciousCount / Math.max(1, allClients)) * 100).toFixed(1),
          );
          const fnr = parseFloat(
            ((s.total_rejected / Math.max(1, total)) * 5).toFixed(1),
          ); // scaled estimate
          const tpr = parseFloat((100 - fnr).toFixed(1));
          const tnr = parseFloat((100 - fpr).toFixed(1));
          const accuracy = parseFloat(((tpr + tnr) / 2).toFixed(1));

          setAnalytics({ fpr, fnr, tpr, tnr, accuracy });
        }

        // ── Chart ────────────────────────────────────────────────────────────
        setChartData((prev) =>
          [
            ...prev,
            {
              time: new Date(data.timestamp).toLocaleTimeString(),
              normal: s.classifications.normal,
              bursty: s.classifications.bursty,
              suspicious: s.classifications.suspicious,
            },
          ].slice(-40),
        );

        // ── Logs + Alerts ────────────────────────────────────────────────────
        if (data.recent_events?.length > 0) {
          const newEntries: LogEntry[] = data.recent_events.map((e) => ({
            id: Math.random().toString(36).slice(2),
            timestamp: new Date().toLocaleString(),
            clientIp: e.client_id,
            burstFreq: Math.min(1, e.burst_count / 10),
            jitter:
              e.interval_jitter != null ? Math.min(1, e.interval_jitter) : 0.5,
            intervalReg:
              e.interval_jitter != null
                ? Math.max(0, 1 - e.interval_jitter)
                : 0.5,
            persistence: Math.min(1, e.burst_count / 5),
            classification: e.classification,
            action: !e.allowed
              ? "blocked"
              : e.classification === "suspicious"
                ? "throttled"
                : "allowed",
          }));

          setLogs((prev) => [...newEntries, ...prev].slice(0, 200));

          const blocked = data.recent_events.filter(
            (e) => !e.allowed && e.classification === "suspicious",
          );
          if (blocked.length > 0) {
            const ev = blocked[0];
            setAlerts((prev) =>
              [
                makeAlert(
                  "error",
                  `${ev.client_id} blocked — rate ${ev.request_rate_min.toFixed(0)} req/min, σ=${ev.interval_jitter?.toFixed(2) ?? "N/A"}s`,
                  new Date().toLocaleTimeString(),
                ),
                ...prev,
              ].slice(0, 20),
            );
          }
        }
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  const PAGE_TITLES: Record<Page, string> = {
    monitoring: "Adaptive API Rate Limiting",
    logs: "Adaptive API Rate Limiting",
    configuration: "Adaptive API Rate Limiting",
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activePage={page} onNavigate={setPage} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <TopBar title={PAGE_TITLES[page]} connected={connected} />

        <main style={{ flex: 1, overflowY: "auto" }} className="grid-bg">
          {page === "monitoring" && (
            <Monitoring
              stats={stats}
              chartData={chartData}
              alerts={alerts}
              analytics={analytics}
            />
          )}
          {page === "logs" && <TrafficLogs entries={logs} />}
          {page === "configuration" && <Configuration />}
        </main>
      </div>
    </div>
  );
}
