"use client";

import React, { useMemo, useState } from "react";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { StatsBar, SectionCard, DataTable } from "@/components/internal/shared/screen_kit";
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
  SOURCES,
  TRAFFIC_DAYS,
  TRAFFIC_SERIES,
  FUNNEL_STEPS,
  FUNNEL_BY_SOURCE,
  EMAIL_DAYS,
  EMAIL_OPENS,
  EMAIL_CLICKS,
  EMAIL_CAMPAIGNS,
  ENGAGE_HOURS,
  ENGAGE_DAYS,
  ENGAGE_HEAT,
  POLL_SESSIONS,
  CHAT_VOLUME,
} from "./demo_data";

const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const rangeTake = (range) => (range === "7d" ? 7 : range === "30d" ? 10 : 14);

// ---------- Traffic ----------
export function TrafficScreen() {
  const [range, setRange] = useState("30d");
  const replayKey = range;

  const scoped = useMemo(() => {
    const n = rangeTake(range);
    const days = TRAFFIC_DAYS.slice(-n);
    const series = Object.fromEntries(
      Object.entries(TRAFFIC_SERIES).map(([k, v]) => [k, v.slice(-n)]),
    );
    return { days, series };
  }, [range]);

  const stats = [
    { label: "Page views", value: "48,200", delta: "+14.2%", trend: "up", footer: "Event pages" },
    { label: "Unique visitors", value: "31,700", delta: "+9.8%", trend: "up", footer: "De-duplicated" },
    { label: "Conversion", value: "4.1%", delta: "+0.6%", trend: "up", footer: "Visitor to paid" },
    { label: "Attributed revenue", value: "$96,800", delta: "+12.0%", trend: "up", footer: "By first-touch source" },
  ];

  const donutOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: { ...itemTooltip, formatter: (p) => `${p.name}<br/>${p.value.toLocaleString()} sessions · ${p.percent}%` },
        legend: { ...baseLegend },
        series: [
          {
            type: "pie",
            radius: ["58%", "78%"],
            center: ["50%", "46%"],
            padAngle: 2,
            animationType: "scale",
            selectedMode: "single",
            selectedOffset: 6,
            itemStyle: { borderRadius: 7, borderColor: "#1a1a1a", borderWidth: 3 },
            label: { color: INK.muted, fontSize: 11, formatter: "{b}\n{d}%" },
            labelLine: { lineStyle: { color: "#333" } },
            emphasis: emphasisPie,
            data: SOURCES.map((s) => ({ name: s.name, value: s.sessions })),
          },
        ],
      }),
    [],
  );

  const stackOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1000,
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: Object.keys(scoped.series) },
        grid: baseGrid(),
        xAxis: categoryAxis(scoped.days),
        yAxis: valueAxis(),
        dataZoom: [{ type: "inside", throttle: 60 }],
        series: Object.entries(scoped.series).map(([name, data]) => ({
          name,
          type: "line",
          stack: "traffic",
          data,
          smooth: 0.4,
          symbol: "none",
          clip: true,
          lineStyle: { width: 1.5 },
          areaStyle: { opacity: 0.55 },
          emphasis: emphasisLine,
        })),
      }),
    [scoped],
  );

  const sankeyOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1000,
        tooltip: { ...itemTooltip },
        series: [
          {
            type: "sankey",
            left: 8,
            right: 90,
            top: 12,
            bottom: 12,
            nodeGap: 10,
            nodeWidth: 12,
            label: { color: INK.muted, fontSize: 11 },
            lineStyle: { color: "gradient", opacity: 0.35, curveness: 0.5 },
            itemStyle: { borderWidth: 0, borderRadius: 4 },
            emphasis: { focus: "adjacency", blurScope: "coordinateSystem" },
            data: [
              ...SOURCES.map((s) => ({ name: s.name })),
              { name: "General" },
              { name: "VIP" },
              { name: "Early-bird" },
            ],
            links: [
              { source: "Direct", target: "General", value: 420 },
              { source: "Direct", target: "VIP", value: 180 },
              { source: "Instagram", target: "General", value: 380 },
              { source: "Instagram", target: "Early-bird", value: 220 },
              { source: "Google", target: "General", value: 300 },
              { source: "Google", target: "VIP", value: 90 },
              { source: "Email", target: "Early-bird", value: 420 },
              { source: "Email", target: "VIP", value: 160 },
              { source: "Referral", target: "General", value: 150 },
              { source: "TikTok", target: "General", value: 170 },
            ],
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "name", header: "Source", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "sessions", header: "Sessions", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.sessions.toLocaleString() },
    { key: "revenue", header: "Revenue", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{money(r.revenue)}</span> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Traffic & Sources"
        description="Where buyers come from and the revenue each source brings."
        range={range}
        setRange={setRange}
        onExport={csvExport("traffic-by-source.csv", SOURCES)}
      />
      <StatsBar stats={stats} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Sessions by source" description="Share of event-page sessions. Click to isolate." option={donutOption} height={340} />
        <ChartCard title="Source to ticket flow" description="How each source converts into ticket types. Hover a node." option={sankeyOption} height={340} />
      </div>
      <ChartCard title="Traffic over time" description="Stacked sessions per source, per day. Scroll to zoom." option={stackOption} replayKey={replayKey} height={320} />
      <SectionCard title="Source breakdown" description="Sessions and attributed revenue per source.">
        <DataTable columns={columns} data={SOURCES} getRowKey={(r) => r.name} />
      </SectionCard>
    </MainScreenWrapper>
  );
}

