type QueryMetric = {
  key: string;
  count: number;
  totalMs: number;
  maxMs: number;
  durations: number[];
  lastSeenAt: string;
};

const MAX_DURATIONS_PER_QUERY = 300;
const queryMetrics = new Map<string, QueryMetric>();

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

export const recordQueryMetric = (params: {
  model?: string;
  action?: string;
  durationMs: number;
}) => {
  const key = `${params.model || "raw"}:${params.action || "query"}`;
  const now = new Date().toISOString();
  const existing = queryMetrics.get(key);

  if (!existing) {
    queryMetrics.set(key, {
      key,
      count: 1,
      totalMs: params.durationMs,
      maxMs: params.durationMs,
      durations: [params.durationMs],
      lastSeenAt: now
    });
    return;
  }

  existing.count += 1;
  existing.totalMs += params.durationMs;
  existing.maxMs = Math.max(existing.maxMs, params.durationMs);
  existing.lastSeenAt = now;
  existing.durations.push(params.durationMs);
  if (existing.durations.length > MAX_DURATIONS_PER_QUERY) {
    existing.durations.shift();
  }
};

export const getQueryMetricsSnapshot = () =>
  Array.from(queryMetrics.values())
    .map((metric) => {
      const sorted = [...metric.durations].sort((a, b) => a - b);
      return {
        key: metric.key,
        count: metric.count,
        avgDurationMs: metric.count ? Number((metric.totalMs / metric.count).toFixed(2)) : 0,
        p95DurationMs: Number(percentile(sorted, 95).toFixed(2)),
        maxDurationMs: Number(metric.maxMs.toFixed(2)),
        lastSeenAt: metric.lastSeenAt
      };
    })
    .sort((a, b) => {
      if (b.p95DurationMs !== a.p95DurationMs) {
        return b.p95DurationMs - a.p95DurationMs;
      }
      return b.count - a.count;
    });

