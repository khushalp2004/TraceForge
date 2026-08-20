"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

type BreakdownItem = {
  label: string;
  count: number;
};

type SeverityBreakdownItem = BreakdownItem & {
  tone: "critical" | "warning" | "info";
};

type AdvancedChartsProps = {
  severityBreakdown: SeverityBreakdownItem[];
  environmentHealth: BreakdownItem[];
};

// Premium gradient colors
const TONE_COLORS = {
  critical: "url(#colorCritical)",
  warning: "url(#colorWarning)",
  info: "url(#colorInfo)"
};

export function AdvancedCharts({ severityBreakdown, environmentHealth }: AdvancedChartsProps) {
  const severityData = severityBreakdown.map((item) => ({
    ...item,
    fill: TONE_COLORS[item.tone] || TONE_COLORS.info,
    stroke: item.tone === "critical" ? "#ef4444" : item.tone === "warning" ? "#f59e0b" : "#3b82f6",
    name: item.label.charAt(0).toUpperCase() + item.label.slice(1)
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl">
          <p className="mb-1 text-sm font-bold text-white">{payload[0].name || payload[0].payload.label}</p>
          <div className="flex items-center gap-2">
            <div 
              className="h-2 w-2 rounded-full" 
              style={{ background: payload[0].payload.stroke || "#8b5cf6" }} 
            />
            <p className="text-xs font-medium text-white/80">{payload[0].value} occurrences</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      {/* Premium Severity Breakdown Donut */}
      <div className="group relative flex flex-col overflow-hidden rounded-md border border-white/5 bg-gradient-to-b from-card/80 to-background/40 p-6 shadow-xl backdrop-blur-md transition-all hover:border-white/10 hover:shadow-2xl hover:shadow-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <h3 className="relative z-10 text-lg font-bold tracking-tight text-white">Severity Breakdown</h3>
        <p className="relative z-10 mb-6 text-sm font-medium text-white/50">Distribution of errors by severity level.</p>
        
        <div className="relative z-10 h-72 w-full">
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="colorWarning" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#b45309" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="colorInfo" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={8}
                  dataKey="count"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={2}
                  cornerRadius={6}
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} className="transition-all duration-300 hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-white/40">
              No severity data available.
            </div>
          )}
        </div>
      </div>

      {/* Premium Environment Health Bar Chart */}
      <div className="group relative flex flex-col overflow-hidden rounded-md border border-white/5 bg-gradient-to-b from-card/80 to-background/40 p-6 shadow-xl backdrop-blur-md transition-all hover:border-white/10 hover:shadow-2xl hover:shadow-primary/5 delay-75">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <h3 className="relative z-10 text-lg font-bold tracking-tight text-white">Environment Health</h3>
        <p className="relative z-10 mb-6 text-sm font-medium text-white/50">Error frequency across different environments.</p>
        
        <div className="relative z-10 h-72 w-full">
          {environmentHealth.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={environmentHealth} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12} 
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12} 
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar 
                  dataKey="count" 
                  fill="url(#colorBar)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                  className="transition-all duration-300 hover:opacity-80"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-white/40">
              No environment data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
