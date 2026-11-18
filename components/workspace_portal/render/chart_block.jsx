"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { useBlockData } from "./use_block_data";

const HEX = { gray: "#a1a1aa", blue: "#0ea5e9", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", pink: "#ec4899", teal: "#14b8a6" };
const colorOf = (group) => HEX[group.color] ?? HEX.blue;
const number = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const short = (text) => (String(text).length > 14 ? `${String(text).slice(0, 13)}…` : text);

// Bar, line or donut over the records the viewer can see, grouped by status, a choice field or a date, in a card like the other data blocks.
export function ChartBlock({ block, fill }) {
  const config = block.config;
  const { data, error, loading, reload } = useBlockData(block, {});
  const groups = data?.groups ?? [];
  const rows = groups.map((group) => ({ ...group, fill: colorOf(group) }));
  // Tooltips name each point by its group label; the series itself is "value".
  const chartConfig = { value: { label: config.title || "Records", color: "var(--primary)" }, ...Object.fromEntries(rows.map((row) => [row.label, { label: row.label }])) };
  // On a canvas the chart grows into its cell; elsewhere it keeps a fixed height.
  const sized = cn("aspect-auto h-64 w-full", fill && "@4xl/page:h-auto @4xl/page:min-h-40 @4xl/page:flex-1");

  let body;
  if (loading) body = <BlockLoading label="Loading chart" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!groups.length) body = <EmptyRows text="No data yet." />;
  else if (config.kind === "donut") {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    body = (
      <div className="@container/block flex flex-1 items-center">
        <div className="grid w-full items-center gap-6 @md/block:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="relative mx-auto size-44">
            <ChartContainer config={chartConfig} className="aspect-square size-full">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="label" />} />
                <Pie data={rows} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={2} cornerRadius={3} stroke="none" fillOpacity={0.85} isAnimationActive={false}>
                  {rows.map((row) => <Cell key={String(row.key)} fill={row.fill} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">{total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Total</span>
            </div>
          </div>
          <ul className="grid w-full max-w-xs gap-0.5 justify-self-center @md/block:justify-self-start">
            {rows.map((row) => (
              <li key={String(row.key)} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-hover">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                <span className="font-medium tabular-nums text-foreground">{number(row.value)}</span>
                <span className="w-9 text-right text-xs tabular-nums text-text-secondary">{total ? `${Math.round((row.value / total) * 100)}%` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  } else if (config.kind === "line") {
    body = (
      <ChartContainer config={chartConfig} className={sized}>
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" tickFormatter={short} />
          <YAxis tickLine={false} axisLine={false} tickMargin={4} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    );
  } else {
    body = (
      <ChartContainer config={chartConfig} className={sized}>
        <BarChart data={rows} margin={{ top: 20, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tickFormatter={short} />
          <YAxis tickLine={false} axisLine={false} tickMargin={4} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="label" />} />
          <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={36} fillOpacity={0.85} isAnimationActive={false}>
            {rows.map((row) => <Cell key={String(row.key)} fill={row.fill} />)}
            <LabelList dataKey="value" position="top" offset={6} className="fill-text-secondary" fontSize={11} formatter={number} />
          </Bar>
        </BarChart>
      </ChartContainer>
    );
  }

  return <BlockFrame title={config.title} fill={fill} bodyClassName="flex flex-col p-5">{body}</BlockFrame>;
}
