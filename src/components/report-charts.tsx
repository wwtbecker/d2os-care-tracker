"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ResolutionStat, SnapshotCount, TrendWeek } from "@/lib/reporting";

const AXIS_TICK = { fill: "#64748b", fontSize: 12 };
const GRID_STROKE = "#e2e8f0";
// Single-measure magnitude bars use one neutral hue (no tier meaning).
const NEUTRAL_BAR = "#475569";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

/** Stacked weekly volume by tier. */
export function VolumeTrendChart({
  data,
  tiers,
}: {
  data: TrendWeek[];
  tiers: { label: string; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} iconType="circle" iconSize={8} />
        {tiers.map((t, i) => (
          <Bar
            key={t.label}
            dataKey={t.label}
            stackId="volume"
            fill={t.color}
            stroke="#ffffff"
            strokeWidth={2}
            barSize={22}
            radius={i === tiers.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Average days-to-resolution by tier. */
export function ResolutionChart({ data }: { data: ResolutionStat[] }) {
  const rows = data.map((d) => ({ ...d, avgDays: d.avgDays ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          label={{ value: "days", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11, dx: 18 }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
          formatter={(value, _name, item) => {
            const stat = (item as { payload?: ResolutionStat } | undefined)?.payload;
            return [
              stat?.avgDays === null
                ? "No resolved escalations yet"
                : `${String(value)} days avg (${stat?.resolvedCount} resolved)`,
              "Time to resolution",
            ];
          }}
        />
        <Bar dataKey="avgDays" barSize={40} radius={[4, 4, 0, 0]}>
          {rows.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal magnitude bars (open by CSM / by account) — single neutral hue. */
export function CountBarChart({
  data,
  maxBars = 8,
}: {
  data: SnapshotCount[];
  maxBars?: number;
}) {
  const rows = data.slice(0, maxBars);
  const height = Math.max(160, rows.length * 36 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tick={{ ...AXIS_TICK, fill: "#334155" }}
          tickLine={false}
          axisLine={{ stroke: GRID_STROKE }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        <Bar
          dataKey="count"
          name="Open escalations"
          fill={NEUTRAL_BAR}
          barSize={18}
          radius={[0, 4, 4, 0]}
          label={{ position: "right", fill: "#475569", fontSize: 12 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
