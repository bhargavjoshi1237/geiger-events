"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { StatsBar, SectionCard, DataTable, StatusPill } from "@/components/internal/shared/screen_kit";
import { ReportHeader, ChartCard, csvExport } from "./report_frame";
import {
  PALETTE,
  INK,
  areaGradient,
  barGradient,
  baseTooltip,
  itemTooltip,
  baseGrid,
  baseLegend,
  categoryAxis,
  valueAxis,
  withEnter,
  staggerDelay,
  emphasisLine,
  emphasisBar,
  emphasisPie,
} from "./theme";
import {
  SALES_WEEKS,
  SALES_REVENUE,
  SALES_TICKETS,
  TICKET_MIX,
  SALES_BY_EVENT,
  ARRIVAL_BUCKETS,
  ARRIVALS,
  ARRIVALS_CUM,
  GATE_SPLIT,
  ATTENDANCE_ROWS,
  PORTFOLIO_ROWS,
  BENCHMARK_DIMS,
  BENCHMARK_AVG,
  BENCHMARK_TOP,
} from "./demo_data";

const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const rangeTake = (range) => (range === "7d" ? 5 : range === "30d" ? 10 : 14);
const eventScale = (event) => (event === "all" ? 1 : 0.34);

// ---------- Sales ----------
export function SalesScreen() {
  const [event, setEvent] = useState("all");
  const [range, setRange] = useState("30d");
  const replayKey = `${range}|${event}`;

  const scoped = useMemo(() => {
    const n = rangeTake(range);
    const k = eventScale(event);
    return {
      weeks: SALES_WEEKS.slice(-n),
      revenue: SALES_REVENUE.slice(-n).map((v) => Math.round(v * k)),
      tickets: SALES_TICKETS.slice(-n).map((v) => Math.round(v * k)),
    };
  }, [range, event]);

  const stats = [
    { label: "Total revenue", value: "$248,620", delta: "+12.4%", trend: "up", footer: "Vs previous period" },
    { label: "Tickets sold", value: "4,812", delta: "+9.1%", trend: "up", footer: "Across 6 events" },
    { label: "Avg order value", value: "$86.40", delta: "+3.2%", trend: "up", footer: "Per checkout" },
    { label: "Refund rate", value: "2.1%", delta: "-0.4%", trend: "down", footer: "Of gross revenue" },
  ];

  const trendOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip({ trigger: "axis" }),
        legend: { ...baseLegend, data: ["Revenue", "Tickets"] },
        grid: baseGrid(),
        xAxis: categoryAxis(scoped.weeks),
        yAxis: [
          valueAxis({ name: "", axisLabel: { ...valueAxis().axisLabel, formatter: (v) => `$${v / 1000}k` } }),
          valueAxis({ splitLine: { show: false }, axisLabel: { color: "#525252", fontSize: 11 } }),
        ],
        dataZoom: [{ type: "inside", throttle: 60, zoomOnMouseWheel: true, moveOnMouseMove: true }],
        series: [
          {
            name: "Tickets",
            type: "bar",
            yAxisIndex: 1,
            data: scoped.tickets,
            barWidth: 14,
            itemStyle: { borderRadius: [5, 5, 0, 0], color: "#333333" },
            emphasis: { ...emphasisBar, itemStyle: { color: "#474747" } },
            animationDelay: staggerDelay(45),
          },
          {
            name: "Revenue",
            type: "line",
            data: scoped.revenue,
            smooth: 0.45,
            symbol: "circle",
            symbolSize: 6,
            showSymbol: false,
            clip: true,
            lineStyle: { width: 2.5, color: "#ffffff" },
            itemStyle: { color: "#ffffff", borderColor: "#161616", borderWidth: 2 },
            areaStyle: { color: areaGradient("#ffffff", 0.22, 0.01) },
            emphasis: emphasisLine,
            animationDuration: 1100,
          },
        ],
      }),
    [scoped],
  );

  const mixOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: { ...itemTooltip, formatter: (p) => `${p.name}<br/>${p.value.toLocaleString()} tickets · ${p.percent}%` },
        legend: { ...baseLegend, data: TICKET_MIX.map((t) => t.name) },
        series: [
          {
            type: "pie",
            radius: ["58%", "78%"],
            center: ["50%", "46%"],
            avoidLabelOverlap: true,
            padAngle: 2,
            animationType: "scale",
            animationEasing: "cubicOut",
            selectedMode: "single",
            selectedOffset: 6,
            itemStyle: { borderRadius: 7, borderColor: "#1a1a1a", borderWidth: 3 },
            label: { color: INK.muted, fontSize: 11, formatter: "{b}\n{d}%" },
            labelLine: { lineStyle: { color: "#333333" } },
            emphasis: emphasisPie,
            data: TICKET_MIX,
          },
        ],
      }),
    [],
  );

  const byEventOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        grid: { ...baseGrid(), left: 4, top: 12 },
        xAxis: valueAxis({ axisLabel: { formatter: (v) => `$${v / 1000}k` } }),
        yAxis: {
          type: "category",
          inverse: true,
          data: SALES_BY_EVENT.map((r) => r.event),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: SALES_BY_EVENT.map((r) => r.revenue),
            barWidth: 14,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#e7e7e7") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11, formatter: (p) => money(p.value) },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(60),
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "event", header: "Event", render: (r) => <span className="font-medium text-foreground">{r.event}</span> },
    { key: "sold", header: "Sold", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.sold.toLocaleString() },
    { key: "revenue", header: "Revenue", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{money(r.revenue)}</span> },
    {
      key: "pace",
      header: "Sell-through",
      render: (r) => {
        const pct = Math.round((r.sold / r.capacity) * 100);
        return (
          <div className="flex min-w-36 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
              <div className="h-full rounded-full bg-[#ededed]" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="text-xs tabular-nums text-text-secondary">{pct}%</span>
          </div>
        );
      },
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} map={{ "On sale": { label: "On sale", variant: "success" }, "Sold out": { label: "Sold out", variant: "warning" }, Draft: { label: "Draft", variant: "neutral" } }} /> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Sales"
        description="Gross revenue, tickets and pacing across every event — demo data, wired for live orders."
        event={event}
        setEvent={setEvent}
        range={range}
        setRange={setRange}
        onExport={csvExport("sales-by-event.csv", SALES_BY_EVENT)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Revenue over time" description="Revenue (line) against tickets sold (bars) per week. Scroll to zoom." option={trendOption} replayKey={replayKey} height={340} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Sales by ticket type" description="Share of tickets sold per type. Click a slice to isolate." option={mixOption} height={340} />
        <ChartCard title="Revenue by event" description="Ranked gross revenue per event." option={byEventOption} height={340} />
      </div>
      <SectionCard title="Event breakdown" description="The exact numbers behind the charts — ready to copy into a deck.">
        <DataTable columns={columns} data={SALES_BY_EVENT} getRowKey={(r) => r.event} />
      </SectionCard>
    </MainScreenWrapper>
  );
}

