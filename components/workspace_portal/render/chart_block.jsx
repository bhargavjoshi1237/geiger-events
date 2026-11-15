"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { useBlockData } from "./use_block_data";

const HEX = { gray: "#a1a1aa", blue: "#0ea5e9", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", pink: "#ec4899", teal: "#14b8a6" };
const colorOf = (group) => HEX[group.color] ?? HEX.blue;
const axis = { fontSize: 12, fill: "var(--text-secondary, #71717a)" };

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-surface-card px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-foreground">{item.label}</p>
      <p className="tabular-nums text-text-secondary">{Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
    </div>
  );
}

// Bar, line or donut over the records the viewer can see, grouped by status, a choice field or a date.
export function ChartBlock({ block, fill }) {
  const config = block.config;
  const { data, error, loading, reload } = useBlockData(block, {});
  const groups = data?.groups ?? [];

  let body;
  if (loading) body = <BlockLoading label="Loading chart" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!groups.length) body = <EmptyRows text="No data yet." />;
  else if (config.kind === "donut") {
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    body = (
      <div className="grid items-center gap-4 p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={groups} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={1} stroke="none" isAnimationActive={false}>
                {groups.map((group) => <Cell key={String(group.key)} fill={colorOf(group)} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums text-foreground">{total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            <span className="text-xs text-text-tertiary">Total</span>
          </div>
        </div>
        <ul className="grid gap-1.5">
          {groups.map((group) => (
            <li key={String(group.key)} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(group) }} />
              <span className="min-w-0 flex-1 truncate text-foreground">{group.label}</span>
              <span className="tabular-nums text-text-secondary">{group.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else {
    body = (
      <div className="h-64 p-4">
        <ResponsiveContainer width="100%" height="100%">
          {config.kind === "line" ? (
            <LineChart data={groups} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border, #e4e4e7)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="value" stroke="var(--primary, #0ea5e9)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          ) : (
            <BarChart data={groups} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border, #e4e4e7)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-subtle, #f4f4f5)" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {groups.map((group) => <Cell key={String(group.key)} fill={colorOf(group)} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  return <BlockFrame title={config.title} fill={fill}>{body}</BlockFrame>;
}
