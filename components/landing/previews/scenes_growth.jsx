"use client";

import { Check, GitBranch, Loader2, Mail, Megaphone, Plus, Send, Sparkles, Ticket, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, Bar, Notice, Part, Pill, Row, RowText, SceneCard, flow, money } from "./kit";

// Automation and growth scenes: each one ends on the result the feature produces.

const NODES = [
  { icon: Ticket, kind: "When", title: "A ticket is bought" },
  { icon: GitBranch, kind: "If", title: "Ticket type is VIP" },
  { icon: Mail, kind: "Then", title: "Send the VIP welcome email" },
];

// Workflows: real orders run through the steps on their own; non-matching orders stop at the condition.
function WorkflowScene({ view }) {
  const { state } = view;
  const status = (index) => {
    if (!state.order || index > state.stage) return "idle";
    if (index === 1 && state.skipped) return "skipped";
    if (index === 2 && state.skipped) return "idle";
    return index < state.stage || state.done ? "passed" : "running";
  };
  return (
    <SceneCard title="VIP welcome" meta="Workflow · Nightshift 2026" aside={<Pill tone="success">Live</Pill>}>
      <Part id="order" view={view} className="mb-3 flex min-h-11 items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
        {state.order ? <><Avatar name={state.order.name} /><RowText title={`New order · ${state.order.name}`} meta={state.order.ticket} /></> : <span className="text-xs text-muted-foreground">Waiting for orders</span>}
      </Part>
      <div className="space-y-1.5">
        {NODES.map(({ icon: Icon, kind, title }, index) => {
          const s = status(index);
          return (
            <div key={title} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-300", s === "running" ? "border-foreground" : s === "skipped" ? "border-red-500/40" : "border-border")}>
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted"><Icon className="size-3.5" /></span>
              <div className="min-w-0 flex-1"><div className="text-[11px] text-muted-foreground">{kind}</div><div className="truncate text-sm font-medium">{title}</div></div>
              {s === "running" ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : s === "passed" ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : s === "skipped" ? <X className="size-4 text-red-600 dark:text-red-400" /> : null}
            </div>
          );
        })}
      </div>
      <Part id="log" view={view} className="mt-3 space-y-1 text-xs">
        {state.log.length ? state.log.map(([name, outcome]) => (
          <div key={name} className="flex justify-between"><span>{name}</span><span className="text-muted-foreground">{outcome}</span></div>
        )) : <div className="text-muted-foreground">No runs yet</div>}
      </Part>
    </SceneCard>
  );
}

const RULES = ["Ticket type is VIP", "Checked in at least once", "Spent over $100"];
const COUNTS = [412, 286, 168];
const PEOPLE = [["Priya Raman", "Marco Silva", "Jordan Lee"], ["Priya Raman", "Jordan Lee", "Sam Okafor"], ["Priya Raman", "Sam Okafor", "Mara Ellis"]];

// Segments: narrow an audience with rules, then message exactly that group.
function SegmentScene({ view }) {
  const { state } = view;
  const count = COUNTS[state.rules - 1];
  const people = PEOPLE[state.rules - 1];
  return (
    <SceneCard title="Audience" meta="Nightshift 2026 guests">
      <div className="space-y-2">
        {RULES.slice(0, state.rules).map((rule, index) => (
          <Row key={rule} className="py-2 motion-safe:animate-in motion-safe:fade-in">
            <span className="text-sm">{index ? <span className="mr-1.5 text-xs text-muted-foreground">and</span> : null}{rule}</span>
          </Row>
        ))}
      </div>
      <Button data-part="add-rule" variant="outline" size="sm" className="mt-2 w-full"><Plus className="size-3.5" />Add rule</Button>
      <Part id="count" view={view} className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center">
          <div className="flex -space-x-2">{people.map((name) => <Avatar key={name} name={name} />)}</div>
          <span className="ml-2 text-xs text-muted-foreground">{people[0].split(" ")[0]} and {count - 1} more</span>
        </div>
        <span className="text-xl font-semibold tabular-nums">{count}</span>
      </Part>
      <Button data-part="send" className="mt-3 w-full" variant={state.sent ? "outline" : "default"}>{state.sent ? <><Check className="size-3.5" />Broadcast sent to {count} guests</> : <><Megaphone className="size-3.5" />Broadcast to this audience</>}</Button>
    </SceneCard>
  );
}

