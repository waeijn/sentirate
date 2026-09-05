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
  AlertSeverity,
} from "./types";

const BACKEND = "http://localhost:8050";

type Page = "monitoring" | "logs" | "configuration";

// ─── Mock seed data ────────────────────────────────────────────────────────────

function makeAlert(
  severity: AlertSeverity,
  message: string,
  timestamp: string,
  ip: string,
  statusText: string,
): Alert {
  return {
    id: Math.random().toString(36).slice(2),
    severity,
    message,
    timestamp,
    ip,
    statusText,
  };
}

const SEED_ALERTS: Alert[] = [
  makeAlert(
    "warning",
    "Refill rate reduced for IP 192.168.1.47 due to high interval regularity (0.94)",
    "14:32:08",
    "192.168.1.47",
    "Bursty"
  ),
  makeAlert(
    "success",
    "Bucket capacity increased for subnet 10.0.3.x — burst pattern classified as legitimate",
    "14:31:55",
    "10.0.3.x",
    "Normal"
  ),
  makeAlert(
    "error",
    "IP 203.0.113.15 blocked — persistence score exceeded threshold (0.98)",
    "14:31:22",
    "203.0.113.15",
    "Suspicious"
  ),
  makeAlert(
    "warning",
    "Throttle applied to IP 198.51.100.22 — request rate spike detected (340 req/s)",
    "14:30:47",
    "198.51.100.22",
    "Bursty"
  ),
  makeAlert(
    "info",
    "Dynamic optimization adjusted baseline parameters: r=150, b=320",
    "14:29:18",
    "System",
    "Info"
  ),
  makeAlert(
    "success",
    "IP 172.16.0.88 unblocked — behavioral markers returned to normal range",
    "14:28:03",
    "172.16.0.88",
    "Normal"
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

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const reqCountRef = useRef<number>(0);
  const prevTotalRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());
  const [page, setPage] = useState<Page>("monitoring");
  const [logsSearch, setLogsSearch] = useState<string>("");
  const [logsHighlight, setLogsHighlight] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [uptime, setUptime] = useState(0);

  // Monitoring state
  const [stats, setStats] = useState<StatCardData[]>(SEED_STATS);
  const [chartData, setChartData] = useState<TrafficPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>(SEED_ALERTS);
  const [analytics, setAnalytics] = useState<{
    fpr: number | null;
    fnr: number | null;
    tpr: number | null;
    tnr: number | null;
    accuracy: number | null;
  }>({
    fpr: null,
    fnr: null,
    tpr: null,
    tnr: null,
    accuracy: null,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Navigation handler
  const handleNavigateToLogs = (ipFilter?: string, ipHighlight?: string) => {
    setLogsSearch(ipFilter || "");
    setLogsHighlight(ipHighlight || "");
    setPage("logs");
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const handleResetMetrics = async () => {
    try {
      await fetch(BACKEND + "/api/clients", { method: "DELETE" });
      setChartData([]);
      setLogs([]);
      setStats((prev) =>
        prev.map((s) =>
          s.label === "Request Acceptance Rate" ? { ...s, value: "100.0" } : { ...s, value: "0" }
        )
      );
      setAnalytics({ fpr: 0, fnr: 0, tpr: 100, tnr: 100, accuracy: 100 });
      prevTotalRef.current = 0;
    } catch (err) {
      console.error("Failed to reset metrics:", err);
    }
  };

  // ─── Socket connection ───────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(BACKEND, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    let lastRenderTime = 0;
    let pendingEvents: LiveEvent[] = [];

    socket.on(
      "metrics_update",
      (data: {
        timestamp: string;
        summary: SystemSummary;
        recent_events: LiveEvent[];
      }) => {
        pendingEvents.push(...(data.recent_events || []));
        
        const now = Date.now();
        if (now - lastRenderTime < 2000) {
          return;
        }
        
        lastRenderTime = now;
        const eventsToProcess = pendingEvents;
        pendingEvents = [];

        const s = data.summary;
        if (s.uptime_seconds !== undefined) {
          setUptime(s.uptime_seconds);
        }
        const currentTotal = s.total_accepted + s.total_rejected;
        const elapsed = (now - prevTimeRef.current) / 1000;
        const rps =
          elapsed > 0
            ? Math.round((currentTotal - prevTotalRef.current) / elapsed)
            : 0;
        prevTotalRef.current = currentTotal;
        prevTimeRef.current = now;
        reqCountRef.current += eventsToProcess.length;

        // ── Stat cards ──────────────────────────────────────────────────────
        // Use backend-computed RAR directly — it's calculated from the
        // full request log in FeedbackProvider.get_summary_metrics()
        let acceptRate = "N/A";
        if (s.rar_percent != null) {
          acceptRate = s.rar_percent.toFixed(1);
        }

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
            unit: acceptRate === "N/A" ? "" : "%",
            delta: `${s.total_accepted} allowed`,
            deltaPositive: true,
            icon: "acceptance",
            link: "View Analytics",
          },
        ]);

        // ── Analytics — use backend computed values directly ─────────────────
        const fpr = s.fpr_percent != null ? s.fpr_percent : null;
        const fnr = s.fnr_percent != null ? s.fnr_percent : null;
        const tpr = fnr != null ? parseFloat((100 - fnr).toFixed(1)) : null;
        const tnr = fpr != null ? parseFloat((100 - fpr).toFixed(1)) : null;
        const accuracy = (fpr != null && fnr != null)
          ? parseFloat(((200 - fpr - fnr) / 2).toFixed(1))
          : null;

        setAnalytics({ fpr, fnr, tpr, tnr, accuracy });

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
        if (eventsToProcess.length > 0) {
          const newEntries: LogEntry[] = eventsToProcess.map((e) => ({
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

          const newAlerts = eventsToProcess
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
                  e.client_id,
                  "Suspicious"
                );
              } else if (e.classification === "bursty") {
                return makeAlert(
                  "warning",
                  `${e.client_id} bursty — rate ${rate} req/min, bucket expanded`,
                  new Date().toLocaleTimeString(),
                  e.client_id,
                  "Bursty"
                );
              } else {
                return makeAlert(
                  "success",
                  `${e.client_id} normal — rate ${rate} req/min, allowed`,
                  new Date().toLocaleTimeString(),
                  e.client_id,
                  "Normal"
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
      <Sidebar activePage={page} onNavigate={setPage} isDark={isDark} setIsDark={setIsDark} />

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
          onResetState={handleResetMetrics}
        />

        <main style={{ flex: 1, overflowY: "auto" }}>
          {page === "monitoring" && (
            <Monitoring
              stats={stats}
              chartData={chartData}
              alerts={alerts}
              analytics={analytics}
              uptime={uptime}
              onNavigateToLogs={handleNavigateToLogs}
            />
          )}
          {page === "logs" && <TrafficLogs entries={logs} stats={stats} analytics={analytics} initialSearch={logsSearch} highlightIp={logsHighlight} />}
          {page === "configuration" && <Configuration />}
        </main>
      </div>
    </div>
  );
}
