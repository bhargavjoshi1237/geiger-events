"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@geiger/ui/button";
import { Card, CardContent } from "@geiger/ui/card";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Gauge,
  RotateCcw,
  Ticket,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import {
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@geiger/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@geiger/ui/table";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  RollingNumber,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { EVENT_STATUS_MAP } from "@/components/internal/screens/events/sample_data";
import FilterDropdown from "./filter_dropdown";
import { tabToSlug } from "@/lib/workspace/tabs";
import { cn } from "@/lib/utils";
import { useOptionalProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import { listRegistrations } from "@/lib/supabase/registrations";
import { listAttendanceByProject } from "@/lib/supabase/checkin";
import { listOrderRefunds } from "@/lib/supabase/order_refunds";
import { listDisputes } from "@/lib/supabase/order_disputes";

const CHART_COLORS = {
  primary: "#ffffff",
  appBackground: "#161616",
};

const CHART_SERIES_COLORS = ["#ffffff", "#d4d4d4", "#a3a3a3", "#737373", "#525252"];

function formatCurrency(value) {
  return `$${Math.round(value || 0).toLocaleString("en-US")}`;
}

const DEMO_WORKSPACE_SUMMARY = [
  { label: "Events", value: "24" },
  { label: "Upcoming", value: "6" },
  { label: "Attendees", value: "3,420" },
];

const DEMO_STATS = [
  { label: "Registrations", value: "1,284", delta: "+12.5%", trend: "up", footer: "VS Last Period" },
  { label: "Ticket Revenue", value: "$24,860", delta: "+8.2%", trend: "up", footer: "VS Last Period" },
  { label: "Check-ins", value: "962", delta: "+5.1%", trend: "up", footer: "VS Last Period" },
  { label: "New RSVPs", value: "148", delta: "-3.4%", trend: "down", footer: "VS Last Period" },
];

const DEMO_TREND_SERIES = {
  rsvps: [40, 62, 55, 80, 72, 96, 110, 105, 130, 148, 160, 182],
  tickets: [20, 35, 30, 48, 52, 60, 75, 82, 90, 104, 120, 138],
  revenue: [400, 720, 650, 980, 1100, 1450, 1600, 1820, 2100, 2480, 2750, 3120],
};

const REGISTRATION_RANGE_OPTIONS = [
  { value: "rsvps", label: "RSVPs" },
  { value: "tickets", label: "Tickets sold" },
  { value: "revenue", label: "Revenue" },
];

const DEMO_TICKET_MIX = [
  { key: "paid", label: "Paid", value: 620 },
  { key: "free", label: "Free", value: 540 },
  { key: "vip", label: "VIP", value: 124 },
];

const DEMO_CONVERSION_FUNNEL = [
  { key: "views", label: "Event page views", short: "Views", value: 8420 },
  { key: "started", label: "Registration started", short: "Started", value: 2140 },
  { key: "completed", label: "Registration completed", short: "Completed", value: 1284 },
  { key: "paid", label: "Tickets purchased", short: "Purchased", value: 744 },
];

const DEMO_SELL_THROUGH = { value: 78, sold: 1544, capacity: 1980 };
const DEMO_ATTENDANCE = { value: 82, attended: 962, registered: 1173 };

const DEMO_TOP_EVENTS = [
  { id: "demo-1", name: "Summer Product Launch", status: "On sale", revenue: 9840, sold: 312, capacity: 400, momentum: "fast" },
  { id: "demo-2", name: "Local Music Night", status: "Sold out", revenue: 5400, sold: 300, capacity: 300, momentum: "track" },
  { id: "demo-3", name: "Founder AMA — Live", status: "On sale", revenue: 3120, sold: 128, capacity: 150, momentum: "fast" },
  { id: "demo-4", name: "Design Systems Workshop", status: "Draft", revenue: 2160, sold: 54, capacity: 80, momentum: "slow" },
  { id: "demo-5", name: "Indie Film Screening", status: "On sale", revenue: 1480, sold: 74, capacity: 120, momentum: "slow" },
];

const MOMENTUM_META = {
  fast: { label: "Selling fast", icon: Flame, className: "text-emerald-300" },
  track: { label: "On track", icon: TrendingUp, className: "text-sky-300" },
  slow: { label: "Slow", icon: TrendingDown, className: "text-amber-300" },
  upcoming: { label: "Not yet on sale", icon: Clock, className: "text-text-secondary" },
};

const DEMO_ATTENTION_ITEMS = [
  { key: "refunds", label: "Refund requests", hint: "Awaiting your decision", value: "3", count: 3, cta: "Process", icon: RotateCcw, urgency: "urgent" },
  { key: "disputes", label: "Disputes needing response", hint: "Evidence due soon", value: "1", count: 1, cta: "Respond", icon: AlertTriangle, urgency: "urgent" },
  { key: "waitlist", label: "Waitlist approvals", hint: "Across 3 events", value: "12", count: 12, cta: "Review", icon: Clock, urgency: "soon" },
  { key: "capacity", label: "Events near capacity", hint: "Over 90% sold", value: "4", count: 4, cta: "Manage", icon: Gauge, urgency: "soon" },
  { key: "drafts", label: "Unpublished drafts", hint: "Ready to go live", value: "2", count: 2, cta: "Publish", icon: FileText, urgency: "routine" },
];

const URGENCY_ORDER = ["urgent", "soon", "routine"];

const URGENCY_LABELS = { urgent: "Urgent", soon: "Soon", routine: "Routine" };

const ATTENTION_TAB_TITLES = {
  refunds: "Refunds & Cancellations",
  disputes: "Disputes & Chargebacks",
  waitlist: "Waitlist",
  capacity: "Capacity Limits",
  drafts: "All Events",
};

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function buildWeeklyBuckets(weeks) {
  const end = startOfWeek(new Date());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(end);
    start.setDate(start.getDate() - i * 7);
    buckets.push(start);
  }
  return buckets;
}

function weekLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addToBucket(totals, buckets, dateStr, amount) {
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (t >= buckets[i].getTime()) {
      totals[i] += amount;
      return;
    }
  }
}

