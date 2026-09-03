"use client";

import React, { useMemo, useState } from "react";
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
  SPONSOR_ROWS,
  FORECAST_WEEKS,
  FORECAST_ACTUAL,
  FORECAST_MEAN,
  FORECAST_UPPER,
  FORECAST_LOWER,
  NPS_SPLIT,
  RATING_DIST,
  SATIS_DIMS,
  AGE_SPLIT,
  CITY_ROWS,
  AGE_SPEND,
} from "./demo_data";

const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;

// ---------- Sponsor ROI ----------
export function SponsorScreen() {
  const [range, setRange] = useState("90d");

  const stats = [
    { label: "Impressions", value: "171,800", delta: "+9.4%", trend: "up", footer: "Booths + rooms" },
    { label: "Booth scans", value: "6,434", delta: "+12.1%", trend: "up", footer: "Badge taps" },
    { label: "Leads", value: "1,714", delta: "+10.8%", trend: "up", footer: "Qualified handoffs" },
    { label: "Avg cost / lead", value: "$22.40", delta: "-4.2%", trend: "down", footer: "Spend vs leads" },
  ];

  const leadsOption = useMemo(
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
          data: [...SPONSOR_ROWS].sort((a, b) => b.leads - a.leads).map((r) => r.sponsor),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: [...SPONSOR_ROWS].sort((a, b) => b.leads - a.leads).map((r) => r.leads),
            barWidth: 15,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#34d399") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11 },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(70),
          },
        ],
      }),
    [],
  );

  const scatterOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1000,
        tooltip: {
          ...itemTooltip,
          formatter: (p) => `${p.data[3]}<br/>Spend ${money(p.data[0])} · ${p.data[1]} leads<br/>${p.data[2].toLocaleString()} impressions`,
        },
        grid: baseGrid(),
        xAxis: valueAxis({ name: "Spend", nameTextStyle: { color: INK.faint, fontSize: 10 }, axisLabel: { formatter: (v) => `$${v / 1000}k` } }),
        yAxis: valueAxis({ name: "Leads", nameTextStyle: { color: INK.faint, fontSize: 10 } }),
        series: [
          {
            type: "scatter",
            symbolSize: (d) => Math.max(12, Math.sqrt(d[2]) / 6),
            itemStyle: { color: "#38bdf8", opacity: 0.85, borderColor: "#0c4a6e", borderWidth: 1, shadowBlur: 12, shadowColor: "rgba(56,189,248,0.35)" },
            emphasis: { scale: 1.35, focus: "self", itemStyle: { shadowBlur: 18, opacity: 1 } },
            animationDelay: staggerDelay(90, 550),
            data: SPONSOR_ROWS.map((r) => [r.spend, r.leads, r.impressions, r.sponsor]),
            markLine: { silent: true, symbol: "none", lineStyle: { color: "#525252", type: "dashed" }, label: { color: INK.faint, fontSize: 10 }, data: [{ type: "average", name: "Avg leads" }] },
          },
        ],
      }),
    [],
  );

  const tierOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
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
            selectedOffset: 6,
            itemStyle: { borderRadius: 7, borderColor: "#1a1a1a", borderWidth: 3 },
            label: { color: INK.muted, fontSize: 11, formatter: "{b}\n{d}%" },
            labelLine: { lineStyle: { color: "#333" } },
            emphasis: emphasisPie,
            data: [
              { name: "Platinum", value: 888 },
              { name: "Gold", value: 582 },
              { name: "Silver", value: 244 },
            ],
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "sponsor", header: "Sponsor", render: (r) => <span className="font-medium text-foreground">{r.sponsor}</span> },
    { key: "tier", header: "Tier", render: (r) => <StatusPill status={r.tier} map={{ Platinum: { label: "Platinum", variant: "success" }, Gold: { label: "Gold", variant: "warning" }, Silver: { label: "Silver", variant: "neutral" } }} /> },
    { key: "leads", header: "Leads", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.leads}</span> },
    { key: "cpl", header: "Cost / lead", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => money(r.spend / r.leads) },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Sponsor ROI"
        description="Impressions, booth scans, leads and cost-per-lead per sponsor."
        range={range}
        setRange={setRange}
        onExport={csvExport("sponsor-roi.csv", SPONSOR_ROWS)}
      />
      <StatsBar stats={stats} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Leads per sponsor" description="Qualified handoffs ranked." option={leadsOption} height={340} />
        <ChartCard title="Spend vs leads" description="Bubble size is impressions. Hover to inspect." option={scatterOption} height={340} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Leads by tier" description="Where pipeline concentrates. Click to isolate." option={tierOption} height={320} />
        <SectionCard title="Sponsor detail" description="The numbers each sponsor will ask for.">
          <DataTable columns={columns} data={SPONSOR_ROWS} getRowKey={(r) => r.sponsor} />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

