"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, ReferenceLine, Tooltip, YAxis } from "recharts";

import { ChartContainer } from "@geiger/ui/chart";
import { cn } from "@/lib/utils";

// Validated categorical pair (blue / orange), stepped per theme; set on the screen root and read here.
export const FLOW_COLOR_VARS =
  "[--cap-in:#2a78d6] [--cap-out:#eb6834] dark:[--cap-in:#3987e5] dark:[--cap-out:#d95926]";

const CONFIG = {
  arrivals: { label: "Arrivals", color: "var(--cap-in)" },
  exits: { label: "Exits", color: "var(--cap-out)" },
};

const clock = (t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function FlowTooltip({ active, payload, bucketMinutes }) {
  const p = active && payload?.length ? payload[0].payload : null;
  if (!p) return null;
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">
        {clock(p.t)} – {clock(p.t + bucketMinutes * 60000)}
      </p>
      {[
        ["Arrivals", p.arrivals, "var(--cap-in)"],
        ["Exits", p.exits, "var(--cap-out)"],
      ].map(([label, value, color]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />
          <span className="flex-1 text-text-secondary">{label}</span>
          <span className="font-medium tabular-nums text-foreground">{value.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

// Shared legend for every card's sparkline (identity never rests on colour alone; the tooltip names each bar too).
export function FlowLegend({ bucketMinutes = 15, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary", className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-[2px] bg-[var(--cap-in)]" /> Arrivals
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-[2px] bg-[var(--cap-out)]" /> Exits
      </span>
      <span className="text-text-tertiary">per {bucketMinutes} minutes · arrivals above the line, exits below</span>
    </div>
  );
}

// Arrivals up and exits down per bucket, on one symmetric axis.
export function FlowSparkline({ series, bucketMinutes = 15, height = 56 }) {
  const { data, max } = useMemo(() => {
    const rows = (series || []).map((p) => ({ ...p, exitsDown: -p.exits }));
    const peak = rows.reduce((m, p) => Math.max(m, p.arrivals, p.exits), 0);
    return { data: rows, max: peak || 1 };
  }, [series]);

  if (!data.length || !data.some((p) => p.arrivals || p.exits)) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-tertiary" style={{ height }}>
        No movement yet
      </div>
    );
  }

  return (
    <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }} stackOffset="sign" barCategoryGap={2}>
        <YAxis hide domain={[-max, max]} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Tooltip cursor={{ fill: "var(--surface-active, rgba(127,127,127,0.12))" }} content={<FlowTooltip bucketMinutes={bucketMinutes} />} />
        <Bar dataKey="arrivals" stackId="flow" fill="var(--color-arrivals)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="exitsDown" stackId="flow" fill="var(--color-exits)" radius={[0, 0, 2, 2]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export default FlowSparkline;
