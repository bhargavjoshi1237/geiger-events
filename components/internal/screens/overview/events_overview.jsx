"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CreditCard,
  DollarSign,
  QrCode,
  Sparkles,
  Ticket,
  UserCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "./filter_dropdown";
import { cn } from "@/lib/utils";

const CHART_COLORS = {
  primary: "#ffffff",
  secondary: "#a3a3a3",
  muted: "#737373",
  grid: "#2a2a2a",
  appBackground: "#161616",
};

const CHART_SERIES_COLORS = ["#ffffff", "#e5e5e5", "#a3a3a3", "#737373", "#474747"];

const METRIC_CARD_CHART_COLOR = "#10b981";

const PLACEHOLDER_COUNT = 0;

function getCount(value) {
  return Number.isFinite(value) ? value : PLACEHOLDER_COUNT;
}

// --- Metric card with area sparkline -----------------------------------------

function MetricCard({ title, subtitle, value, icon: Icon, data }) {
  const chartData =
    data && data.length > 0
      ? data.map((v, i) => ({ value: v, time: i }))
      : Array.from({ length: 11 }).map((_, i) => ({ value: 0, time: i }));

  const fillId = `metric-fill-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const chartConfig = { value: { label: title, color: METRIC_CARD_CHART_COLOR } };

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e7e7e7] overflow-hidden group hover:border-[#474747] transition-all duration-300">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-center gap-2 text-[#a3a3a3]">
          <div className="w-5 h-5 rounded bg-[#2a2a2a] flex items-center justify-center">
            {Icon && <Icon className="w-3 h-3 text-[#737373]" />}
          </div>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <p className="text-xs text-[#525252]">{subtitle}</p>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardHeader>
      <CardContent className="p-0 h-32 relative transition-colors -mb-2">
        <div className="absolute inset-0 flex items-end">
          <ChartContainer config={chartConfig} className="w-[90%] mx-auto mb-6 h-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                fill={`url(#${fillId})`}
                fillOpacity={1}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="absolute bottom-2 left-4 text-[10px] text-[#404040] flex justify-between w-[calc(100%-32px)]">
          <span>No start timestamp</span>
          <span>No end timestamp</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetShell({ children, className, contentClassName }) {
  return (
    <Card
      className={cn(
        "bg-[#1a1a1a] border-[#2a2a2a] text-[#e7e7e7] rounded-xl py-0 gap-0 overflow-hidden",
        className,
      )}
    >
      <CardContent className={cn("p-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

// --- Registrations over time (area) ------------------------------------------

const REGISTRATION_RANGE_OPTIONS = [
  { value: "rsvps", label: "RSVPs" },
  { value: "tickets", label: "Tickets sold" },
  { value: "revenue", label: "Revenue" },
];

const EMPTY_TIMESERIES = Array.from({ length: 12 }).map((_, i) => ({
  label: `W${i + 1}`,
  value: 0,
}));

function RegistrationsTrendWidget() {
  const [metric, setMetric] = useState("rsvps");
  const selected =
    REGISTRATION_RANGE_OPTIONS.find((o) => o.value === metric) ||
    REGISTRATION_RANGE_OPTIONS[0];

  return (
    <WidgetShell className="h-[420px]" contentClassName="h-full">
      <div className="flex h-full flex-col">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-base font-semibold text-[#ededed]">Registrations Over Time</h3>
            <p className="text-sm text-[#a3a3a3]">{selected.label} across your events.</p>
          </div>
          <FilterDropdown
            value={metric}
            onValueChange={setMetric}
            options={REGISTRATION_RANGE_OPTIONS}
            height="h-9"
          />
        </div>
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <ChartContainer
            config={{ value: { label: selected.label, color: CHART_COLORS.primary } }}
            className="mx-auto h-[260px] w-full"
          >
            <AreaChart data={EMPTY_TIMESERIES} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="registrations-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                fill="url(#registrations-fill)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="mt-2 min-h-[44px] text-center">
          <p className="text-sm font-semibold text-[#ededed]">No registrations yet</p>
          <p className="mt-1 text-sm text-[#737373]">
            Trend data appears once registrations come in.
          </p>
        </div>
      </div>
    </WidgetShell>
  );
}

// --- Ticket type mix (donut) -------------------------------------------------

const TICKET_MIX = [
  { key: "free", label: "Free", value: 0 },
  { key: "paid", label: "Paid", value: 0 },
  { key: "vip", label: "VIP", value: 0 },
];

function TicketMixWidget() {
  const [selectedType, setSelectedType] = useState("free");
  const total = TICKET_MIX.reduce((sum, item) => sum + getCount(item.value), 0);
  const chartData = TICKET_MIX.map((item) => ({
    ...item,
    value: getCount(item.value),
    fill: `var(--color-${item.key})`,
  }));
  const selectedIndex = Math.max(
    chartData.findIndex((item) => item.key === selectedType),
    0,
  );
  const selectedItem = chartData[selectedIndex] || chartData[0];
  const typeOptions = TICKET_MIX.map((item) => ({ value: item.key, label: item.label }));
  const chartConfig = TICKET_MIX.reduce(
    (config, item, index) => ({
      ...config,
      [item.key]: {
        label: item.label,
        color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      },
    }),
    {},
  );

  return (
    <WidgetShell className="h-[420px]" contentClassName="h-full">
      <div className="flex h-full flex-col">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-base font-semibold text-[#ededed]">Ticket Type Mix</h3>
            <p className="text-sm text-[#a3a3a3]">Distribution across ticket types.</p>
          </div>
          <FilterDropdown
            value={selectedType}
            onValueChange={setSelectedType}
            options={typeOptions}
            height="h-9"
          />
        </div>
        <div className="relative mt-4 flex min-h-0 w-full flex-1 items-center justify-center">
          <ChartContainer config={chartConfig} className="mx-auto h-[260px] w-[260px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="key"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={84}
                activeIndex={selectedIndex}
                activeShape={{ outerRadius: 94 }}
                onMouseEnter={(_, index) => {
                  setSelectedType(chartData[index]?.key || selectedType);
                }}
                stroke={CHART_COLORS.appBackground}
                strokeWidth={2}
              />
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="text-3xl font-bold leading-none text-[#ffffff]">
              {selectedItem?.value ?? total}
            </span>
            <span className="mt-1 text-xs font-medium text-[#a3a3a3]">
              {selectedItem?.label || "Total"}
            </span>
          </div>
        </div>
        <div className="mt-2 min-h-[44px] text-center">
          <p className="text-sm font-semibold text-[#ededed]">
            {selectedItem?.label || "Tickets"} is{" "}
            {total ? Math.round(((selectedItem?.value || 0) / total) * 100) : PLACEHOLDER_COUNT}% of sales
          </p>
          <p className="mt-1 text-sm text-[#737373]">Current ticket type mix</p>
        </div>
      </div>
    </WidgetShell>
  );
}

// --- Traffic sources (radial) ------------------------------------------------

const TRAFFIC_SOURCES = [
  { name: "Direct", value: 0 },
  { name: "Discovery", value: 0 },
  { name: "Social", value: 0 },
  { name: "Email", value: 0 },
];

function TrafficSourcesWidget() {
  const values = TRAFFIC_SOURCES.map((s) => getCount(s.value));
  const max = Math.max(PLACEHOLDER_COUNT, ...values);
  const chartMax = max || 1;
  const rings = TRAFFIC_SOURCES.map((source, index) => ({
    ...source,
    key: `source${index}`,
    value: getCount(source.value),
    fill: `var(--color-source${index})`,
  }));
  const chartConfig = rings.reduce(
    (config, ring, index) => ({
      ...config,
      [ring.key]: {
        label: ring.name,
        color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      },
    }),
    { value: { label: "Sources" } },
  );

  return (
    <WidgetShell className="h-[420px]" contentClassName="h-full">
      <div className="flex h-full flex-col">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-base font-semibold text-[#ededed]">Traffic Sources</h3>
            <p className="text-sm text-[#a3a3a3]">Where registrations come from.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-1 items-center justify-center">
          <div className="relative h-[260px] w-[260px] shrink-0">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full [&_.recharts-radial-bar-background-sector]:fill-[#333333]"
            >
              <RadialBarChart data={rings} startAngle={90} endAngle={-270} innerRadius={38} outerRadius={112}>
                <PolarAngleAxis type="number" domain={[0, chartMax]} tick={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <RadialBar dataKey="value" background cornerRadius={8} />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[28px] font-extrabold leading-none text-[#ffffff]">{max}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 min-h-[44px] text-center">
          <p className="text-sm font-semibold text-[#ededed]">No source data yet</p>
          <p className="mt-1 text-sm text-[#737373]">
            Attribution appears once traffic is tracked.
          </p>
        </div>
      </div>
    </WidgetShell>
  );
}

// --- Empty list sections -----------------------------------------------------

function UpcomingEventsSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-semibold text-[#e7e7e7] tracking-tight leading-tight">
            Upcoming Events
          </h2>
          <p className="text-xs text-[#737373]">Your next scheduled events</p>
        </div>
        <Button
          variant="ghost"
          className="text-xs font-medium text-[#737373] hover:text-[#e7e7e7] hover:bg-transparent px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
      <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#202020] p-10 text-center">
        <CalendarClock className="mx-auto mb-3 h-6 w-6 text-[#525252]" />
        <p className="text-sm font-medium text-[#e7e7e7]">No upcoming events</p>
        <p className="mt-1 text-xs text-[#737373]">
          Events you create will appear here once backend data is connected.
        </p>
      </div>
    </div>
  );
}

function RecentActivitySection() {
  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="px-1">
          <h2 className="text-lg font-semibold text-[#e7e7e7] tracking-tight leading-tight">
            Recent Activity
          </h2>
          <p className="text-xs text-[#737373]">Latest registrations and check-ins</p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
        <p className="text-sm font-medium text-[#e7e7e7]">No activity yet</p>
        <p className="mt-1 text-xs text-[#737373]">
          Activity will appear here after backend fetching is connected.
        </p>
      </div>
    </div>
  );
}

// --- Screen ------------------------------------------------------------------

export function EventsOverviewScreen() {
  const [filterValue, setFilterValue] = useState("1w");

  const headerStats = [
    { label: "Live Events", value: "0" },
    { label: "Registrations", value: "0" },
    { label: "Revenue", value: "$0" },
  ];

  return (
    <MainScreenWrapper>
      <div className="flex flex-col md:flex-row md:items-center justify-between mt-2 gap-4">
        <div className="flex items-center justify-center md:justify-start gap-3 w-full md:w-auto text-center md:text-left">
          <h1 className="text-2xl font-bold text-white tracking-tight">Events Overview</h1>
          <span className="bg-[#1a1a1a] text-[#737373] text-[9px] px-1.5 py-0.5 rounded border border-[#2a2a2a] font-mono tracking-widest shrink-0">
            WORKSPACE
          </span>
        </div>
        <div className="w-full md:w-auto">
          <div className="flex w-full md:w-auto md:gap-0">
            {headerStats.map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  "flex-1 md:flex-none flex flex-col items-center",
                  index === 0 ? "md:pr-8" : "border-l border-[#2a2a2a] md:px-8 last:md:pr-0 last:md:pl-8",
                )}
              >
                <span className="text-[#737373] text-[11px] uppercase tracking-wider font-medium">
                  {stat.label}
                </span>
                <span className="text-white font-bold text-2xl mt-0.5">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full mt-2 mb-6">
        <p className="text-zinc-500 text-sm text-center md:text-left">
          Plan, run, and relive every event. Track registrations, ticket sales, check-ins, and
          revenue across all your events from one place.
        </p>
      </div>

      <div className="pt-4 border-t border-[#242424]">
        <FilterDropdown value={filterValue} onValueChange={setFilterValue} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Registrations" subtitle="Total sign-ups" value="0" icon={UserCheck} data={[]} />
        <MetricCard title="Ticket Revenue" subtitle="Gross sales" value="$0" icon={DollarSign} data={[]} />
        <MetricCard title="Check-ins" subtitle="Attendees scanned" value="0" icon={QrCode} data={[]} />
        <MetricCard title="New RSVPs" subtitle="This period" value="0" icon={Sparkles} data={[]} />
      </div>

      <UpcomingEventsSection />

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          <RegistrationsTrendWidget />
        </div>
        <div className="min-w-0 flex-1">
          <TicketMixWidget />
        </div>
        <div className="min-w-0 flex-1">
          <TrafficSourcesWidget />
        </div>
      </div>

      <RecentActivitySection />
    </MainScreenWrapper>
  );
}

export default EventsOverviewScreen;
