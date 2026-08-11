"use client";

import React, { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Clock,
  Download,
  Filter,
  GitBranch,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Tag,
  Ticket,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Hands-on miniatures for the alternating landing spotlights. They fill the
// frame SpotlightShowcase provides (~70% of a max-w-7xl panel, up to 600px tall),
// so they are drawn as full app surfaces — toolbar, tabs, working columns, and a
// status bar — at the app's own type scale rather than a shrunk screenshot.
// Every value is deterministic so the client render matches SSR.

const SHELL = "flex h-full w-full flex-col overflow-hidden bg-[#1a1a1a]";
const BAR =
  "flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-3 py-2";
const SUBBAR =
  "flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-3 py-1.5";
const FOOT =
  "flex shrink-0 items-center justify-between gap-3 border-t border-white/5 px-3 py-1.5 text-[10px] text-white/30";
const PANEL = "rounded-lg border border-white/[0.07] bg-[#212121]";
const LABEL = "text-[10px] uppercase tracking-wider text-white/35";
const FIELD =
  "flex items-center justify-between gap-2 rounded border border-white/[0.08] bg-[#262626] px-2 py-1 text-[11px] text-white/80";
const NOSCROLL =
  "overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// Small pill used for counts and states across all three demos.
function Chip({ children, tone = "muted", className }) {
  const tones = {
    muted: "border-white/8 text-white/45",
    live: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function Tabs({ items, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] transition-colors",
            value === item
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/70",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Automation — the Workflows builder
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    id: "trigger",
    kind: "Trigger",
    label: "Ticket purchased",
    icon: Ticket,
    accent: "text-indigo-300 border-indigo-400/30 bg-indigo-500/10",
    count: "1,284",
    config: [
      ["Event", "Nightshift 2026", "select"],
      ["Ticket types", "Any", "select"],
      ["Run on add-ons", "Yes", "select"],
    ],
  },
  {
    id: "condition",
    kind: "Condition",
    label: "Ticket type is VIP",
    icon: GitBranch,
    accent: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    count: "412",
    config: [
      ["Field", "Ticket type", "select"],
      ["Operator", "is any of", "select"],
      ["Value", "VIP, VIP + Afterparty", "text"],
      ["Otherwise", "Exit workflow", "select"],
    ],
  },
  {
    id: "email",
    kind: "Action",
    label: "Send email · VIP welcome",
    icon: Mail,
    accent: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    count: "412",
    config: [
      ["Template", "VIP welcome", "select"],
      ["Subject", "You're in — here's your night", "text"],
      ["Send as", "Nightshift Crew", "select"],
      ["Reply-to", "crew@nightshift.live", "text"],
    ],
  },
  {
    id: "wait",
    kind: "Delay",
    label: "Wait 3 days",
    icon: Clock,
    accent: "text-sky-300 border-sky-400/30 bg-sky-500/10",
    count: "88 waiting",
    config: [
      ["Duration", "3 days", "text"],
      ["Skip if", "Event already started", "select"],
      ["Business hours only", "Off", "select"],
    ],
  },
  {
    id: "tag",
    kind: "Action",
    label: "Add tag · vip-2026",
    icon: Tag,
    accent: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    count: "324",
    config: [
      ["Tag", "vip-2026", "select"],
      ["Applies to", "Buyer + guests", "select"],
      ["Overwrite existing", "No", "select"],
    ],
  },
  {
    id: "notify",
    kind: "Action",
    label: "Notify staff · #events",
    icon: Bell,
    accent: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    count: "412",
    config: [
      ["Channel", "#events", "select"],
      ["Message", "New VIP: {{buyer.name}}", "text"],
      ["Mention", "@door-crew", "select"],
    ],
  },
];

const RUNS = [
  { name: "Priya Raman", at: "2m ago", state: "Completed", step: "Notify staff", took: "1.1s" },
  { name: "Marco Silva", at: "14m ago", state: "Waiting · 3d", step: "Wait 3 days", took: "0.9s" },
  { name: "Ada Chen", at: "38m ago", state: "Completed", step: "Notify staff", took: "1.4s" },
  { name: "Tom Okafor", at: "1h ago", state: "Exited · not VIP", step: "Condition", took: "0.3s" },
  { name: "Lena Fischer", at: "2h ago", state: "Completed", step: "Notify staff", took: "1.2s" },
  { name: "Jonas Weber", at: "3h ago", state: "Waiting · 3d", step: "Wait 3 days", took: "1.0s" },
  { name: "Sofia Marino", at: "4h ago", state: "Completed", step: "Notify staff", took: "1.3s" },
];

const RUN_TONE = {
  Completed: "bg-emerald-400",
  "Waiting · 3d": "bg-sky-400",
  "Exited · not VIP": "bg-white/25",
};

// Header for the builder's left pane, which swaps with the active tab.
const LEFT_PANE = {
  Builder: { title: "Sequence", meta: `${STEPS.length} steps` },
  Runs: { title: "Enrolled people", meta: "1,284 total" },
  Logs: { title: "Event log", meta: "Last 24h" },
};

const LOGS = [
  ["21:04:12", "trigger", "Ticket purchased · order #NS-4821 (VIP + Afterparty)"],
  ["21:04:12", "condition", "Ticket type is VIP → true"],
  ["21:04:13", "action", "Email queued · template VIP welcome"],
  ["21:04:13", "action", "Email delivered · priya@raman.co"],
  ["21:04:14", "delay", "Waiting 3 days · resumes 17 Mar 21:04"],
  ["21:04:14", "action", "Tag applied · vip-2026 (buyer + 1 guest)"],
  ["21:04:15", "action", "Posted to #events · 1 mention"],
  ["21:06:38", "condition", "Ticket type is VIP → false · exited"],
];

export function WorkflowSpotlight() {
  const [selected, setSelected] = useState("condition");
  const [active, setActive] = useState(true);
  const [tab, setTab] = useState("Builder");

  const step = STEPS.find((item) => item.id === selected) ?? STEPS[0];

  return (
    <div className={SHELL}>
      <div className={BAR}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30">Workflows /</span>
            <span className="truncate text-[13px] font-medium text-white">
              VIP welcome sequence
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">
            Ran 1,284 times · 99.6% delivered · avg 1.2s
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setActive((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 text-white/40",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "animate-pulse bg-emerald-400" : "bg-white/30",
              )}
            />
            {active ? "Active" : "Paused"}
          </button>
          <span className="hidden h-6 items-center rounded border border-white/10 px-2 text-[11px] text-white/60 sm:inline-flex">
            Test run
          </span>
          <span className="inline-flex h-6 items-center rounded bg-white px-2 text-[11px] font-medium text-zinc-950">
            Publish
          </span>
        </div>
      </div>

      <div className={SUBBAR}>
        <Tabs items={["Builder", "Runs", "Logs"]} value={tab} onChange={setTab} />
        <div className="hidden items-center gap-2 sm:flex">
          <Chip>6 steps</Chip>
          <Chip>42 runs today</Chip>
          <Chip tone="live">0 failed</Chip>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2.5 p-2.5">
        <div className={cn(PANEL, "flex min-h-0 flex-[3] flex-col")}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
            <span className={LABEL}>{LEFT_PANE[tab].title}</span>
            <span className="text-[10px] tabular-nums text-white/25">
              {LEFT_PANE[tab].meta}
            </span>
          </div>

        {tab === "Runs" && (
          <div className={cn("flex min-h-0 flex-1 flex-col p-2.5 pt-1.5", NOSCROLL)}>
            <div className="grid shrink-0 grid-cols-[1fr_auto_auto] gap-3 px-2 pb-1.5 text-[9px] uppercase tracking-wider text-white/25">
              <span>Person</span>
              <span className="w-24 text-right">Stopped at</span>
              <span className="w-12 text-right">Took</span>
            </div>
            {RUNS.map((run) => (
              <div
                key={run.name}
                className="grid shrink-0 grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/[0.04] px-2 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      RUN_TONE[run.state],
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-white">
                      {run.name}
                    </span>
                    <span className="block truncate text-[11px] text-white/35">
                      {run.state} · {run.at}
                    </span>
                  </span>
                </div>
                <span className="w-24 truncate text-right text-[11px] text-white/45">
                  {run.step}
                </span>
                <span className="w-12 text-right text-[11px] tabular-nums text-white/25">
                  {run.took}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "Logs" && (
          <div className={cn("min-h-0 flex-1 p-2.5", NOSCROLL)}>
            {LOGS.map(([time, kind, message]) => (
              <div
                key={`${time}-${message}`}
                className="flex items-start gap-2.5 border-b border-white/[0.04] px-2 py-1.5 font-mono text-[11px] leading-relaxed"
              >
                <span className="shrink-0 tabular-nums text-white/25">{time}</span>
                <span className="w-16 shrink-0 uppercase text-white/35">{kind}</span>
                <span className="min-w-0 flex-1 text-white/65">{message}</span>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col p-2.5",
            NOSCROLL,
            tab !== "Builder" && "hidden",
          )}
        >
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                {index > 0 && (
                  <div className="group ml-[17px] flex h-3.5 shrink-0 items-center">
                    <span className="h-full w-px bg-white/20" />
                    <span className="ml-2 flex items-center gap-1 text-[10px] text-white/0 transition-colors group-hover:text-white/35">
                      <Plus className="h-2.5 w-2.5" />
                      Add step
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                    selected === item.id
                      ? "border-white/25 bg-[#242424]"
                      : "border-white/5 bg-[#1c1c1c] hover:border-white/15",
                    !active && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded border",
                      item.accent,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] uppercase tracking-wider leading-tight text-white/35">
                      {item.kind}
                    </span>
                    <span className="block truncate text-[12px] font-medium leading-tight text-white">
                      {item.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                    {item.count}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        </div>

        <div className={cn(PANEL, "flex min-h-0 flex-[2] flex-col p-3")}>
          <div className="flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={LABEL}>{step.kind}</div>
              <div className="mt-0.5 truncate text-[12px] font-medium text-white">
                {step.label}
              </div>
            </div>
            <Chip>{step.count}</Chip>
          </div>

          <div className={cn("mt-3 min-h-0 flex-1 space-y-2 pr-1", NOSCROLL)}>
            {step.config.map(([label, value, type]) => (
              <div key={label}>
                <div className="text-[10px] text-white/35">{label}</div>
                <div className={cn(FIELD, "mt-0.5")}>
                  <span className="truncate">{value}</span>
                  {type === "select" && (
                    <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 hidden shrink-0 border-t border-white/5 pt-2.5 sm:block">
            <div className={cn(LABEL, "mb-1.5")}>Recent runs</div>
            <div className="space-y-1">
              {RUNS.slice(0, 4).map((run) => (
                <div key={run.name} className="flex items-center gap-2 text-[10px]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      RUN_TONE[run.state],
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-white/70">
                    {run.name}
                  </span>
                  <span className="shrink-0 text-white/25">{run.at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={FOOT}>
        <span>Version 7 · edited 2 days ago by Ada Chen</span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <Check className="h-3 w-3" />
          All changes saved
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audience — the segmentation rule builder
 * ------------------------------------------------------------------ */

const BASE_AUDIENCE = 12480;

// Each rule keeps a fixed share of whoever is left, so the count is stable.
const RULES = [
  { id: "vip", field: "Ticket type", op: "is", value: "VIP", keep: 0.21 },
  { id: "attended", field: "Attended", op: "is", value: "Last event", keep: 0.62 },
  { id: "spend", field: "Lifetime spend", op: "is over", value: "$200", keep: 0.48 },
  { id: "tag", field: "Tag", op: "contains", value: "speaker", keep: 0.09 },
  { id: "quiet", field: "Last opened", op: "is over", value: "90 days ago", keep: 0.34 },
];

const PEOPLE = [
  { name: "Priya Raman", tier: "VIP", events: 4, spend: 780, seen: "2d" },
  { name: "Marco Silva", tier: "VIP", events: 2, spend: 340, seen: "5d" },
  { name: "Ada Chen", tier: "VIP", events: 6, spend: 1240, seen: "1d" },
  { name: "Tom Okafor", tier: "VIP", events: 3, spend: 505, seen: "3w" },
  { name: "Lena Fischer", tier: "VIP", events: 5, spend: 910, seen: "6d" },
  { name: "Jonas Weber", tier: "VIP", events: 2, spend: 260, seen: "2w" },
  { name: "Sofia Marino", tier: "VIP", events: 7, spend: 1580, seen: "4h" },
  { name: "Iris Nakamura", tier: "VIP", events: 3, spend: 420, seen: "9d" },
];

const TIER_SPLIT = [
  { label: "VIP + Afterparty", share: 46 },
  { label: "VIP", share: 31 },
  { label: "General → upgraded", share: 15 },
  { label: "Crew & guests", share: 8 },
];

const CITY_SPLIT = [
  { label: "Berlin", share: 38 },
  { label: "Hamburg", share: 22 },
  { label: "Amsterdam", share: 17 },
  { label: "Other", share: 23 },
];

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function BreakdownList({ title, rows }) {
  return (
    <div>
      <div className={cn(LABEL, "mb-1.5")}>{title}</div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="truncate text-white/60">{row.label}</span>
              <span className="tabular-nums text-white/35">{row.share}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-white/25"
                style={{ width: `${row.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SegmentSpotlight() {
  const [on, setOn] = useState(["vip", "attended"]);
  const [mode, setMode] = useState("all");

  const matched = useMemo(() => {
    const enabled = RULES.filter((rule) => on.includes(rule.id));
    if (!enabled.length) return BASE_AUDIENCE;
    if (mode === "all") {
      return Math.round(
        enabled.reduce((count, rule) => count * rule.keep, BASE_AUDIENCE),
      );
    }
    const missAll = enabled.reduce((rest, rule) => rest * (1 - rule.keep), 1);
    return Math.round(BASE_AUDIENCE * (1 - missAll));
  }, [on, mode]);

  const toggle = (id) =>
    setOn((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const share = Math.max(2, Math.round((matched / BASE_AUDIENCE) * 100));

  return (
    <div className={SHELL}>
      <div className={BAR}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30">Audience /</span>
            <span className="truncate text-[13px] font-medium text-white">
              VIP regulars
            </span>
            <Chip tone="live">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </Chip>
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">
            Recalculated 4 minutes ago · updates as people buy
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden h-6 items-center gap-1.5 rounded border border-white/10 px-2 text-[11px] text-white/60 sm:inline-flex">
            <Download className="h-3 w-3" />
            Export
          </span>
          <span className="inline-flex h-6 items-center rounded bg-white px-2 text-[11px] font-medium text-zinc-950">
            Save segment
          </span>
        </div>
      </div>

      <div className={SUBBAR}>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-white/[0.08] p-0.5">
            {["all", "any"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] capitalize transition-colors",
                  mode === option
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                Match {option}
              </button>
            ))}
          </div>
          <Chip>{matched.toLocaleString()} people match</Chip>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-white/30 sm:flex">
          <Search className="h-3 w-3" />
          Search people
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2.5 p-2.5">
        <div className={cn(PANEL, "flex min-h-0 flex-[3] flex-col")}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
            <span className={cn(LABEL, "flex items-center gap-1.5")}>
              <Filter className="h-3 w-3" />
              {mode === "all" ? "Match all of" : "Match any of"}
            </span>
            <span className="text-[10px] tabular-nums text-white/25">
              {on.length}/{RULES.length}
            </span>
          </div>
          <div className={cn("flex min-h-0 flex-1 flex-col gap-1.5 p-2.5", NOSCROLL)}>
          {RULES.map((rule) => {
            const enabled = on.includes(rule.id);
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => toggle(rule.id)}
                className={cn(
                  "flex shrink-0 flex-col gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                  enabled
                    ? "border-white/20 bg-[#242424]"
                    : "border-dashed border-white/8 bg-transparent hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
                      enabled
                        ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-400"
                        : "border-white/15 text-transparent",
                    )}
                  >
                    <Check className="h-2 w-2" />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[11px]",
                      enabled ? "text-white/70" : "text-white/30",
                    )}
                  >
                    {rule.field}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-white/25">
                    {Math.round(BASE_AUDIENCE * rule.keep).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "shrink-0 rounded-[3px] border border-white/[0.08] px-1.5 py-px text-[10px]",
                      enabled ? "bg-[#2b2b2b] text-white/60" : "text-white/25",
                    )}
                  >
                    {rule.op}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-[3px] border border-white/[0.08] px-1.5 py-px text-[10px] font-medium",
                      enabled ? "bg-[#2b2b2b] text-white" : "text-white/35",
                    )}
                  >
                    {rule.value}
                  </span>
                </div>
              </button>
            );
          })}
          <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-white/8 px-2.5 py-1.5 text-[10px] text-white/25">
            <Plus className="h-2.5 w-2.5" />
            Add rule
          </div>
          </div>
        </div>

        <div className={cn(PANEL, "flex min-h-0 flex-[4] flex-col")}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Users className="h-3 w-3" />
              Matching people
            </div>
            <span className="text-[10px] tabular-nums text-white/30">
              {matched.toLocaleString()} of {BASE_AUDIENCE.toLocaleString()}
            </span>
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_auto_auto] gap-2 border-b border-white/5 px-3 py-1 text-[9px] uppercase tracking-wider text-white/25">
            <span>Person</span>
            <span className="w-12 text-right">Spend</span>
            <span className="w-8 text-right">Seen</span>
          </div>

          <div className={cn("min-h-0 flex-1", NOSCROLL)}>
            {PEOPLE.map((person) => (
              <div
                key={person.name}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/[0.04] px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-[#2b2b2b] text-[9px] font-medium text-white/60">
                    {initials(person.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium leading-tight text-white">
                      {person.name}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-white/35">
                      {person.tier} · {person.events} events
                    </span>
                  </span>
                </div>
                <span className="w-12 text-right text-[11px] tabular-nums text-white/70">
                  ${person.spend.toLocaleString()}
                </span>
                <span className="w-8 text-right text-[10px] tabular-nums text-white/25">
                  {person.seen}
                </span>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-white/5 p-2.5">
            <div className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white text-[11px] font-medium text-zinc-950">
              <Send className="h-3 w-3" />
              Send campaign to {matched.toLocaleString()}
            </div>
          </div>
        </div>

       
      </div>

      <div className={FOOT}>
        <span>Used by 3 campaigns · 1 automation</span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <RefreshCw className="h-3 w-3" />
          Auto-refreshes hourly
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Analytics — the conversion funnel by traffic source
 * ------------------------------------------------------------------ */

const SOURCES = [
  {
    id: "all",
    label: "All sources",
    stages: [48200, 14100, 8900, 7420],
    revenue: 341200,
    aov: 46,
    deltas: ["+18.4%", "+12.1%", "+0.6pt", "−2.3%"],
  },
  {
    id: "email",
    label: "Email",
    stages: [9800, 5100, 4200, 3910],
    revenue: 186300,
    aov: 48,
    deltas: ["+26.9%", "+21.4%", "+1.8pt", "+3.1%"],
  },
  {
    id: "instagram",
    label: "Instagram",
    stages: [21400, 5600, 3100, 2380],
    revenue: 104800,
    aov: 44,
    deltas: ["+9.2%", "+6.7%", "−0.4pt", "−1.2%"],
  },
  {
    id: "direct",
    label: "Direct",
    stages: [11300, 2400, 1200, 890],
    revenue: 38100,
    aov: 43,
    deltas: ["+4.1%", "+2.8%", "−0.2pt", "+0.4%"],
  },
  {
    id: "partner",
    label: "Partners",
    stages: [5700, 1000, 400, 240],
    revenue: 12000,
    aov: 50,
    deltas: ["−6.3%", "−4.8%", "−0.9pt", "+1.6%"],
  },
];

const STAGE_LABELS = ["Page views", "Ticket selected", "Checkout started", "Paid"];

const DEVICES = [
  { label: "Mobile", share: 64, tone: "bg-indigo-400/70" },
  { label: "Desktop", share: 27, tone: "bg-sky-400/60" },
  { label: "Tablet", share: 9, tone: "bg-white/20" },
];

const RANGES = ["7d", "30d", "All time"];

function Delta({ value }) {
  const up = value.startsWith("+");
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        up ? "text-emerald-400" : "text-red-400/80",
      )}
    >
      {value}
    </span>
  );
}

export function FunnelSpotlight() {
  const [sourceId, setSourceId] = useState("all");
  const [range, setRange] = useState("30d");
  const source = SOURCES.find((item) => item.id === sourceId) ?? SOURCES[0];

  const top = source.stages[0];
  const conversion = ((source.stages[3] / top) * 100).toFixed(1);

  const kpis = [
    { label: "Revenue", value: `$${source.revenue.toLocaleString()}`, delta: source.deltas[0] },
    { label: "Tickets", value: source.stages[3].toLocaleString(), delta: source.deltas[1] },
    { label: "View → paid", value: `${conversion}%`, delta: source.deltas[2], good: true },
    { label: "Avg order", value: `$${source.aov}`, delta: source.deltas[3] },
  ];

  const channels = SOURCES.filter((item) => item.id !== "all");
  const channelTop = Math.max(...channels.map((item) => item.revenue));

  return (
    <div className={SHELL}>
      <div className={BAR}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30">Analytics /</span>
            <span className="truncate text-[13px] font-medium text-white">
              Nightshift 2026
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">
            Sales funnel · compared to previous period
          </div>
        </div>
        <div className="flex shrink-0 items-center rounded-md border border-white/[0.08] p-0.5">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] transition-colors",
                range === item
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className={SUBBAR}>
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSourceId(item.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                sourceId === item.id
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/8 text-white/40 hover:text-white/70",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="hidden text-[11px] text-white/25 sm:block">
          Updated 3 min ago
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
        <div className={cn(PANEL, "grid shrink-0 grid-cols-2 sm:grid-cols-4")}>
          {kpis.map((kpi, index) => (
            <div
              key={kpi.label}
              className={cn(
                "px-3 py-2.5",
                index % 2 === 1 && "border-l border-white/5",
                index >= 2 && "border-t border-white/5 sm:border-t-0",
                index > 0 && "sm:border-l sm:border-white/5",
              )}
            >
              <div className={LABEL}>{kpi.label}</div>
              <div
                className={cn(
                  "mt-1 text-lg font-semibold leading-none tabular-nums",
                  kpi.good ? "text-emerald-400" : "text-white",
                )}
              >
                {kpi.value}
              </div>
              <div className="mt-1">
                <Delta value={kpi.delta} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-2.5">
          <div className={cn(PANEL, "flex min-h-0 flex-[3] flex-col")}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
              <span className={LABEL}>Conversion funnel</span>
              <span className="text-[10px] text-white/25">{source.label}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 p-3">
            {source.stages.map((value, index) => {
              const width = Math.max(6, (value / top) * 100);
              const dropOff =
                index === 0
                  ? null
                  : Math.round((1 - value / source.stages[index - 1]) * 100);
              return (
                <div key={STAGE_LABELS[index]}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-white/60">
                      <span className="grid h-4 w-4 place-items-center rounded border border-white/10 text-[10px] tabular-nums text-white/35">
                        {index + 1}
                      </span>
                      {STAGE_LABELS[index]}
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="tabular-nums text-white">
                        {value.toLocaleString()}
                      </span>
                      {dropOff !== null && (
                        <span className="w-12 text-right text-[11px] tabular-nums text-red-400/70">
                          −{dropOff}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-6 overflow-hidden rounded bg-white/[0.04] sm:h-7">
                    <div
                      className={cn(
                        "h-full rounded transition-all duration-500",
                        index === 3
                          ? "bg-emerald-400/70"
                          : "bg-gradient-to-r from-indigo-400/50 to-indigo-400/25",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="hidden shrink-0 sm:block">
              <div className={cn(LABEL, "mb-2")}>Device</div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.04]">
                {DEVICES.map((device) => (
                  <div
                    key={device.label}
                    className={device.tone}
                    style={{ width: `${device.share}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {DEVICES.map((device) => (
                  <span
                    key={device.label}
                    className="flex items-center gap-1.5 text-[11px] text-white/40"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", device.tone)} />
                    {device.label} {device.share}%
                  </span>
                ))}
              </div>
            </div>
            </div>
          </div>

          <div className={cn(PANEL, "hidden min-h-0 w-[196px] flex-col xl:flex")}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
              <span className={LABEL}>By channel</span>
              <span className="text-[10px] text-white/25">Revenue</span>
            </div>
            <div className={cn("min-h-0 flex-1 p-2.5", NOSCROLL)}>
              {channels.map((channel) => {
                const conv = ((channel.stages[3] / channel.stages[0]) * 100).toFixed(1);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSourceId(channel.id)}
                    className={cn(
                      "mb-1 w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                      sourceId === channel.id
                        ? "border-white/20 bg-[#282828]"
                        : "border-transparent hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/70">{channel.label}</span>
                      <span className="tabular-nums text-white">
                        ${(channel.revenue / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-indigo-400/60"
                        style={{ width: `${(channel.revenue / channelTop) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-white/30">
                      <span className="tabular-nums">
                        {channel.stages[3].toLocaleString()} paid
                      </span>
                      <span className="tabular-nums">{conv}% conv</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={FOOT}>
        <span className="inline-flex items-center gap-1.5">
          <Play className="h-3 w-3" />
          Switch source to see where the drop-off really is
        </span>
        <span className="hidden sm:block">
          {range} · {source.label}
        </span>
      </div>
    </div>
  );
}