const FUNNEL = [["Page views", 8420], ["Started checkout", 1260], ["Paid orders", 486]];
const CHANNELS = [["Email", 1900, 288], ["Direct", 1420, 102], ["Instagram", 5100, 96]];

// Analytics: from the funnel to the channel that actually sells, ending on the insight.
function FunnelScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Sales funnel" meta="Nightshift 2026 · Last 30 days">
      <div className="mb-3 flex gap-1.5">
        {[["funnel", "Funnel"], ["channels", "By channel"]].map(([id, label]) => <Button key={id} data-part={`tab-${id}`} size="sm" variant={state.tab === id ? "default" : "outline"} className="h-7 px-2.5 text-xs">{label}</Button>)}
      </div>
      {state.tab === "funnel" ? (
        <Part id="funnel" view={view} className="min-h-[150px] space-y-3">
          {FUNNEL.map(([label, value]) => (
            <div key={label}>
              <div className="flex justify-between text-sm"><span>{label}</span><span className="font-medium tabular-nums">{value.toLocaleString("en-US")}</span></div>
              <Bar value={(value / FUNNEL[0][1]) * 100} className="mt-1.5 h-2" />
            </div>
          ))}
        </Part>
      ) : (
        <Part id="channels" view={view} className="min-h-[150px] space-y-3 motion-safe:animate-in motion-safe:fade-in">
          {CHANNELS.map(([label, visits, orders]) => (
            <div key={label}>
              <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{orders} orders · <span className="font-medium text-foreground">{((orders / visits) * 100).toFixed(1)}%</span></span></div>
              <Bar value={(orders / visits) * 100 * 6} className="mt-1.5 h-2" />
            </div>
          ))}
        </Part>
      )}
      <Notice tone="strong" icon={Sparkles} show={state.insight} className="mt-3">Email visitors convert 8× better than Instagram visitors.</Notice>
    </SceneCard>
  );
}

// Campaigns: schedule a reminder, then see what it sold.
function CampaignScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="One week to go" meta="Auto reminder · Nightshift 2026 ticket holders and followers">
      <Row>
        <RowText title={state.sent ? "Sent Sat 7 Mar, 09:00" : state.scheduled ? "Sends Sat 7 Mar, 09:00" : "Draft"} meta="7 days before doors · 2,140 recipients" />
        <Button data-part="schedule" size="sm" variant={state.scheduled ? "outline" : "default"}>{state.scheduled ? <><Check className="size-3.5" />Scheduled</> : <><Send className="size-3.5" />Schedule</>}</Button>
      </Row>
      <Part id="results" view={view} className={cn("mt-4 grid grid-cols-3 gap-2 transition-opacity duration-300", state.sent ? "opacity-100" : "opacity-40")}>
        {[["Opened", state.sent ? `${state.opened}%` : "—"], ["Clicked", state.sent ? `${state.clicked}%` : "—"], ["Tickets sold", state.sent ? state.sold : "—"]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted px-3 py-2.5"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}</div></div>
        ))}
      </Part>
      <Notice tone="success" icon={Ticket} show={state.sold >= 38} className="mt-3">{money(state.sold * 45)} in ticket sales came from this email.</Notice>
    </SceneCard>
  );
}

const WALL = [["Nightshift 2026", "Sat 14 Mar · The Foundry"], ["Open Mic", "Every Friday · The Loft"]];

