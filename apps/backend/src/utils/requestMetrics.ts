type RouteMetric = {
  key: string;
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  durations: number[];
  lastStatus: number;
  lastDurationMs: number;
  lastSeenAt: string;
};

const routeMetrics = new Map<string, RouteMetric>();
const MAX_DURATION_SAMPLES = 500;

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

export const recordRequestMetric = ({
  key,
  statusCode,
  durationMs
}: {
  key: string;
  statusCode: number;
  durationMs: number;
}) => {
  const existing = routeMetrics.get(key);
  const now = new Date().toISOString();

  if (!existing) {
    routeMetrics.set(key, {
      key,
      count: 1,
      errorCount: statusCode >= 400 ? 1 : 0,
      totalDurationMs: durationMs,
      maxDurationMs: durationMs,
      durations: [durationMs],
      lastStatus: statusCode,
      lastDurationMs: durationMs,
      lastSeenAt: now
    });
    return;
  }

  existing.count += 1;
  existing.errorCount += statusCode >= 400 ? 1 : 0;
  existing.totalDurationMs += durationMs;
  existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
  existing.durations.push(durationMs);
  if (existing.durations.length > MAX_DURATION_SAMPLES) {
    existing.durations.shift();
  }
  existing.lastStatus = statusCode;
  existing.lastDurationMs = durationMs;
  existing.lastSeenAt = now;
};

export const getRequestMetricsSnapshot = () =>
  Array.from(routeMetrics.values())
    .map((metric) => {
      const sortedDurations = [...metric.durations].sort((a, b) => a - b);
      return {
        key: metric.key,
        count: metric.count,
        errorCount: metric.errorCount,
        errorRate: metric.count ? Number((metric.errorCount / metric.count).toFixed(4)) : 0,
        avgDurationMs: metric.count ? Number((metric.totalDurationMs / metric.count).toFixed(2)) : 0,
        p95DurationMs: Number(percentile(sortedDurations, 95).toFixed(2)),
        p99DurationMs: Number(percentile(sortedDurations, 99).toFixed(2)),
        maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
        lastStatus: metric.lastStatus,
        lastDurationMs: Number(metric.lastDurationMs.toFixed(2)),
        lastSeenAt: metric.lastSeenAt
      };
    })
    .sort((a, b) => {
      if (b.p95DurationMs !== a.p95DurationMs) {
        return b.p95DurationMs - a.p95DurationMs;
      }
      return b.count - a.count;
    });