function buildWeeklyTrendSeries(orders, registrations, weeks) {
  const rsvps = weeks.map(() => 0);
  const tickets = weeks.map(() => 0);
  const revenue = weeks.map(() => 0);
  for (const r of registrations) addToBucket(rsvps, weeks, r.createdAt, 1);
  for (const o of orders) {
    addToBucket(tickets, weeks, o.createdAt, o.quantity || 0);
    addToBucket(revenue, weeks, o.createdAt, o.total || 0);
  }
  return { rsvps, tickets, revenue };
}

function filterByScope(rows, scope, key = "eventId") {
  return scope.length ? rows.filter((r) => scope.includes(r[key])) : rows;
}

function orderAttendeeCount(rows) {
  return rows.reduce((sum, o) => sum + (o.quantity || 0), 0);
}

function orderRevenueTotal(rows) {
  return rows.reduce((sum, o) => sum + (o.total || 0), 0);
}

function registrationAttendeeCount(rows) {
  return rows.reduce((sum, r) => sum + (r.partySize || 1), 0);
}

function sumInWindow(rows, dateKey, valueFn, startMs, endMs) {
  let total = 0;
  for (const row of rows) {
    const t = new Date(row[dateKey]).getTime();
    if (Number.isFinite(t) && t >= startMs && t < endMs) total += valueFn(row);
  }
  return total;
}