// Discovery: publishing puts the event straight onto your public organizer page.
function DiscoveryScene({ view }) {
  const { state } = view;
  const wall = state.published ? [["Summer Rooftop", "Sat 20 Jun · Skyline Bar"], ...WALL] : WALL;
  return (
    <SceneCard title="Foundry Nights" meta="Organizer page · 1,204 followers">
      <Row className="mb-3 border-dashed">
        <RowText title="Summer Rooftop" meta={state.published ? "Published just now" : "Draft · ready to publish"} />
        <Button data-part="publish" size="sm" variant={state.published ? "outline" : "default"}>{state.published ? <><Check className="size-3.5" />Live</> : "Publish"}</Button>
      </Row>
      <Part id="wall" view={view}>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Upcoming on your page</div>
        <div className="space-y-2">
          {wall.map(([title, meta], index) => (
            <Row key={title} className={cn(state.published && index === 0 && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2")}>
              <RowText title={title} meta={meta} />
              {state.published && index === 0 ? <Pill tone="strong">New</Pill> : <Pill>Tickets</Pill>}
            </Row>
          ))}
        </div>
      </Part>
    </SceneCard>
  );
}

const PRIYA = { name: "Priya Raman", ticket: "VIP + afterparty" };
const MARCO = { name: "Marco Silva", ticket: "General admission" };

export const GROWTH_PREVIEWS = {
  workflows: {
    Scene: WorkflowScene,
    script: flow({ order: null, stage: 0, done: false, skipped: false, log: [] }, [
      { caption: "This workflow is live. It welcomes every VIP buyer.", hold: 1000 },
      { set: { order: PRIYA, stage: 0 }, highlight: "order", caption: "A VIP ticket is bought.", hold: 700 },
      { set: { stage: 1 }, caption: "The condition checks the ticket type.", hold: 650 },
      { set: { stage: 2 }, hold: 550 },
      { set: { done: true, log: [["Priya Raman", "Welcome email sent"]] }, highlight: "log", caption: "The welcome email goes out on its own.", hold: 1300 },
      { set: { order: MARCO, stage: 0, done: false }, highlight: "order", caption: "A general admission ticket is bought.", hold: 700 },
      { set: { stage: 1, skipped: true, log: [["Priya Raman", "Welcome email sent"], ["Marco Silva", "Stopped: not VIP"]] }, highlight: "log", caption: "It doesn't match, so the workflow stops. Every run is logged.", hold: 2000 },
    ]),
  },
  segments: {
    Scene: SegmentScene,
    script: flow({ rules: 1, sent: false }, [
      { highlight: "count", caption: "Start an audience with one rule and see who matches.", hold: 1200 },
      { cursor: "add-rule", click: true, set: { rules: 2 }, caption: "Add rules, and the audience narrows as you go.", hold: 700 },
      { cursor: "add-rule", click: true, set: { rules: 3 }, highlight: "count", hold: 1000 },
      { cursor: "send", click: true, set: { sent: true }, caption: "Then message exactly those 168 people.", hold: 1900 },
    ]),
  },
  analytics: {
    Scene: FunnelScene,
    script: flow({ tab: "funnel", insight: false }, [
      { highlight: "funnel", caption: "See how many visitors reach checkout, and how many pay.", hold: 1500 },
      { cursor: "tab-channels", click: true, set: { tab: "channels" }, caption: "Break it down by where they came from.", hold: 1200 },
      { set: { insight: true }, highlight: "channels", caption: "Now you know where your next ad money should go.", hold: 2200 },
    ]),
  },
  campaigns: {
    Scene: CampaignScene,
    script: flow({ scheduled: false, sent: false, opened: 0, clicked: 0, sold: 0 }, [
      { caption: "Set up a reminder for a week before doors.", hold: 1100 },
      { cursor: "schedule", click: true, set: { scheduled: true }, caption: "Schedule it once.", hold: 800 },
      { set: { sent: true, opened: 18, clicked: 4, sold: 12 }, highlight: "results", caption: "When it sends, opens and clicks are tracked…", hold: 900 },
      { set: { opened: 31, clicked: 9, sold: 38 }, highlight: "results", caption: "…and so are the tickets it sells.", hold: 2000 },
    ]),
  },
  discovery: {
    Scene: DiscoveryScene,
    script: flow({ published: false }, [
      { highlight: "wall", caption: "Your organizer page lists everything coming up.", hold: 1300 },
      { cursor: "publish", click: true, set: { published: true }, highlight: "wall", caption: "Publish an event and it's on your page straight away.", hold: 2000 },
    ]),
  },
};