// ---------- Funnels ----------
export function FunnelScreen() {
  const [range, setRange] = useState("30d");

  const stats = [
    { label: "Page views", value: "18,420", delta: "+10.4%", trend: "up", footer: "Top of funnel" },
    { label: "Paid", value: "1,932", delta: "+8.1%", trend: "up", footer: "Bottom of funnel" },
    { label: "Overall conversion", value: "10.5%", delta: "+0.4%", trend: "up", footer: "Views to paid" },
    { label: "Abandoned value", value: "$42,800", delta: "-3.2%", trend: "down", footer: "Started, never paid" },
  ];

  const funnelOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1100,
        tooltip: { ...itemTooltip, formatter: (p) => `${p.name}<br/>${p.value.toLocaleString()} · ${p.percent}%` },
        series: [
          {
            type: "funnel",
            left: "8%",
            right: "8%",
            top: 16,
            bottom: 12,
            sort: "descending",
            gap: 6,
            minSize: "12%",
            label: { show: true, position: "inside", color: "#fff", fontSize: 12, fontWeight: 600, formatter: "{b}\n{c}" },
            labelLine: { show: false },
            itemStyle: { borderColor: "#161616", borderWidth: 2, borderRadius: 4 },
            emphasis: { label: { fontSize: 13 }, focus: "self" },
            animationDelay: staggerDelay(120, 500),
            data: FUNNEL_STEPS.map((s, i) => ({
              name: s.step,
              value: s.count,
              itemStyle: { color: ["#ffffff", "#38bdf8", "#a78bfa", "#34d399"][i % 4], opacity: 0.92 - i * 0.12 },
            })),
          },
        ],
      }),
    [],
  );

  const bySourceOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        grid: { ...baseGrid(), left: 4, top: 12 },
        xAxis: valueAxis(),
        yAxis: {
          type: "category",
          inverse: true,
          data: FUNNEL_BY_SOURCE.map((r) => r.source),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: FUNNEL_BY_SOURCE.map((r) => Math.round((r.paid / r.views) * 1000) / 10),
            barWidth: 16,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#34d399") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11, formatter: (p) => `${p.value}%` },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(60),
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "step", header: "Step", render: (r) => <span className="font-medium text-foreground">{r.step}</span> },
    { key: "count", header: "Count", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.count.toLocaleString()}</span> },
    { key: "pctPrev", header: "Vs previous", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.pctPrev },
    { key: "pctAll", header: "Vs top", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.pctAll },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Conversion Funnels"
        description="Page view to paid — where buyers drop off and what it costs."
        range={range}
        setRange={setRange}
        onExport={csvExport("funnel.csv", FUNNEL_STEPS)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Checkout funnel" description="Each stage as a share of page views." option={funnelOption} height={380} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Conversion by source" description="Paid share of views per source." option={bySourceOption} height={320} />
        <SectionCard title="Step detail" description="Counts and conversion at every step.">
          <DataTable columns={columns} data={FUNNEL_STEPS} getRowKey={(r) => r.step} />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

// ---------- Email ----------
export function EmailScreen() {
  const [range, setRange] = useState("30d");
  const replayKey = range;

  const scoped = useMemo(() => {
    const n = range === "7d" ? 4 : range === "30d" ? 6 : EMAIL_DAYS.length;
    return {
      days: EMAIL_DAYS.slice(-n),
      opens: EMAIL_OPENS.slice(-n),
      clicks: EMAIL_CLICKS.slice(-n),
    };
  }, [range]);

  const stats = [
    { label: "Sent", value: "72,400", delta: "+6.2%", trend: "up", footer: "Across campaigns" },
    { label: "Open rate", value: "42.8%", delta: "+1.4%", trend: "up", footer: "Unique opens" },
    { label: "Click rate", value: "6.4%", delta: "+0.8%", trend: "up", footer: "Unique clicks" },
    { label: "Bounce", value: "0.8%", delta: "-0.2%", trend: "down", footer: "Hard + soft" },
  ];

  const trendOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip({ valueFormatter: (v) => `${v}%` }),
        legend: { ...baseLegend, data: ["Open %", "Click %"] },
        grid: baseGrid(),
        xAxis: categoryAxis(scoped.days),
        yAxis: valueAxis({ axisLabel: { formatter: "{value}%" } }),
        dataZoom: [{ type: "inside", throttle: 60 }],
        series: [
          {
            name: "Open %",
            type: "line",
            data: scoped.opens,
            smooth: 0.45,
            symbol: "circle",
            symbolSize: 6,
            showSymbol: false,
            clip: true,
            lineStyle: { width: 2.5, color: "#ffffff" },
            itemStyle: { color: "#fff" },
            areaStyle: { color: areaGradient("#ffffff", 0.2, 0.01) },
            emphasis: emphasisLine,
            animationDuration: 1100,
          },
          {
            name: "Click %",
            type: "line",
            data: scoped.clicks,
            smooth: 0.45,
            symbol: "circle",
            symbolSize: 6,
            showSymbol: false,
            clip: true,
            lineStyle: { width: 2.5, color: "#38bdf8" },
            itemStyle: { color: "#38bdf8" },
            areaStyle: { color: areaGradient("#38bdf8", 0.25, 0.01) },
            emphasis: emphasisLine,
            animationDuration: 1100,
          },
        ],
      }),
    [scoped],
  );

  const campaignOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip({ valueFormatter: (v) => `${v}%` }),
        legend: { ...baseLegend, data: ["Open %", "Click %"] },
        grid: baseGrid(),
        xAxis: categoryAxis(EMAIL_CAMPAIGNS.map((c) => c.name.split(" ").slice(0, 2).join(" ")), { axisLabel: { fontSize: 10, rotate: 16 } }),
        yAxis: valueAxis({ axisLabel: { formatter: "{value}%" } }),
        series: [
          { name: "Open %", type: "bar", data: EMAIL_CAMPAIGNS.map((c) => c.open), barWidth: 14, itemStyle: { borderRadius: [5, 5, 0, 0], color: "#e7e7e7" }, emphasis: emphasisBar, animationDelay: staggerDelay(50) },
          { name: "Click %", type: "bar", data: EMAIL_CAMPAIGNS.map((c) => c.click), barWidth: 14, itemStyle: { borderRadius: [5, 5, 0, 0], color: "#38bdf8" }, emphasis: emphasisBar, animationDelay: staggerDelay(50, 500) },
        ],
      }),
    [],
  );

  const deliveryOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1100,
        tooltip: { ...itemTooltip },
        series: [
          {
            type: "funnel",
            left: "8%",
            right: "8%",
            top: 16,
            bottom: 12,
            sort: "descending",
            gap: 6,
            minSize: "10%",
            label: { show: true, position: "inside", color: "#fff", fontSize: 11, fontWeight: 600, formatter: "{b} {c}" },
            labelLine: { show: false },
            itemStyle: { borderColor: "#161616", borderWidth: 2, borderRadius: 4 },
            emphasis: { focus: "self" },
            animationDelay: staggerDelay(110, 550),
            data: [
              { name: "Sent", value: 72400, itemStyle: { color: "#ffffff", opacity: 0.95 } },
              { name: "Delivered", value: 71800, itemStyle: { color: "#38bdf8", opacity: 0.9 } },
              { name: "Opened", value: 30700, itemStyle: { color: "#a78bfa", opacity: 0.85 } },
              { name: "Clicked", value: 4630, itemStyle: { color: "#34d399", opacity: 0.8 } },
              { name: "Converted", value: 1180, itemStyle: { color: "#fbbf24", opacity: 0.85 } },
            ],
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "name", header: "Campaign", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "sent", header: "Sent", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => r.sent.toLocaleString() },
    { key: "open", header: "Open", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => `${r.open}%` },
    { key: "click", header: "Click", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{`${r.click}%`}</span> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Email Performance"
        description="Delivered, opened, clicked and converted — per campaign and over time."
        range={range}
        setRange={setRange}
        onExport={csvExport("email-campaigns.csv", EMAIL_CAMPAIGNS)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Open & click trend" description="Unique open and click rate per send. Scroll to zoom." option={trendOption} replayKey={replayKey} height={320} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Delivery funnel" description="From sent to converted." option={deliveryOption} height={360} />
        <ChartCard title="Campaign comparison" description="Open vs click per campaign." option={campaignOption} height={360} />
      </div>
      <SectionCard title="Campaign detail" description="Every send with its core metrics.">
        <DataTable columns={columns} data={EMAIL_CAMPAIGNS} getRowKey={(r) => r.name} />
      </SectionCard>
    </MainScreenWrapper>
  );
}

// ---------- Engagement ----------
export function EngagementScreen() {
  const [range, setRange] = useState("30d");

  const stats = [
    { label: "Sessions / attendee", value: "2.4", delta: "+0.3", trend: "up", footer: "Average depth" },
    { label: "Chat messages", value: "12,840", delta: "+18.2%", trend: "up", footer: "Across rooms" },
    { label: "Poll votes", value: "8,420", delta: "+12.6%", trend: "up", footer: "All polls" },
    { label: "Q&A questions", value: "642", delta: "+8.4%", trend: "up", footer: "Asked + upvoted" },
  ];

  const heatOption = useMemo(() => {
    const data = [];
    ENGAGE_HEAT.forEach((row, y) => row.forEach((v, x) => data.push([x, y, v])));
    return withEnter({
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: { ...itemTooltip, formatter: (p) => `${ENGAGE_DAYS[p.value[1]]} · ${ENGAGE_HOURS[p.value[0]]}<br/>${p.value[2]} interactions` },
      grid: { ...baseGrid(), top: 8 },
      xAxis: categoryAxis(ENGAGE_HOURS, { splitArea: { show: false } }),
      yAxis: { type: "category", inverse: true, data: ENGAGE_DAYS, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.muted, fontSize: 11 } },
      visualMap: {
        min: 0,
        max: 140,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: { color: INK.faint, fontSize: 10 },
        inRange: { color: ["#242424", "#38bdf8", "#ffffff"] },
      },
      series: [
        {
          type: "heatmap",
          data,
          label: { show: false },
          itemStyle: { borderColor: "#161616", borderWidth: 3, borderRadius: 5 },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(255,255,255,0.3)", borderColor: "#fff", borderWidth: 1 } },
        },
      ],
    });
  }, []);

  const pollOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        grid: { ...baseGrid(), left: 4, top: 12 },
        xAxis: valueAxis(),
        yAxis: {
          type: "category",
          inverse: true,
          data: POLL_SESSIONS.map((p) => p.session),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: POLL_SESSIONS.map((p) => p.votes),
            barWidth: 14,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#fbbf24") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11 },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(60),
          },
        ],
      }),
    [],
  );

  const chatOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        grid: baseGrid(),
        xAxis: categoryAxis(ENGAGE_HOURS),
        yAxis: valueAxis(),
        dataZoom: [{ type: "inside", throttle: 60 }],
        series: [
          {
            type: "line",
            data: CHAT_VOLUME,
            smooth: 0.45,
            symbol: "none",
            clip: true,
            lineStyle: { width: 2.5, color: "#a78bfa" },
            areaStyle: { color: areaGradient("#a78bfa", 0.3, 0.02) },
            emphasis: emphasisLine,
            animationDuration: 1100,
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "session", header: "Session", render: (r) => <span className="font-medium text-foreground">{r.session}</span> },
    { key: "votes", header: "Poll votes", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.votes.toLocaleString()}</span> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Engagement"
        description="Sessions attended, chat, polls and Q&A — how deeply people took part."
        range={range}
        setRange={setRange}
        onExport={csvExport("engagement-by-session.csv", POLL_SESSIONS)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Engagement heatmap" description="Interactions by day and hour. Drag the slider to filter intensity." option={heatOption} height={380} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Poll votes by session" description="Which sessions pulled participation." option={pollOption} height={340} />
        <ChartCard title="Chat volume" description="Messages across the event day. Scroll to zoom." option={chatOption} height={340} />
      </div>
      <SectionCard title="Session detail" description="Poll participation per session.">
        <DataTable columns={columns} data={POLL_SESSIONS} getRowKey={(r) => r.session} />
      </SectionCard>
    </MainScreenWrapper>
  );
}
