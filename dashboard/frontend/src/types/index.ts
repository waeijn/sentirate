export type Classification = "normal" | "bursty" | "suspicious";
export type Action = "allowed" | "throttled" | "blocked";
export type AlertSeverity = "info" | "success" | "warning" | "error";
export type SensitivityPreset = "strict" | "balanced" | "lenient" | "custom";

export interface StatCardData {
  label: string;
  value: string;
  unit: string;
  delta: string;
  deltaPositive: boolean;
  icon: "throughput" | "latency" | "threats" | "acceptance";
  link?: string;
}

export interface TrafficPoint {
  time: string;
  normal: number;
  bursty: number;
  suspicious: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  clientIp: string;
  // Raw values from backend — NOT normalized to 0-1
  requestRate: number; // λ in req/s  (e.g. 12.4)
  sigma: number | null; // σ in seconds (e.g. 0.03), null if insufficient history
  burstFreq: number; // bursts per minute (e.g. 3)
  persistence: number; // seconds of sustained elevated rate (e.g. 8.2)
  // Token bucket state
  bucketFill: number; // 0-100 percentage
  refillRate: number; // tokens/sec
  bucketCapacity: number; // max tokens
  tokensRemaining: number;
  retryAfter: number;
  // Decision
  classification: Classification;
  action: Action;
  // Explainability
  justification: string;
  matchedRules: string[];
}

export interface ClassificationProfile {
  type: Classification;
  label: string;
  description: string;
  refillRate: number;
  bucketCapacity: number;
}

export interface SystemSummary {
  active_clients: number;
  total_accepted: number;
  total_rejected: number;
  classifications: { normal: number; bursty: number; suspicious: number };
  rar_percent: number;
  fpr_percent: number;
  fnr_percent: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  top_clients: TopClient[];
}

export interface TopClient {
  client_id: string;
  classification: Classification;
  rate_per_min: number;
  accepted: number;
  rejected: number;
  bucket_fill: number;
}

export interface LiveEvent {
  client_id: string;
  allowed: boolean;
  classification: Classification;
  request_rate_min: number;
  interval_jitter: number | null;
  error_rate: number;
  burst_count: number;
  burst_persistence: number;
  bucket_fill: number;
  bucket_capacity: number;
  refill_rate: number;
  tokens_remaining: number;
  retry_after: number;
  justification: string;
  matched_rules: string[];
  total_accepted: number;
  total_rejected: number;
}
