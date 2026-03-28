"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Point = {
  date: string;
  count: number;
};

type TooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Point }>;
};

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatCompactNumber = (value: number) => {
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
};

function SparkTooltip({
  active,
  payload,
  unitLabel
}: TooltipContentProps & { unitLabel: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs text-text-secondary shadow-sm backdrop-blur">
      <p className="font-semibold text-text-primary">{formatShortDate(point.date)}</p>
      <p className="mt-1">
        <span className="font-semibold text-text-primary">{point.count}</span>{" "}
        <span className="text-text-secondary">{unitLabel}</span>
      </p>
    </div>
  );
}

export function SparkAreaChart({
  data,
  tone = "primary",
  height = 224,
  unitLabel = "events",
  variant = "area",
  showXAxis
}: {
  data: Point[];
  tone?: "primary" | "muted";
  height?: number;
  unitLabel?: string;
  variant?: "area" | "bar";
  showXAxis?: boolean;
}) {
  const gradientId = useId();
  const stroke = tone === "primary" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const cursorStroke = "hsl(var(--border))";
  const showXAxisTicks = showXAxis ?? height >= 160;
  const axisTick = { fontSize: 10, fill: "hsl(var(--muted-foreground))" } as const;
  const yTickCount = height < 140 ? 3 : 5;
  const yAxisWidth = height < 140 ? 30 : 36;
  const chartMargin = { top: 10, right: 12, left: 0, bottom: showXAxisTicks ? 24 : 0 } as const;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              vertical={false}
            />
            <YAxis
              width={yAxisWidth}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickCount={yTickCount}
              tickFormatter={formatCompactNumber}
            />
            <XAxis
              dataKey="date"
              hide={!showXAxisTicks}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickMargin={8}
              padding={{ left: 8, right: 8 }}
              interval="preserveStartEnd"
              minTickGap={24}
              tickFormatter={(value: string) => value.slice(5)}
            />
            <Tooltip
              content={(props) => <SparkTooltip {...props} unitLabel={unitLabel} />}
              cursor={{ fill: cursorStroke, fillOpacity: 0.06 }}
            />
            <Bar
              dataKey="count"
              fill={stroke}
              radius={[10, 10, 4, 4]}
              maxBarSize={22}
            />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              vertical={false}
            />
            <YAxis
              width={yAxisWidth}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickCount={yTickCount}
              tickFormatter={formatCompactNumber}
            />
            <XAxis
              dataKey="date"
              hide={!showXAxisTicks}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickMargin={8}
              padding={{ left: 8, right: 8 }}
              interval="preserveStartEnd"
              minTickGap={24}
              tickFormatter={(value: string) => value.slice(5)}
            />
            <Tooltip
              content={(props) => <SparkTooltip {...props} unitLabel={unitLabel} />}
              cursor={{ stroke: cursorStroke, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                fill: "hsl(var(--background))"
              }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