// ---------- Attendance ----------

export function AttendanceScreen() {
  const [event, setEvent] = useState("all");
  const [range, setRange] = useState("30d");
  const replayKey = `${range}|${event}`;

  const stats = [
    { label: "Registered", value: "9,500", delta: "+8.6%", trend: "up", footer: "Confirmed RSVPs" },
    { label: "Checked in", value: "7,818", delta: "+6.9%", trend: "up", footer: "Scanned on site" },
    { label: "Show rate", value: "82.3%", delta: "+1.8%", trend: "up", footer: "Checked in vs registered" },
    { label: "No-shows", value: "1,682", delta: "-2.1%", trend: "down", footer: "Registered, never arrived" },
  ];

  const arrivalOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: ["Arrivals", "Cumulative"] },
        grid: baseGrid(),
        xAxis: categoryAxis(ARRIVAL_BUCKETS, { axisLabel: { color: "#737373", fontSize: 10 } }),
        yAxis: [valueAxis(), valueAxis({ splitLine: { show: false } })],
        dataZoom: [{ type: "inside", throttle: 60 }],
        series: [
          {
            name: "Arrivals",
            type: "bar",
            data: ARRIVALS,
            barWidth: 16,
            itemStyle: { borderRadius: [6, 6, 0, 0], color: barGradient("#38bdf8") },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(40),
          },
          {
            name: "Cumulative",
            type: "line",
            yAxisIndex: 1,
            data: ARRIVALS_CUM,
            smooth: 0.4,
            symbol: "none",
            clip: true,
            lineStyle: { width: 2.5, color: "#ffffff" },
            areaStyle: { color: areaGradient("#ffffff", 0.16, 0.01) },
            emphasis: emphasisLine,
            animationDuration: 1100,
          },
        ],
      }),
    [],
  );

  const gaugeOption = useMemo(
    () =>
      withEnter({
        backgroundColor: "transparent",
        animationDuration: 1300,
        animationEasingUpdate: "cubicOut",
        series: [
          {
            type: "gauge",
            startAngle: 210,
            endAngle: -30,
            min: 0,
            max: 100,
            progress: { show: true, width: 14, itemStyle: { color: "#34d399" } },
            axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, "#2a2a2a"]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            title: { show: false },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, "8%"],
              fontSize: 34,
              fontWeight: 700,
              color: "#ffffff",
              formatter: "{value}%",
            },
            data: [{ value: 82.3 }],
          },
        ],
      }),
    [],
  );

  const gateOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: { ...itemTooltip },
        grid: { ...baseGrid(), left: 4, top: 12 },
        xAxis: valueAxis(),
        yAxis: {
          type: "category",
          inverse: true,
          data: GATE_SPLIT.map((g) => g.name),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: GATE_SPLIT.map((g) => g.value),
            barWidth: 16,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#a78bfa") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11 },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(70),
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "event", header: "Event", render: (r) => <span className="font-medium text-foreground">{r.event}</span> },
    { key: "registered", header: "Registered", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.registered.toLocaleString() },
    { key: "checkedIn", header: "Checked in", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.checkedIn.toLocaleString()}</span> },
    {
      key: "rate",
      header: "Show rate",
      render: (r) => (
        <div className="flex min-w-36 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${r.rate}%` }} />
          </div>
          <span className="text-xs tabular-nums text-text-secondary">{r.rate}%</span>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Attendance"
        description="Registered vs checked-in, the 15-minute arrival curve and per-gate load."
        event={event}
        setEvent={setEvent}
        range={range}
        setRange={setRange}
        onExport={csvExport("attendance-by-event.csv", ATTENDANCE_ROWS)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Arrival curve" description="Check-ins per 15-minute bucket with the cumulative build." option={arrivalOption} replayKey={replayKey} height={340} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Show rate" description="Checked-in share of all registrations." option={gaugeOption} height={320} />
        <ChartCard title="Check-ins by gate" description="Where arrivals were scanned." option={gateOption} height={320} />
      </div>
      <SectionCard title="Attendance by event" description="Registered, checked-in and show rate per event.">
        <DataTable columns={columns} data={ATTENDANCE_ROWS} getRowKey={(r) => r.event} />
      </SectionCard>
    </MainScreenWrapper>
  );
}

// ---------- Cross-event ----------

export function CrossEventScreen() {
  const [range, setRange] = useState("90d");
  const replayKey = range;

  const stats = [
    { label: "Events", value: "12", footer: "In portfolio" },
    { label: "Total revenue", value: "$287,400", delta: "+11.2%", trend: "up", footer: "Vs last quarter" },
    { label: "Avg sell-through", value: "74%", delta: "+4.0%", trend: "up", footer: "Sold vs capacity" },
    { label: "Avg attendance", value: "81%", delta: "+1.2%", trend: "up", footer: "Checked in vs registered" },
  ];

  const compareOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: ["Revenue"] },
        grid: baseGrid(),
        xAxis: categoryAxis(PORTFOLIO_ROWS.map((r) => r.event.split(" ").slice(0, 2).join(" ")), { axisLabel: { fontSize: 10, rotate: 18 } }),
        yAxis: valueAxis({ axisLabel: { formatter: (v) => `$${v / 1000}k` } }),
        series: [
          {
            name: "Revenue",
            type: "bar",
            data: PORTFOLIO_ROWS.map((r) => r.revenue),
            barWidth: 22,
            itemStyle: {
              borderRadius: [7, 7, 0, 0],
              color: (p) => (p.dataIndex === 0 ? "#ffffff" : "#3f3f3f"),
            },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(55),
          },
        ],
      }),
    [],
  );

  const radarOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: { ...itemTooltip },
        legend: { ...baseLegend, data: ["Portfolio avg", "Top event"] },
        radar: {
          indicator: BENCHMARK_DIMS.map((d) => ({ name: d, max: 100 })),
          axisName: { color: INK.muted, fontSize: 11 },
          splitLine: { lineStyle: { color: "#2e2e2e" } },
          splitArea: { areaStyle: { color: ["transparent", "rgba(255,255,255,0.02)"] } },
          axisLine: { lineStyle: { color: "#2e2e2e" } },
        },
        series: [
          {
            type: "radar",
            symbol: "circle",
            symbolSize: 5,
            animationDuration: 1100,
            emphasis: emphasisLine,
            data: [
              { name: "Portfolio avg", value: BENCHMARK_AVG, lineStyle: { color: "#737373", width: 2 }, itemStyle: { color: "#737373" }, areaStyle: { color: areaGradient("#737373", 0.25, 0.02) } },
              { name: "Top event", value: BENCHMARK_TOP, lineStyle: { color: "#ffffff", width: 2.5 }, itemStyle: { color: "#ffffff" }, areaStyle: { color: areaGradient("#ffffff", 0.2, 0.01) } },
            ],
          },
        ],
      }),
    [],
  );

  const treemapOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1000,
        tooltip: { ...itemTooltip, formatter: (p) => `${p.name}<br/>${money(p.value)}` },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: "zoomToNode",
            breadcrumb: { show: false },
            label: { show: true, color: "#e7e7e7", fontSize: 11, formatter: "{b}\n${c}" },
            upperLabel: { show: false },
            itemStyle: { borderColor: "#161616", borderWidth: 3, gapWidth: 3, borderRadius: 8 },
            levels: [{ itemStyle: { borderWidth: 0 } }],
            emphasis: { focus: "descendant" },
            data: PORTFOLIO_ROWS.map((r, i) => ({
              name: r.event,
              value: r.revenue,
              itemStyle: { color: ["#e7e7e7", "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#737373"][i % 6] },
            })),
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "event", header: "Event", render: (r) => <span className="font-medium text-foreground">{r.event}</span> },
    { key: "revenue", header: "Revenue", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{money(r.revenue)}</span> },
    { key: "sellThrough", header: "Sell-through", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => `${r.sellThrough}%` },
    { key: "attendance", header: "Attendance", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => `${r.attendance}%` },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Cross-event Reporting"
        description="The portfolio view — every event on the same metrics, with benchmarks."
        range={range}
        setRange={setRange}
        onExport={csvExport("portfolio.csv", PORTFOLIO_ROWS)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Revenue comparison" description="Gross revenue ranked across the portfolio." option={compareOption} replayKey={replayKey} height={340} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Benchmark radar" description="Portfolio average vs your top event." option={radarOption} height={360} />
        <ChartCard title="Revenue share" description="Each event's share of total revenue. Click to zoom." option={treemapOption} height={360} />
      </div>
      <SectionCard title="Portfolio table" description="Sortable, exportable — the numbers behind the charts.">
        <DataTable columns={columns} data={PORTFOLIO_ROWS} getRowKey={(r) => r.event} />
      </SectionCard>
    </MainScreenWrapper>
  );
}

