"use client";

// Conversion components: the parts of a page whose job is to turn a reader into
// an attendee. These read live event data (tickets, capacity, dates) rather than
// authored copy wherever they can, so they stay true as the event sells.

import { useEffect, useMemo, useState } from "react";
import { Timer, Table2, Ticket, Mail, Flame, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function money(amount, currency = "USD") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

// --- Countdown ---------------------------------------------------------------

function partsUntil(target) {
  const ms = target - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function CountdownUnit({ value, label, accent }) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border border-border bg-surface-subtle px-4 py-3">
      <span
        className="text-3xl font-bold tabular-nums leading-none"
        style={{ color: accent.color }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
    </div>
  );
}

function Countdown({ props, accent }) {
  const target = useMemo(() => {
    const d = new Date(props.target || "");
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }, [props.target]);

  const [parts, setParts] = useState(() => (target ? partsUntil(target) : null));

  // Re-seed on a render when the target moves (the organizer edited the date),
  // rather than from an effect — same pattern the block editor uses.
  const [seed, setSeed] = useState(target);
  if (seed !== target) {
    setSeed(target);
    setParts(target ? partsUntil(target) : null);
  }

  useEffect(() => {
    if (!target) return undefined;
    // A whole-second tick is enough; anything finer just burns battery.
    const timer = setInterval(() => setParts(partsUntil(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!target) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-tertiary">
        Set an event date to start the countdown.
      </p>
    );
  }

  if (!parts) {
    return (
      <p className="text-center text-sm font-medium text-text-secondary">
        {props.endedText || "This event has started."}
      </p>
    );
  }

  const units = [
    { value: parts.days, label: "Days" },
    { value: parts.hours, label: "Hours" },
    { value: parts.minutes, label: "Mins" },
    ...(props.showSeconds !== false ? [{ value: parts.seconds, label: "Secs" }] : []),
  ];

  return (
    <div className="space-y-3">
      {props.title ? (
        <p className="text-center text-sm font-semibold text-foreground">{props.title}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        {units.map((u) => (
          <CountdownUnit key={u.label} value={u.value} label={u.label} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// --- Pricing table -----------------------------------------------------------

function PricingTable({ props, event, accent }) {
  const currency = event?.payments?.currency || "USD";
  const tiers = (Array.isArray(event?.tickets) ? event.tickets : []).filter((t) => t?.name);
  const sold = event?.ticketSold && typeof event.ticketSold === "object" ? event.ticketSold : {};

  if (!tiers.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
        Add ticket types under Tickets and they will appear here.
      </p>
    );
  }

  const highlight = String(props.highlight || "").trim().toLowerCase();

  return (
    <div className="space-y-4">
      {props.title ? (
        <h2 className="text-xl font-semibold text-foreground">{props.title}</h2>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier, i) => {
          const qty = Number(tier.qty) || 0;
          const soldOut = qty > 0 && (Number(sold[tier.id]) || 0) >= qty;
          const featured = highlight && tier.name.toLowerCase() === highlight;
          return (
            <div
              key={tier.id || i}
              className={cn(
                "flex flex-col gap-4 rounded-2xl border p-5",
                featured
                  ? "border-transparent bg-surface-card"
                  : "border-border bg-surface-subtle",
              )}
              style={
                featured
                  ? { borderColor: accent.color, boxShadow: `0 0 0 1px ${accent.color}` }
                  : undefined
              }
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{tier.name}</p>
                {tier.note ? (
                  <p className="text-xs leading-relaxed text-text-secondary">{tier.note}</p>
                ) : null}
              </div>
              <p className="text-2xl font-bold text-foreground">
                {money(tier.price, currency)}
              </p>
              {props.showRemaining && qty > 0 && !soldOut ? (
                <p className="text-xs text-text-tertiary">
                  {Math.max(0, qty - (Number(sold[tier.id]) || 0))} left
                </p>
              ) : null}
              <Button
                asChild={!soldOut}
                disabled={soldOut}
                className="mt-auto w-full hover:opacity-90"
                style={
                  soldOut ? undefined : { backgroundColor: accent.color, color: accent.text }
                }
              >
                {soldOut ? (
                  <span>Sold out</span>
                ) : (
                  <a href={props.url || "#tickets"}>{props.buttonLabel || "Get tickets"}</a>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Email capture -----------------------------------------------------------

// Posts to the organizer's own endpoint when they give one. Without an endpoint
// it still confirms to the visitor rather than silently doing nothing, because a
// dead form is worse than an honest one.
function EmailCapture({ props, accent }) {
  const [done, setDone] = useState(false);
  const action = String(props.action || "").trim();

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-subtle p-6 text-sm text-foreground">
        <Check className="h-4 w-4 text-emerald-400" />
        {props.successText || "Thanks — we'll be in touch."}
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-surface-subtle p-6"
      {...(action ? { action, method: "post" } : {})}
      onSubmit={
        action
          ? undefined
          : (e) => {
              e.preventDefault();
              setDone(true);
            }
      }
    >
      <div className="space-y-1">
        {props.title ? (
          <p className="text-base font-semibold text-foreground">{props.title}</p>
        ) : null}
        {props.subtitle ? (
          <p className="text-sm text-text-secondary">{props.subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          name="email"
          required
          placeholder={props.placeholder || "you@example.com"}
          className="bg-surface-card"
          aria-label="Email address"
        />
        <Button
          type="submit"
          style={{ backgroundColor: accent.color, color: accent.text }}
          className="shrink-0 hover:opacity-90"
        >
          {props.buttonLabel || "Notify me"}
        </Button>
      </div>
    </form>
  );
}

// --- Urgency bar -------------------------------------------------------------

// Only speaks when it has something true to say: no capacity set, or plenty
// left, means it renders nothing rather than manufacturing scarcity.
function UrgencyBar({ props, event, accent }) {
  const capacity = Number(event?.capacity) || 0;
  const sold = Number(event?.sold) || 0;
  if (capacity <= 0) return null;

  const percent = Math.min(100, Math.round((sold / capacity) * 100));
  const remaining = Math.max(0, capacity - sold);
  const threshold = Number(props.threshold);
  if (Number.isFinite(threshold) && threshold > 0 && percent < threshold) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Flame className="h-4 w-4 text-amber-400" />
          {remaining === 0
            ? props.soldOutText || "Sold out"
            : (props.title || "{count} spots left").replace("{count}", remaining)}
        </span>
        {props.showPercent !== false ? (
          <span className="tabular-nums text-xs text-text-tertiary">{percent}% claimed</span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percent}%`, backgroundColor: accent.color }}
        />
      </div>
    </div>
  );
}

// --- Definitions -------------------------------------------------------------

export const CONVERT_COMPONENTS = [
  {
    type: "countdown",
    label: "Countdown",
    icon: Timer,
    category: "convert",
    defaultProps: {
      title: "Doors open in",
      target: "{{event.startsAt}}",
      showSeconds: true,
      endedText: "This event has started.",
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      {
        key: "target",
        label: "Counts down to",
        type: "text",
        bindable: true,
        hint: "A date, or a binding like {{event.startsAt}}.",
      },
      { key: "showSeconds", label: "Show seconds", type: "switch" },
      { key: "endedText", label: "After it passes", type: "text", bindable: true },
    ],
    render: Countdown,
  },
  {
    type: "pricing",
    label: "Ticket pricing",
    icon: Table2,
    category: "convert",
    defaultProps: {
      title: "Tickets",
      buttonLabel: "Get tickets",
      url: "#tickets",
      highlight: "",
      showRemaining: true,
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "buttonLabel", label: "Button label", type: "text", bindable: true },
      { key: "url", label: "Button link", type: "text" },
      {
        key: "highlight",
        label: "Featured tier",
        type: "text",
        hint: "Exact ticket name to outline as the recommended option.",
      },
      { key: "showRemaining", label: "Show remaining count", type: "switch" },
    ],
    render: PricingTable,
  },
  {
    type: "checkout-button",
    label: "Checkout button",
    icon: Ticket,
    category: "convert",
    defaultProps: {
      label: "Get tickets — {{tickets.priceRange | fallback:free}}",
      url: "#tickets",
      fullWidth: false,
      note: "",
    },
    fields: [
      { key: "label", label: "Label", type: "text", bindable: true },
      { key: "url", label: "Link", type: "text" },
      { key: "note", label: "Note below the button", type: "text", bindable: true },
      { key: "fullWidth", label: "Full width", type: "switch" },
    ],
    render: ({ props, accent }) => (
      <div className={cn("space-y-2", props.fullWidth && "w-full")}>
        <Button
          asChild
          size="lg"
          style={{ backgroundColor: accent.color, color: accent.text }}
          className={cn("hover:opacity-90", props.fullWidth && "w-full")}
        >
          <a href={props.url || "#tickets"}>{props.label || "Get tickets"}</a>
        </Button>
        {props.note ? (
          <p className="text-xs text-text-tertiary">{props.note}</p>
        ) : null}
      </div>
    ),
  },
  {
    type: "email-capture",
    label: "Email capture",
    icon: Mail,
    category: "convert",
    defaultProps: {
      title: "Can't make it this time?",
      subtitle: "Get a heads-up when we announce the next one.",
      placeholder: "you@example.com",
      buttonLabel: "Notify me",
      action: "",
      successText: "Thanks — we'll be in touch.",
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "subtitle", label: "Subheading", type: "textarea", bindable: true },
      { key: "placeholder", label: "Input placeholder", type: "text" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      {
        key: "action",
        label: "Form endpoint",
        type: "text",
        hint: "Where the form POSTs. Leave empty to just show a confirmation.",
      },
      { key: "successText", label: "Confirmation text", type: "text" },
    ],
    render: EmailCapture,
  },
  {
    type: "urgency",
    label: "Spots remaining",
    icon: Flame,
    category: "convert",
    defaultProps: {
      title: "{count} spots left",
      soldOutText: "Sold out",
      showPercent: true,
      threshold: 0,
    },
    fields: [
      {
        key: "title",
        label: "Message",
        type: "text",
        hint: "{count} is replaced with the number remaining.",
      },
      { key: "soldOutText", label: "When sold out", type: "text" },
      { key: "showPercent", label: "Show percent claimed", type: "switch" },
      {
        key: "threshold",
        label: "Only show above",
        type: "range",
        min: 0,
        max: 95,
        step: 5,
        suffix: "% sold",
      },
    ],
    render: UrgencyBar,
  },
];