// ---------- Forecast ----------
export function ForecastScreen() {
  const [range, setRange] = useState("90d");

  const stats = [
    { label: "Projected revenue", value: "$312,000", delta: "+9.6%", trend: "up", footer: "At current pace" },
    { label: "Projected attendance", value: "6,840", delta: "+7.2%", trend: "up", footer: "Final headcount" },
    { label: "Confidence", value: "87%", footer: "Model fit" },
    { label: "Days to sellout", value: "14", footer: "At current velocity" },
  ];

  const forecastOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1100,
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: ["Actual", "Forecast", "Confidence"] },
        grid: baseGrid(),
        xAxis: categoryAxis(FORECAST_WEEKS),
        yAxis: valueAxis({ axisLabel: { formatter: (v) => `$${v / 1000}k` } }),
        dataZoom: [{ type: "inside", throttle: 60 }],
        series: [
          {
            name: "Confidence",
            type: "line",
            data: FORECAST_LOWER,
            symbol: "none",
            stack: "band",
            silent: true,
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            tooltip: { show: false },
          },
          {
            name: "Confidence",
            type: "line",
            data: FORECAST_UPPER.map((v, i) =>
              v == null || FORECAST_LOWER[i] == null ? null : v - FORECAST_LOWER[i],
            ),
            symbol: "none",
            stack: "band",
            silent: true,
            lineStyle: { opacity: 0 },
            areaStyle: { color: "rgba(56,189,248,0.14)" },
            tooltip: { show: false },
          },
          {
            name: "Actual",
            type: "line",
            data: FORECAST_ACTUAL,
            smooth: 0.4,
            symbol: "circle",
            symbolSize: 6,
            clip: true,
            lineStyle: { width: 2.5, color: "#ffffff" },
            itemStyle: { color: "#fff", borderColor: "#161616", borderWidth: 2 },
            areaStyle: { color: areaGradient("#ffffff", 0.18, 0.01) },
            emphasis: emphasisLine,
            markPoint: {
              symbol: "pin",
              symbolSize: 36,
              label: { color: "#161616", fontSize: 10, fontWeight: 700 },
              itemStyle: { color: "#ffffff" },
              animationDuration: 800,
              data: [{ coord: [5, 18900], value: "now" }],
            },
          },
          {
            name: "Forecast",
            type: "line",
            data: FORECAST_MEAN,
            smooth: 0.4,
            symbol: "circle",
            symbolSize: 5,
            clip: true,
            lineStyle: { width: 2.5, color: "#38bdf8", type: [6, 5] },
            itemStyle: { color: "#38bdf8", borderColor: "#161616", borderWidth: 2 },
            emphasis: emphasisLine,
          },
        ],
      }),
    [],
  );

  const paceOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: baseTooltip(),
        legend: { ...baseLegend, data: ["Sold", "Remaining"] },
        grid: baseGrid(),
        xAxis: categoryAxis(FORECAST_WEEKS.slice(0, 6)),
        yAxis: valueAxis(),
        series: [
          { name: "Sold", type: "bar", stack: "cap", data: [320, 410, 520, 640, 720, 860], barWidth: 18, itemStyle: { borderRadius: [0, 0, 0, 0], color: "#e7e7e7" }, emphasis: emphasisBar, animationDelay: staggerDelay(55) },
          { name: "Remaining", type: "bar", stack: "cap", data: [680, 590, 480, 360, 280, 140], barWidth: 18, itemStyle: { borderRadius: [6, 6, 0, 0], color: "#2e2e2e" }, emphasis: emphasisBar, animationDelay: staggerDelay(55) },
        ],
      }),
    [],
  );

  const rows = FORECAST_WEEKS.map((w, i) => ({
    week: w,
    actual: FORECAST_ACTUAL[i] ?? "—",
    forecast: FORECAST_MEAN[i] ?? "—",
    low: FORECAST_LOWER[i] ?? "—",
    high: FORECAST_UPPER[i] ?? "—",
  }));

  const columns = [
    { key: "week", header: "Week", render: (r) => <span className="font-medium text-foreground">{r.week}</span> },
    { key: "actual", header: "Actual", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => (typeof r.actual === "number" ? money(r.actual) : "—") },
    { key: "forecast", header: "Forecast", align: "right", className: "text-right tabular-nums", render: (r) => (typeof r.forecast === "number" ? <span className="font-semibold text-foreground">{money(r.forecast)}</span> : "—") },
    { key: "low", header: "Low", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => (typeof r.low === "number" ? money(r.low) : "—") },
    { key: "high", header: "High", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => (typeof r.high === "number" ? money(r.high) : "—") },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Revenue Forecasting"
        description="Projected final revenue and attendance from the current sales curve."
        range={range}
        setRange={setRange}
        onExport={csvExport("forecast.csv", rows)}
      />
      <StatsBar stats={stats} />
      <ChartCard title="Actual vs forecast" description="Solid is booked revenue — dashed is the model with its confidence band." option={forecastOption} height={360} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Capacity pacing" description="Sold vs remaining per week." option={paceOption} height={320} />
        <SectionCard title="Weekly forecast" description="The model output, week by week.">
          <DataTable columns={columns} data={rows} getRowKey={(r) => r.week} />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

// ---------- Surveys & NPS ----------
export function SurveysScreen() {
  const [range, setRange] = useState("90d");

  const stats = [
    { label: "NPS", value: "62", delta: "+6", trend: "up", footer: "Promoters minus detractors" },
    { label: "Satisfaction", value: "4.6 / 5", delta: "+0.2", trend: "up", footer: "Average rating" },
    { label: "Responses", value: "1,842", delta: "+12.4%", trend: "up", footer: "Surveys completed" },
    { label: "Response rate", value: "34%", delta: "+2.1%", trend: "up", footer: "Of attendees" },
  ];

  const npsOption = useMemo(
    () =>
      withEnter({
        backgroundColor: "transparent",
        animationDuration: 1400,
        animationEasingUpdate: "cubicOut",
        series: [
          {
            type: "gauge",
            startAngle: 210,
            endAngle: -30,
            min: -100,
            max: 100,
            progress: { show: true, width: 14, itemStyle: { color: "#34d399" } },
            axisLine: { roundCap: true, lineStyle: { width: 14, color: [[0.5, "#3f3f3f"], [1, "#2a2a2a"]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            title: { show: false },
            detail: { valueAnimation: true, offsetCenter: [0, "8%"], fontSize: 36, fontWeight: 700, color: "#fff", formatter: "62" },
            data: [{ value: 62 }],
          },
        ],
      }),
    [],
  );

  const ratingOption = useMemo(
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
          data: RATING_DIST.map((r) => r.stars),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 12 },
        },
        series: [
          {
            type: "bar",
            data: RATING_DIST.map((r, i) => ({ value: r.count, itemStyle: { color: ["#ffffff", "#38bdf8", "#a3a3a3", "#fbbf24", "#525252"][i], borderRadius: [0, 7, 7, 0] } })),
            barWidth: 16,
            label: { show: true, position: "right", color: INK.faint, fontSize: 11 },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(70),
          },
        ],
      }),
    [],
  );

  const satisOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1100,
        tooltip: { ...itemTooltip },
        legend: { ...baseLegend, data: ["Score"] },
        radar: {
          indicator: SATIS_DIMS.map((d) => ({ name: d, max: 5 })),
          axisName: { color: INK.muted, fontSize: 11 },
          splitLine: { lineStyle: { color: "#2e2e2e" } },
          splitArea: { areaStyle: { color: ["transparent", "rgba(255,255,255,0.02)"] } },
          axisLine: { lineStyle: { color: "#2e2e2e" } },
        },
        series: [
          {
            name: "Score",
            type: "radar",
            symbol: "circle",
            symbolSize: 5,
            lineStyle: { color: "#fbbf24", width: 2.5 },
            itemStyle: { color: "#fbbf24" },
            areaStyle: { color: areaGradient("#fbbf24", 0.28, 0.03) },
            emphasis: emphasisLine,
            data: [{ value: [4.7, 4.8, 4.4, 4.2, 4.6, 4.5] }],
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "name", header: "Segment", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "value", header: "Responses", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.value.toLocaleString()}</span> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Surveys & NPS"
        description="Did they like it — NPS, satisfaction and rating spread."
        range={range}
        setRange={setRange}
        onExport={csvExport("nps.csv", NPS_SPLIT)}
      />
      <StatsBar stats={stats} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Net promoter score" description="62 — firmly in excellent territory." option={npsOption} height={320} />
        <ChartCard title="Rating distribution" description="How 5-to-1 stars stack up." option={ratingOption} height={320} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Satisfaction by dimension" description="What delighted and what lagged." option={satisOption} height={360} />
        <SectionCard title="NPS breakdown" description="Promoters, passives and detractors.">
          <DataTable columns={columns} data={NPS_SPLIT} getRowKey={(r) => r.name} />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

// ---------- Demographics ----------
export function DemographicsScreen() {
  const [range, setRange] = useState("90d");

  const stats = [
    { label: "Top segment", value: "25–34", footer: "41% of attendees" },
    { label: "Top city", value: "New York", footer: "1,242 attendees" },
    { label: "International", value: "18%", delta: "+2.4%", trend: "up", footer: "Outside home country" },
    { label: "Returning", value: "42%", delta: "+5.1%", trend: "up", footer: "Attended before" },
  ];

  const ageOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        tooltip: { ...itemTooltip, formatter: (p) => `${p.name}<br/>${p.value.toLocaleString()} · ${p.percent}%` },
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
            data: AGE_SPLIT,
          },
        ],
      }),
    [],
  );

  const cityOption = useMemo(
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
          data: CITY_ROWS.map((r) => r.city),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: INK.muted, fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: CITY_ROWS.map((r) => r.attendees),
            barWidth: 14,
            itemStyle: { borderRadius: [0, 7, 7, 0], color: barGradient("#38bdf8") },
            label: { show: true, position: "right", color: INK.faint, fontSize: 11 },
            emphasis: emphasisBar,
            animationDelay: staggerDelay(55),
          },
        ],
      }),
    [],
  );

  const spendOption = useMemo(
    () =>
      withEnter({
        color: PALETTE,
        backgroundColor: "transparent",
        animationDuration: 1000,
        tooltip: { ...itemTooltip, formatter: (p) => `Age ${p.value[0]}<br/>Spend ${money(p.value[1])}` },
        grid: baseGrid(),
        xAxis: valueAxis({ name: "Age", nameTextStyle: { color: INK.faint, fontSize: 10 } }),
        yAxis: valueAxis({ name: "Avg spend", nameTextStyle: { color: INK.faint, fontSize: 10 }, axisLabel: { formatter: (v) => `$${v}` } }),
        series: [
          {
            type: "scatter",
            symbolSize: 12,
            itemStyle: { color: "#f472b6", opacity: 0.85, borderColor: "#831843", borderWidth: 1, shadowBlur: 10, shadowColor: "rgba(244,114,182,0.35)" },
            emphasis: { scale: 1.4, focus: "self", itemStyle: { opacity: 1, shadowBlur: 16 } },
            animationDelay: staggerDelay(60, 800),
            data: AGE_SPEND,
            markLine: { silent: true, symbol: "none", lineStyle: { color: "#525252", type: "dashed" }, label: { color: INK.faint, fontSize: 10 }, data: [{ type: "average", name: "Avg" }] },
          },
        ],
      }),
    [],
  );

  const columns = [
    { key: "city", header: "City", render: (r) => <span className="font-medium text-foreground">{r.city}</span> },
    { key: "attendees", header: "Attendees", align: "right", className: "text-right tabular-nums", render: (r) => <span className="font-semibold text-foreground">{r.attendees.toLocaleString()}</span> },
  ];

  return (
    <MainScreenWrapper>
      <ReportHeader
        title="Demographics"
        description="Who came — age, home cities and spend behaviour."
        range={range}
        setRange={setRange}
        onExport={csvExport("demographics.csv", CITY_ROWS)}
      />
      <StatsBar stats={stats} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Age distribution" description="Share of attendees per bracket. Click to isolate." option={ageOption} height={340} />
        <ChartCard title="Age vs spend" description="Average order value climbs, then softens. Hover points." option={spendOption} height={340} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Top cities" description="Where attendees travelled from." option={cityOption} height={360} />
        <SectionCard title="City detail" description="Exact headcounts per city.">
          <DataTable columns={columns} data={CITY_ROWS} getRowKey={(r) => r.city} />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}