// ---------- Real-time ----------

export function RealtimeScreen() {
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [live]);

  const minutes = useMemo(() => Array.from({ length: 30 }, (_, i) => `-${29 - i}m`), []);
  const arrivals = useMemo(
    () => Array.from({ length: 30 }, (_, i) => 18 + Math.round(22 * Math.abs(Math.sin((i + tick) / 4)) + ((i * 7 + tick * 13) % 9))),
    [tick],
  );
  const sales = useMemo(
    () => Array.from({ length: 30 }, (_, i) => 4 + Math.round(10 * Math.abs(Math.cos((i + tick) / 5)) + ((i * 5 + tick * 7) % 5))),
    [tick],
  );

  const stats = [
    { label: "In venue now", value: String(1842 + tick * 3), footer: "Checked in, not exited" },
    { label: "Sales / min", value: String(6 + (tick % 5)), footer: "Last 5 minutes" },
    { label: "Arrivals / min", value: String(42 + (tick % 11)), footer: "At the gates" },
    { label: "Revenue today", value: money(48200 + tick * 240), footer: "Gross, all events" },
  ];

  const liveOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 800,
        animationDurationUpdate: 600,
        animationEasingUpdate: "cubicOut",
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: ["Arrivals/min", "Sales/min"] },
        grid: baseGrid(),
        xAxis: categoryAxis(minutes, { axisLabel: { fontSize: 9, interval: 4 } }),
        yAxis: valueAxis(),
        series: [
          {
            name: "Arrivals/min",
            type: "line",
            data: arrivals,
            smooth: 0.45,
            symbol: "none",
            clip: true,
            lineStyle: { width: 2.5, color: "#34d399" },
            areaStyle: { color: areaGradient("#34d399", 0.28, 0.02) },
            emphasis: emphasisLine,
          },
          {
            name: "Sales/min",
            type: "line",
            data: sales,
            smooth: 0.45,
            symbol: "none",
            clip: true,
            lineStyle: { width: 2, color: "#ffffff", type: "solid" },
            emphasis: emphasisLine,
          },
        ],
      }),
    [minutes, arrivals, sales],
  );

  const capacityOption = useMemo(
    () =>
      withEnter({
        backgroundColor: "transparent",
        animationDuration: 900,
        animationDurationUpdate: 700,
        series: [
          {
            type: "gauge",
            startAngle: 210,
            endAngle: -30,
            min: 0,
            max: 100,
            progress: { show: true, width: 14, itemStyle: { color: "#38bdf8" } },
            axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, "#2a2a2a"]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            title: { show: false },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, "8%"],
              fontSize: 32,
              fontWeight: 700,
              color: "#fff",
              formatter: `${Math.min(96, 68 + tick)}%`,
            },
            data: [{ value: Math.min(96, 68 + tick) }],
          },
        ],
      }),
    [tick],
  );

  const mixOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDurationUpdate: 600,
        tooltip: { ...itemTooltip },
        legend: { ...baseLegend },
        series: [
          {
            type: "pie",
            radius: ["58%", "78%"],
            center: ["50%", "46%"],
            padAngle: 2,
            animationType: "scale",
            selectedMode: "single",
            itemStyle: { borderRadius: 7, borderColor: "#1a1a1a", borderWidth: 3 },
            label: { color: INK.muted, fontSize: 11, formatter: "{b} {d}%" },
            labelLine: { lineStyle: { color: "#333" } },
            emphasis: emphasisPie,
            data: [
              { name: "GA", value: 1120 + tick * 2 },
              { name: "VIP", value: 284 },
              { name: "Early-bird", value: 412 },
              { name: "Door", value: 96 + tick },
            ],
          },
        ],
      }),
    [tick],
  );

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Real-time Dashboards"
        description="Live sales and arrivals for the ops desk — auto-refreshing demo stream."
        onExport={csvExport("realtime-snapshot.csv", [{ tick, arrivals: arrivals[29], sales: sales[29] }])}
      />
      <StatsBar stats={stats} />
      <ChartCard
        title="Live pulse"
        description={live ? "Updating every 2s — arrivals and sales per minute." : "Paused — resume for the live stream."}
        action={
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-active"
          >
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-[#525252]"}`} />
            {live ? "Live" : "Paused"}
          </button>
        }
        option={liveOption}
        height={340}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Venue capacity" description="Checked-in share of venue capacity." option={capacityOption} height={300} />
        <ChartCard title="Live ticket mix" description="What is selling right now." option={mixOption} height={300} />
      </div>
    </MainScreenWrapper>
  );
}
