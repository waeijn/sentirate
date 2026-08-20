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
  requestRate: number, // req/s
  sigma: number | null, // seconds
  burstFreq: number, // bursts/min
  persistence: number, // seconds
  dateStr: string,
): LogEntry {
  const profiles = {
    normal: { refillRate: 10, bucketCapacity: 20 },
    bursty: { refillRate: 20, bucketCapacity: 40 },
    suspicious: { refillRate: 2, bucketCapacity: 5 },
  };
  const p = profiles[classification];
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: dateStr,
    clientIp: ip,
    requestRate,
    sigma,
    burstFreq,
    persistence,
    bucketFill: 80,
    refillRate: p.refillRate,
    bucketCapacity: p.bucketCapacity,
    tokensRemaining: p.bucketCapacity * 0.8,
    retryAfter: 0,
    classification,
    action,
    justification: "",
    matchedRules: [],
  };
}

const SEED_LOGS: LogEntry[] = [
  makeLogEntry(
    "192.168.1.47",
    "suspicious",
    "throttled",
    45.2,
    0.03,
    6,
    18.5,
    "2026-02-19 14:32:08",
  ),
  makeLogEntry(
    "10.0.3.12",
    "bursty",
    "allowed",
    14.8,
    0.21,
    3,
    7.2,
    "2026-02-19 14:31:55",
  ),
  makeLogEntry(
    "203.0.113.15",
    "suspicious",
    "blocked",
    98.1,
    0.0,
    8,
    22.0,
    "2026-02-19 14:31:22",
  ),
  makeLogEntry(
    "198.51.100.22",
    "suspicious",
    "throttled",
    35.6,
    0.02,
    5,
    16.1,
    "2026-02-19 14:30:47",
  ),
  makeLogEntry(
    "10.0.1.88",
    "normal",
    "allowed",
    2.3,
    0.84,
    0,
    0.0,
    "2026-02-19 14:30:12",
  ),
  makeLogEntry(
    "172.16.0.55",
    "normal",
    "allowed",
    1.8,
    1.12,
    0,
    0.0,
    "2026-02-19 14:29:44",
  ),
  makeLogEntry(
    "10.0.2.33",
    "bursty",
    "allowed",
    18.4,
    0.18,
    4,
    10.3,
    "2026-02-19 14:29:18",
  ),
  makeLogEntry(
    "192.168.2.100",
    "suspicious",
    "blocked",
    67.3,
    0.01,
    7,
    19.8,
    "2026-02-19 14:28:55",
  ),
  makeLogEntry(
    "10.0.4.77",
    "normal",
    "allowed",
    3.1,
    0.72,
    1,
    2.1,
    "2026-02-19 14:28:22",
  ),
  makeLogEntry(
    "172.16.1.15",
    "bursty",
    "allowed",
    22.7,
    0.14,
    4,
    12.6,
    "2026-02-19 14:27:50",
  ),
  makeLogEntry(
    "198.51.100.44",
    "suspicious",
    "throttled",
    41.5,
    0.02,
    6,
    17.3,
    "2026-02-19 14:27:15",
  ),
  makeLogEntry(
    "10.0.1.22",
    "normal",
    "allowed",
    1.5,
    0.95,
    0,
    0.0,
    "2026-02-19 14:26:48",
  ),
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const reqCountRef = useRef<number>(0);
  const prevTotalRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());
  const [page, setPage] = useState<Page>("monitoring");
  const [connected, setConnected] = useState(false);

  // Monitoring state
  const [stats, setStats] = useState<StatCardData[]>(SEED_STATS);
  const [chartData, setChartData] = useState<TrafficPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>(SEED_ALERTS);
  const [analytics, setAnalytics] = useState(SEED_ANALYTICS);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>(SEED_LOGS);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = () => setIsDark((d) => !d);

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
        const now = Date.now();
        const currentTotal = s.total_accepted + s.total_rejected;
        const elapsed = (now - prevTimeRef.current) / 1000;
        const rps =
          elapsed > 0
            ? Math.round((currentTotal - prevTotalRef.current) / elapsed)
            : 0;
        prevTotalRef.current = currentTotal;
        prevTimeRef.current = now;
        reqCountRef.current += data.recent_events?.length ?? 0;

        // ── Stat cards ──────────────────────────────────────────────────────
        const total = s.total_accepted + s.total_rejected;
        // Use backend-computed RAR directly — it's calculated from the
        // full request log in FeedbackProvider.get_summary_metrics()
        const acceptRate =
          s.rar_percent != null
            ? s.rar_percent.toFixed(1)
            : total > 0
              ? ((s.total_accepted / total) * 100).toFixed(1)
              : "100.0";

        setStats([
          {
            label: "System Throughput",
            value: rps.toLocaleString(),
            unit: "req/s",
            delta: `${s.active_clients} clients`,
            deltaPositive: true,
            icon: "throughput",
          },
          {
            label: "Request Latency",
            value:
              s.avg_latency_ms != null && s.avg_latency_ms > 0
                ? s.avg_latency_ms.toFixed(2)
                : "< 1",
            unit: "ms",
            delta:
              s.p95_latency_ms != null && s.p95_latency_ms > 0
                ? `p95: ${s.p95_latency_ms.toFixed(2)}ms`
                : "Within latency target",
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

        // ── Analytics — use backend computed values directly ─────────────────
        // Backend FeedbackProvider.get_summary_metrics() computes these
        // correctly from the full request log, not from client counts.
        setAnalytics({
          fpr: s.fpr_percent ?? 0.0,
          fnr: s.fnr_percent ?? 0.0,
          tpr: parseFloat((100 - (s.fnr_percent ?? 0)).toFixed(1)),
          tnr: parseFloat((100 - (s.fpr_percent ?? 0)).toFixed(1)),
          accuracy: parseFloat(
            ((200 - (s.fpr_percent ?? 0) - (s.fnr_percent ?? 0)) / 2).toFixed(
              1,
            ),
          ),
        });

        // ── Chart ────────────────────────────────────────────────────────────
        setChartData((prev) =>
          [
            ...prev,
            {
              time: new Date(parseInt(data.timestamp)).toLocaleTimeString(),
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
            // Raw values — no normalization
            requestRate: parseFloat((e.request_rate_min / 60).toFixed(2)), // convert req/min → req/s
            sigma: e.interval_jitter, // already in seconds
            burstFreq: e.burst_count, // bursts/min integer
            persistence: e.burst_persistence, // seconds
            bucketFill: e.bucket_fill,
            refillRate: e.refill_rate,
            bucketCapacity: e.bucket_capacity,
            tokensRemaining: e.tokens_remaining,
            retryAfter: e.retry_after,
            classification: e.classification,
            action: !e.allowed
              ? "blocked"
              : e.classification === "suspicious"
                ? "throttled"
                : "allowed",
            justification: e.justification,
            matchedRules: e.matched_rules ?? [],
          }));

          setLogs((prev) => {
            // Keep a fair mix — cap each classification at 100 entries
            // so Suspicious flooding doesn't erase Normal/Bursty from the log
            const combined = [...newEntries, ...prev];
            const normal = combined
              .filter((e) => e.classification === "normal")
              .slice(0, 100);
            const bursty = combined
              .filter((e) => e.classification === "bursty")
              .slice(0, 100);
            const suspicious = combined
              .filter((e) => e.classification === "suspicious")
              .slice(0, 100);
            // Interleave so the table shows a realistic mix
            return [...normal, ...bursty, ...suspicious]
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, 300);
          });

          const newAlerts = data.recent_events
            .filter(
              (e, i, arr) =>
                // deduplicate — one alert per unique client per update cycle
                arr.findIndex((x) => x.client_id === e.client_id) === i,
            )
            .map((e) => {
              const rate = e.request_rate_min.toFixed(0);
              const sigma =
                e.interval_jitter != null
                  ? e.interval_jitter.toFixed(2)
                  : "N/A";

              if (!e.allowed || e.classification === "suspicious") {
                return makeAlert(
                  "error",
                  `${e.client_id} blocked — rate ${rate} req/min, σ=${sigma}s`,
                  new Date().toLocaleTimeString(),
                );
              } else if (e.classification === "bursty") {
                return makeAlert(
                  "warning",
                  `${e.client_id} bursty — rate ${rate} req/min, bucket expanded`,
                  new Date().toLocaleTimeString(),
                );
              } else {
                return makeAlert(
                  "success",
                  `${e.client_id} normal — rate ${rate} req/min, allowed`,
                  new Date().toLocaleTimeString(),
                );
              }
            });

          if (newAlerts.length > 0) {
            setAlerts((prev) => [...newAlerts, ...prev].slice(0, 30));
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
        <TopBar
          title={PAGE_TITLES[page]}
          connected={connected}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        <main style={{ flex: 1, overflowY: "auto" }}>
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