function periodDelta(current, previous) {
  if (previous <= 0) return { delta: null, trend: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { delta: `${pct >= 0 ? "+" : ""}${pct}%`, trend: pct >= 0 ? "up" : "down" };
}

function buildTicketMix(orders) {
  const totals = new Map();
  for (const o of orders) {
    const label = o.ticket || "General Admission";
    totals.set(label, (totals.get(label) || 0) + (o.quantity || 0));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([label, value]) => ({ key: label, label, value }));
  const rest = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
  if (rest > 0) top.push({ key: "__other", label: "Other", value: rest });
  return top;
}

function sellThroughPct(row) {
  return row.capacity > 0 ? row.sold / row.capacity : 0;
}

function momentumFor(row) {
  if (row.status === "Draft" || row.status === "Scheduled") return "upcoming";
  const pct = sellThroughPct(row);
  if (pct >= 0.85) return "fast";
  if (pct >= 0.4) return "track";
  return "slow";
}

const CONFIRMED_REGISTRATION_STATUSES = new Set(["Confirmed", "Checked-in"]);

function WidgetShell({ children, className, contentClassName }) {
  return (
    <Card
      className={cn(
        "bg-surface-subtle border-border text-foreground rounded-xl py-0 gap-0 overflow-hidden h-full",
        className,
      )}
    >
      <CardContent className={cn("p-4 h-full", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function WidgetHeader({ title, subtitle, action }) {
  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function RegistrationsTrendWidget({ demo, pending, events = [], orders = [], registrations = [] }) {
  const [metric, setMetric] = useState("rsvps");
  const [eventScope, setEventScope] = useState([]);
  const selected =
    REGISTRATION_RANGE_OPTIONS.find((o) => o.value === metric) ||
    REGISTRATION_RANGE_OPTIONS[0];

  const weeks = useMemo(() => buildWeeklyBuckets(12), []);
  const scopedOrders = useMemo(() => filterByScope(orders, eventScope), [orders, eventScope]);
  const scopedRegs = useMemo(() => filterByScope(registrations, eventScope), [registrations, eventScope]);
  const hasLiveData = scopedOrders.length > 0 || scopedRegs.length > 0;

  const seriesByMetric = useMemo(() => {
    if (demo) return DEMO_TREND_SERIES;
    return buildWeeklyTrendSeries(scopedOrders, scopedRegs, weeks);
  }, [demo, scopedOrders, scopedRegs, weeks]);

  const series = seriesByMetric[metric] || [];
  const data = series.map((value, i) => ({
    label: demo ? `W${i + 1}` : weekLabel(weeks[i]),
    value,
  }));
  const isRevenue = metric === "revenue";
  const formatValue = (value) =>
    isRevenue ? formatCurrency(value) : value.toLocaleString("en-US");

  const headerAction = (
    <div className="flex items-center gap-2">
      <EventScopeSelect events={events} selected={eventScope} onChange={setEventScope} />
      <FilterDropdown
        value={metric}
        onValueChange={setMetric}
        options={REGISTRATION_RANGE_OPTIONS}
        height="h-9"
      />
    </div>
  );

  // While the fetch is in flight the series is all zeros, so the line sits flat
  // on the baseline and animates up when the real numbers land.
  if (!demo && !pending && !hasLiveData) {
    return (
      <WidgetShell contentClassName="flex flex-col">
        <WidgetHeader
          title="Registrations Over Time"
          subtitle={`${selected.label} across your events.`}
          action={headerAction}
        />
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={TrendingUp}
            title="No activity yet"
            description="Registrations and ticket sales will show up here once people start signing up."
          />
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Registrations Over Time"
        subtitle={`${selected.label} across your events.`}
        action={headerAction}
      />
      <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
        <ChartContainer
          config={{ value: { label: selected.label, color: CHART_COLORS.primary } }}
          className="mx-auto h-full w-full"
        >
          <LineChart data={data} margin={{ top: 24, right: 16, left: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2a" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "#737373", fontSize: 11 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  hideLabel
                  formatter={(value) => (
                    <span className="font-medium tabular-nums text-foreground">
                      {formatValue(value)}
                    </span>
                  )}
                />
              }
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.primary, r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={10}
                className="fill-[#ededed]"
                fontSize={11}
                formatter={formatValue}
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </div>
    </WidgetShell>
  );
}

function TicketMixWidget({ demo, pending, events = [], orders = [] }) {
  const [eventScope, setEventScope] = useState([]);
  const mix = useMemo(() => {
    if (demo) return DEMO_TICKET_MIX;
    return buildTicketMix(filterByScope(orders, eventScope));
  }, [demo, orders, eventScope]);

  const [selectedType, setSelectedType] = useState(null);
  const activeType = mix.some((item) => item.key === selectedType) ? selectedType : mix[0]?.key ?? null;

  const total = mix.reduce((sum, item) => sum + item.value, 0);
  const chartData = mix.map((item, index) => ({
    ...item,
    fill: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
  }));
  const selectedIndex = Math.max(
    chartData.findIndex((item) => item.key === activeType),
    0,
  );
  const selectedItem = chartData[selectedIndex] || chartData[0];
  const typeOptions = mix.map((item) => ({ value: item.key, label: item.label }));
  const chartConfig = mix.reduce(
    (config, item, index) => ({
      ...config,
      [item.key]: {
        label: item.label,
        color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      },
    }),
    {},
  );

  // A donut has no zero shape to draw, so while the fetch is in flight it holds
  // an empty ring on the same geometry the chart will occupy.
  if (pending && !mix.length) {
    return (
      <WidgetShell contentClassName="flex flex-col">
        <WidgetHeader title="Ticket Type Mix" subtitle="Distribution across ticket types." />
        <div className="relative mt-4 flex min-h-0 w-full flex-1 items-center justify-center">
          <div className="h-[156px] w-[156px] rounded-full border-[34px] border-border" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="text-3xl font-bold leading-none text-foreground">0</span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">0% share</span>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-text-secondary">0 of 0 tickets sold</p>
      </WidgetShell>
    );
  }

  if (!mix.length) {
    return (
      <WidgetShell contentClassName="flex flex-col">
        <WidgetHeader title="Ticket Type Mix" subtitle="Distribution across ticket types." />
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Ticket}
            title="No ticket sales yet"
            description="Sell a ticket to see the mix by type."
          />
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Ticket Type Mix"
        subtitle="Distribution across ticket types."
        action={
          <div className="flex items-center gap-2">
            <FilterDropdown
              value={activeType}
              onValueChange={setSelectedType}
              options={typeOptions}
              height="h-9"
            />
          </div>
        }
      />
      <div className="relative mt-4 flex min-h-0 w-full flex-1 items-center justify-center">
        <ChartContainer config={chartConfig} className="mx-auto h-[220px] w-[220px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={78}
              activeIndex={selectedIndex}
              activeShape={{ outerRadius: 88 }}
              stroke={CHART_COLORS.appBackground}
              strokeWidth={2}
              isAnimationActive={true}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className="text-3xl font-bold leading-none text-foreground">{selectedItem?.value}</span>
          <span className="mt-1 text-xs font-medium text-muted-foreground">
            {total > 0 ? Math.round((selectedItem.value / total) * 100) : 0}% share
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-secondary">
        {selectedItem?.value.toLocaleString("en-US")} of {total.toLocaleString("en-US")} tickets sold
      </p>
    </WidgetShell>
  );
}

function ConversionFunnelWidget({ demo, registered, confirmed, checkedIn }) {
  const stages = demo
    ? DEMO_CONVERSION_FUNNEL
    : [
        { key: "registered", label: "Total sign-ups", short: "Registered", value: registered },
        { key: "confirmed", label: "Confirmed / ticketed", short: "Confirmed", value: confirmed },
        { key: "checkedin", label: "Checked in", short: "Checked-in", value: checkedIn },
      ];
  const top = stages[0]?.value || 0;
  const bottom = stages[stages.length - 1]?.value || 0;
  const overall = top > 0 ? Math.round((bottom / top) * 100) : 0;

  const chartData = stages.map((stage) => ({
    ...stage,
    share: top > 0 ? Math.round((stage.value / top) * 100) : 0,
  }));

  const chartConfig = {
    share: { label: "Share of top stage", color: CHART_COLORS.primary },
  };

  const subtitle = demo
    ? "Share of page views reaching each step toward a ticket."
    : "Share of sign-ups reaching each step, from registration to check-in.";

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Registration Funnel"
        subtitle={subtitle}
        action={
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-3xl font-bold leading-none text-white">{overall}%</span>
            <span className="mt-1 text-[11px] text-text-secondary">
              {demo ? "view → ticket" : "registered → checked-in"}
            </span>
          </div>
        }
      />
      <div className="mt-1 flex min-h-0 flex-1 items-center justify-center">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-full max-h-[210px]">
          <RadarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="key"
                  formatter={(value, name, item) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{item.payload.label}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {item.payload.value.toLocaleString("en-US")} · {item.payload.share}%
                      </span>
                    </span>
                  )}
                />
              }
            />
            <PolarGrid stroke="#2a2a2a" />
            <PolarAngleAxis dataKey="short" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
            <Radar
              dataKey="share"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill={CHART_COLORS.primary}
              fillOpacity={0.5}
              dot={{
                r: 4,
                fill: CHART_COLORS.primary,
                fillOpacity: 1,
                stroke: CHART_COLORS.appBackground,
                strokeWidth: 1.5,
              }}
              isAnimationActive={true}
            />
          </RadarChart>
        </ChartContainer>
      </div>
    </WidgetShell>
  );
}

function GaugeWidget({ title, subtitle, caption, events = [], demo, demoValue, demoFootnote, computeLive }) {
  const [eventScope, setEventScope] = useState([]);
  const { pct, footnote } = useMemo(() => {
    if (demo) return { pct: demoValue, footnote: demoFootnote };
    return computeLive(eventScope);
  }, [demo, demoValue, demoFootnote, computeLive, eventScope]);

  const clamped = Math.max(0, Math.min(100, pct));
  const endAngle = 90 - (clamped / 100) * 360;
  const data = [{ name: caption, value: clamped, fill: CHART_COLORS.primary }];

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        action={
          <EventScopeSelect
            events={events}
            selected={eventScope}
            onChange={setEventScope}
          />
        }
      />
      <div className="mt-1 flex min-h-0 flex-1 items-center justify-center">
        <ChartContainer
          config={{ value: { label: caption, color: CHART_COLORS.primary } }}
          className="mx-auto aspect-square h-full max-h-[190px]"
        >
          <RadialBarChart
            data={data}
            startAngle={90}
            endAngle={endAngle}
            innerRadius={72}
            outerRadius={104}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              polarRadius={[78, 66]}
              className="first:fill-[#202020] last:fill-[#1a1a1a]"
            />
            <RadialBar dataKey="value" cornerRadius={8} isAnimationActive={true} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-white text-3xl font-bold"
                        >
                          {clamped}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-xs font-medium"
                        >
                          {caption}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </div>
      {footnote ? (
        <p className="mt-1 text-center text-xs text-text-secondary">{footnote}</p>
      ) : null}
    </WidgetShell>
  );
}

const TOP_EVENTS_SORT_OPTIONS = [
  { value: "revenue", label: "Revenue" },
  { value: "sellthrough", label: "Sell-through" },
];

function TopEventsTable({ demo, pending, events = [] }) {
  const [sortBy, setSortBy] = useState("revenue");
  const [eventScope, setEventScope] = useState([]);
  const router = useRouter();
  const projectId = useOptionalProject()?.projectId ?? null;
  const canOpenEvent = !demo && Boolean(projectId);

  const openEvent = (eventId) =>
    projectId && router.push(`/project/${projectId}/allevents?event=${eventId}`);

  const rows = useMemo(() => {
    if (demo) return DEMO_TOP_EVENTS;
    return filterByScope(events, eventScope, "id").map((e) => ({
      id: e.id,
      name: e.name || "Untitled event",
      status: e.status || "Draft",
      revenue: e.revenue || 0,
      sold: e.sold || 0,
      capacity: e.capacity || 0,
      momentum: momentumFor(e),
    }));
  }, [demo, events, eventScope]);

  const sorted = [...rows]
    .sort((a, b) =>
      sortBy === "revenue" ? b.revenue - a.revenue : sellThroughPct(b) - sellThroughPct(a),
    )
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <WidgetHeader
          title="Top Performing Events"
          subtitle="Ranked by sales momentum and sell-through."
        />
        <div className="flex items-center gap-2">
          <EventScopeSelect
            events={events}
            selected={eventScope}
            onChange={setEventScope}
          />
          <FilterDropdown
            value={sortBy}
            onValueChange={setSortBy}
            options={TOP_EVENTS_SORT_OPTIONS}
            height="h-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
        {/* Mid-fetch the table keeps its header and no rows, rather than
            declaring the project has no events. */}
        {sorted.length === 0 && !pending ? (
          <EmptyState
            icon={CalendarDays}
            title="No events yet"
            description="Create an event to see it ranked here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[180px]">Sell-through</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Momentum</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((event) => {
                const pct = Math.min(100, Math.round(sellThroughPct(event) * 100));
                const meta = MOMENTUM_META[event.momentum] || MOMENTUM_META.track;
                const MomentumIcon = meta.icon;
                return (
                  <TableRow key={event.id} className="border-border">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{event.name}</span>
                        <p className="text-xs text-text-secondary">
                          {event.sold.toLocaleString("en-US")} / {event.capacity.toLocaleString("en-US")} seats
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusPill status={event.status} map={EVENT_STATUS_MAP} />
                    </TableCell>
                    <TableCell>
                      <div className="w-[140px] space-y-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                          <div
                            className="h-full rounded-full bg-[#ededed]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-text-secondary">{pct}%</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-white">
                      {formatCurrency(event.revenue)}
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 font-medium", meta.className)}>
                        <MomentumIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {canOpenEvent ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Open ${event.name}`}
                          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={() => openEvent(event.id)}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function GeneralStatsCard({ items }) {
  const router = useRouter();
  const projectId = useOptionalProject()?.projectId ?? null;
  const sorted = [...items].sort(
    (a, b) => URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency),
  );
  const total = items.length;

  const hrefFor = (item) => {
    const title = ATTENTION_TAB_TITLES[item.key];
    return title && projectId
      ? `/project/${projectId}/${tabToSlug(title)}`
      : null;
  };

  return (
    <WidgetShell contentClassName="flex flex-col">
      <WidgetHeader
        title="Overall Stats"
        subtitle="A quick snapshot of key numbers across your events."
        action={
          <span className="shrink-0 rounded-md border border-border bg-surface-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {total} Legends
          </span>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => {
          const Icon = item.icon;
          const href = hrefFor(item);
          const rowProps = href
            ? { type: "button", onClick: () => router.push(href), tabIndex: 0 }
            : {};
          const RowTag = href ? "button" : "div";
          return (
            <RowTag
              key={item.key}
              {...rowProps}
              className={cn(
                "group flex items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors",
                href && "cursor-pointer hover:bg-surface-card",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="shrink-0 rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                    {URGENCY_LABELS[item.urgency]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">{item.hint}</p>
              </div>
              <span className="shrink-0 text-xl font-bold tabular-nums text-white">{item.value}</span>
              {href ? (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-text-secondary transition-colors group-hover:text-foreground">
                  <ChevronRight className="h-3 w-3" />
                </span>
              ) : null}
            </RowTag>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function EventScopeSelect({ events, selected, onChange }) {
  const all = selected.length === 0;
  const clip = (s) => (s.length > 5 ? `${s.slice(0, 5)}…` : s);
  const label = all
    ? "All"
    : selected.length === 1
      ? clip(events.find((e) => e.id === selected[0])?.name || "1 event")
      : `${selected.length} events`;

  const toggle = (id) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 border-border bg-surface-card text-foreground hover:bg-surface-active"
          disabled={!events.length}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-72 w-56 overflow-y-auto border-border bg-surface-subtle"
      >
        <DropdownMenuCheckboxItem
          checked={all}
          onCheckedChange={() => onChange([])}
          onSelect={(e) => e.preventDefault()}
        >
          All Events
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="bg-border" />
        {events.map((event) => (
          <DropdownMenuCheckboxItem
            key={event.id}
            checked={selected.includes(event.id)}
            onCheckedChange={() => toggle(event.id)}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="truncate">{event.name || "Untitled event"}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EventsOverviewScreen({ demo = false }) {
  const live = !demo;
  const projectCtx = useOptionalProject();
  const projectId = projectCtx?.projectId ?? null;
  const projectLoading = projectCtx?.loading ?? false;

  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(live);
  const [asOf, setAsOf] = useState(0);

  useEffect(() => {
    if (!live || !projectId) return;
    let alive = true;
    Promise.all([
      listEvents(projectId),
      listProjectOrders(projectId),
      listRegistrations(projectId),
      listAttendanceByProject(projectId),
      listOrderRefunds(projectId),
      listDisputes(projectId),
    ]).then(([ev, ord, reg, att, rf, disp]) => {
      if (!alive) return;
      setEvents(ev ?? []);
      setOrders(ord ?? []);
      setRegistrations(reg ?? []);
      setAttendance(att ?? []);
      setRefunds(rf ?? []);
      setDisputes(disp ?? []);
      setAsOf(Date.now());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [live, projectId]);

  const confirmedOrders = useMemo(
    () => orders.filter((o) => o.displayStatus !== "Cancelled"),
    [orders],
  );
  const confirmedRegistrations = useMemo(
    () => registrations.filter((r) => CONFIRMED_REGISTRATION_STATUSES.has(r.status)),
    [registrations],
  );
  const registeredAllTime = useMemo(
    () => orderAttendeeCount(orders) + registrationAttendeeCount(registrations),
    [orders, registrations],
  );
  const confirmedAllTime = useMemo(
    () => orderAttendeeCount(confirmedOrders) + registrationAttendeeCount(confirmedRegistrations),
    [confirmedOrders, confirmedRegistrations],
  );
  const checkedInAllTime = useMemo(
    () => attendance.filter((a) => a.status !== "out").length,
    [attendance],
  );
  const revenueAllTime = useMemo(() => orderRevenueTotal(orders), [orders]);

  const liveWorkspaceSummary = useMemo(() => {
    const today = new Date(new Date().toDateString());
    const upcoming = events.filter((e) => e.date && new Date(e.date) >= today).length;
    return [
      { label: "Events", value: String(events.length) },
      { label: "Upcoming", value: String(upcoming) },
      { label: "Attendees", value: registeredAllTime.toLocaleString("en-US") },
    ];
  }, [events, registeredAllTime]);

  const liveStats = useMemo(() => {
    const now = asOf || 0;
    const cur0 = now - 30 * 86400000;
    const prev0 = cur0 - 30 * 86400000;

    const regCur =
      sumInWindow(orders, "createdAt", (o) => o.quantity || 0, cur0, now) +
      sumInWindow(registrations, "createdAt", (r) => r.partySize || 1, cur0, now);
    const regPrev =
      sumInWindow(orders, "createdAt", (o) => o.quantity || 0, prev0, cur0) +
      sumInWindow(registrations, "createdAt", (r) => r.partySize || 1, prev0, cur0);
    const revCur = sumInWindow(orders, "createdAt", (o) => o.total || 0, cur0, now);
    const revPrev = sumInWindow(orders, "createdAt", (o) => o.total || 0, prev0, cur0);
    const checkinCur = sumInWindow(attendance, "checkedInAt", () => 1, cur0, now);
    const checkinPrev = sumInWindow(attendance, "checkedInAt", () => 1, prev0, cur0);
    const rsvpCur = sumInWindow(registrations, "createdAt", () => 1, cur0, now);
    const rsvpPrev = sumInWindow(registrations, "createdAt", () => 1, prev0, cur0);

    const regDelta = periodDelta(regCur, regPrev);
    const revDelta = periodDelta(revCur, revPrev);
    const checkinDelta = periodDelta(checkinCur, checkinPrev);
    const rsvpDelta = periodDelta(rsvpCur, rsvpPrev);

    return [
      { label: "Registrations", value: registeredAllTime.toLocaleString("en-US"), delta: regDelta.delta, trend: regDelta.trend, footer: "VS Last Period" },
      { label: "Ticket Revenue", value: formatCurrency(revenueAllTime), delta: revDelta.delta, trend: revDelta.trend, footer: "VS Last Period" },
      { label: "Check-ins", value: checkedInAllTime.toLocaleString("en-US"), delta: checkinDelta.delta, trend: checkinDelta.trend, footer: "VS Last Period" },
      { label: "New RSVPs", value: rsvpCur.toLocaleString("en-US"), delta: rsvpDelta.delta, trend: rsvpDelta.trend, footer: "VS Last Period" },
    ];
  }, [orders, registrations, attendance, registeredAllTime, revenueAllTime, checkedInAllTime, asOf]);

  const sellThroughCompute = useCallback(
    (scope) => {
      const scoped = filterByScope(events, scope, "id");
      const sold = scoped.reduce((s, e) => s + (e.sold || 0), 0);
      const capacity = scoped.reduce((s, e) => s + (e.capacity || 0), 0);
      const pct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
      return {
        pct,
        footnote: `${sold.toLocaleString("en-US")} of ${capacity.toLocaleString("en-US")} Seats`,
      };
    },
    [events],
  );

  const attendanceCompute = useCallback(
    (scope) => {
      const scopedOrders = filterByScope(orders, scope).filter((o) => o.displayStatus !== "Cancelled");
      const scopedRegs = filterByScope(registrations, scope).filter((r) =>
        CONFIRMED_REGISTRATION_STATUSES.has(r.status),
      );
      const scopedAttendance = filterByScope(attendance, scope).filter((a) => a.status !== "out");
      const confirmed = orderAttendeeCount(scopedOrders) + registrationAttendeeCount(scopedRegs);
      const checkedIn = scopedAttendance.length;
      const pct = confirmed > 0 ? Math.min(100, Math.round((checkedIn / confirmed) * 100)) : 0;
      return {
        pct,
        footnote: `${checkedIn.toLocaleString("en-US")} of ${confirmed.toLocaleString("en-US")} Showed Up`,
      };
    },
    [orders, registrations, attendance],
  );

  const liveAttentionItems = useMemo(() => {
    const refundRequests = refunds.filter((r) => r.status === "Requested");
    const waitlisted = registrations.filter((r) => r.status === "Waitlisted");
    const waitlistedEvents = new Set(waitlisted.map((r) => r.eventId)).size;
    const nearCapacity = events.filter((e) => e.capacity > 0 && e.sold / e.capacity >= 0.9);
    const drafts = events.filter((e) => e.status === "Draft");
    const openDisputes = disputes.filter((d) => d.status === "Needs response");
    return [
      { key: "refunds", label: "Refund requests", hint: "Awaiting your decision", value: String(refundRequests.length), count: refundRequests.length, cta: "Process", icon: RotateCcw, urgency: "urgent" },
      { key: "disputes", label: "Disputes needing response", hint: "Evidence due soon", value: String(openDisputes.length), count: openDisputes.length, cta: "Respond", icon: AlertTriangle, urgency: "urgent" },
      { key: "waitlist", label: "Waitlist approvals", hint: waitlistedEvents ? `Across ${waitlistedEvents} event${waitlistedEvents === 1 ? "" : "s"}` : "None pending", value: String(waitlisted.length), count: waitlisted.length, cta: "Review", icon: Clock, urgency: "soon" },
      { key: "capacity", label: "Events near capacity", hint: "Over 90% sold", value: String(nearCapacity.length), count: nearCapacity.length, cta: "Manage", icon: Gauge, urgency: "soon" },
      { key: "drafts", label: "Unpublished drafts", hint: "Ready to go live", value: String(drafts.length), count: drafts.length, cta: "Publish", icon: FileText, urgency: "routine" },
    ];
  }, [refunds, registrations, events, disputes]);

  const workspaceSummary = demo ? DEMO_WORKSPACE_SUMMARY : liveWorkspaceSummary;
  const statsData = demo ? DEMO_STATS : liveStats;
  const attentionItems = demo ? DEMO_ATTENTION_ITEMS : liveAttentionItems;

  // No skeleton: the page lays out immediately with every figure at zero and
  // fills in once the fetch lands. Widgets that would otherwise state "nothing
  // here" get told the data is still in flight so they don't jump to a verdict.
  // With no project there is nothing to wait for, so those empty states are the
  // honest answer rather than a permanent hold on zeros.
  const pending = live && (projectLoading || (Boolean(projectId) && loading));

  return (
    <MainScreenWrapper>
      <div className="mt-2">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex w-full items-center justify-center gap-3 text-center md:w-auto md:justify-start md:text-left">
              <h1 className="text-2xl font-bold text-white tracking-tight">Events Overview</h1>

            </div>
            <p className="mt-1 text-center text-sm text-muted-foreground md:text-left">
              Track registrations, ticket sales, check-ins, and revenue across all your events.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="flex w-full md:w-auto md:gap-0">
              {workspaceSummary.map((stat, i) => {
                const last = i === workspaceSummary.length - 1;
                return (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex flex-1 flex-col items-center md:flex-none",
                      i === 0 && "md:pr-8",
                      i > 0 && "border-l border-border",
                      i > 0 && !last && "md:px-8",
                      last && i > 0 && "md:pl-8",
                    )}
                  >
                    <span className="text-text-secondary text-[11px] uppercase tracking-wider font-medium">
                      {stat.label}
                    </span>

                    <RollingNumber
                      value={stat.value}
                      className="mt-0.5 text-2xl font-bold text-white"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <StatsBar stats={statsData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-[360px]">
          <RegistrationsTrendWidget demo={demo} pending={pending} events={events} orders={orders} registrations={registrations} />
        </div>
        <div className="h-[360px]">
          <TicketMixWidget demo={demo} pending={pending} events={events} orders={orders} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-[300px]">
          <ConversionFunnelWidget
            demo={demo}
            registered={registeredAllTime}
            confirmed={confirmedAllTime}
            checkedIn={checkedInAllTime}
          />
        </div>
        <div className="h-[300px]">
          <GaugeWidget
            title="Sell-Through Rate"
            subtitle="Seats sold vs. capacity."
            caption="Sold"
            events={events}
            demo={demo}
            demoValue={DEMO_SELL_THROUGH.value}
            demoFootnote={`${DEMO_SELL_THROUGH.sold.toLocaleString("en-US")} of ${DEMO_SELL_THROUGH.capacity.toLocaleString("en-US")} Seats`}
            computeLive={sellThroughCompute}
          />
        </div>
        <div className="h-[300px]">
          <GaugeWidget
            title="Attendance Rate"
            subtitle="Checked in vs. registered."
            caption="Checked In"
            events={events}
            demo={demo}
            demoValue={DEMO_ATTENDANCE.value}
            demoFootnote={`${DEMO_ATTENDANCE.attended.toLocaleString("en-US")} of ${DEMO_ATTENDANCE.registered.toLocaleString("en-US")} Showed Up`}
            computeLive={attendanceCompute}
          />
        </div>
      </div>

      <TopEventsTable demo={demo} pending={pending} events={events} />

      <GeneralStatsCard items={attentionItems} />
    </MainScreenWrapper>
  );
}

export default EventsOverviewScreen;
