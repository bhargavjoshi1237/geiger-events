"use client";

import {
  Accessibility,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Gauge,
  KeyRound,
  Languages,
  Loader2,
  Share2,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { accessCodesEnabled } from "@/lib/events/access_codes";
import {
  eventCountdown,
  eventTimezoneLabel,
  eventWeekday,
} from "@/lib/events/schedule";
import { GUIDELINE_CATEGORY_MAP } from "@/components/internal/screens/registrations/constants";

import { formatDate } from "../sample_data";
import { MONTHS, tierAccentDot } from "./constants";

function TicketOption({ ticket, index, selected, setSelected, accent }) {
  const isActive = selected === index;
  return (
    <button
      type="button"
      onClick={() => setSelected(index)}
      style={isActive ? { borderColor: accent.color } : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
        isActive
          ? "bg-surface-card"
          : "border-border bg-transparent hover:bg-surface-card",
      )}
    >
      <span
        style={
          isActive
            ? { backgroundColor: accent.color, borderColor: accent.color }
            : undefined
        }
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          isActive ? "" : "border-border-strong",
        )}
      >
        {isActive ? (
          <Check className="h-3 w-3" style={{ color: accent.text }} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {ticket.name}
        </span>
        {ticket.note ? (
          <span className="block text-xs text-text-secondary">{ticket.note}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {ticket.price === 0 ? "Free" : `$${ticket.price}`}
      </span>
    </button>
  );
}

function TicketList({ tickets, ticketGroups, selected, setSelected, accent }) {
  const option = (t) => (
    <TicketOption
      key={t.id || t.name}
      ticket={t}
      index={tickets.indexOf(t)}
      selected={selected}
      setSelected={setSelected}
      accent={accent}
    />
  );

  if (!ticketGroups) {
    return <div className="space-y-2">{tickets.map(option)}</div>;
  }

  return (
    <div className="space-y-4">
      {ticketGroups.sections.map((g) => (
        <div key={g.tierId} className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className={cn("h-2 w-2 rounded-full", tierAccentDot(g.color))} />
            {g.name}
          </p>
          {g.items.map(option)}
        </div>
      ))}
      {ticketGroups.ungrouped.length ? (
        <div className="space-y-2">{ticketGroups.ungrouped.map(option)}</div>
      ) : null}
    </div>
  );
}

export function RegisterCard({
  event,
  now,
  accent,
  gatedIds,
  codeInput,
  setCodeInput,
  codeBusy,
  applyAccessCode,
  tickets,
  ticketGroups,
  selected,
  setSelected,
  soldOut,
  remaining,
  showRemaining,
  primaryBtnStyle,
  ctaHover,
  onCheckout,
}) {
  const [, m, d] = event.date.split("-").map(Number);
  const startLine = [
    eventWeekday(event),
    [event.time, eventTimezoneLabel(event)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
  const countdown = now ? eventCountdown(event, now) : null;
  const countdownUrgent =
    countdown?.tone === "live" || countdown?.tone === "soon";
  const countdownStyle = countdownUrgent
    ? {
        backgroundColor: `color-mix(in srgb, ${accent.color} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent.color} 32%, transparent)`,
        color: accent.color,
      }
    : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface-card">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {MONTHS[m - 1]}
          </span>
          <span className="text-lg font-bold leading-none text-foreground">{d}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {formatDate(event.date)}
          </p>
          <p className="text-xs text-text-secondary">{startLine}</p>
        </div>
        {countdown ? (
          <span
            style={countdownStyle}
            className={cn(
              "ml-auto flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              !countdownUrgent &&
                (countdown.tone === "past"
                  ? "border-border bg-surface-card text-text-tertiary"
                  : "border-border bg-surface-card text-text-secondary"),
            )}
          >
            <Clock className="h-3 w-3" />
            {countdown.label}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Select ticket
        </p>
        {accessCodesEnabled(event) && gatedIds.size > 0 ? (
          <div className="flex items-center gap-2 pb-1">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyAccessCode();
                }
              }}
              placeholder="Have an access code?"
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={codeBusy || !codeInput.trim()}
              onClick={applyAccessCode}
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {codeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Unlock
                </>
              )}
            </Button>
          </div>
        ) : null}
        <TicketList
          tickets={tickets}
          ticketGroups={ticketGroups}
          selected={selected}
          setSelected={setSelected}
          accent={accent}
        />
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <Button
          style={soldOut ? undefined : primaryBtnStyle}
          disabled={soldOut}
          className={cn(
            "w-full disabled:opacity-60",
            soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
          )}
          onClick={onCheckout}
        >
          {soldOut ? (
            "Sold out"
          ) : (
            <>
              {tickets[selected].price === 0 ? "Register" : "Get Tickets"}
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {showRemaining ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
            <Ticket className="h-3.5 w-3.5" />
            {soldOut
              ? "Sold out"
              : Number.isFinite(remaining)
                ? `${remaining.toLocaleString("en-US")} tickets remaining`
                : "Tickets available"}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => toast.success("Added to calendar.")}
          >
            <CalendarCheck className="h-4 w-4" /> Add
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => toast.success("Share link copied.")}
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GoodToKnowCard({ event, TypeIcon, language }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">Good To Know</p>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-text-secondary">
            <TypeIcon className="h-4 w-4" /> Format
          </span>
          <span className="text-muted-foreground">{event.type}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-text-secondary">
            <Gauge className="h-4 w-4" /> Capacity
          </span>
          <span className="text-muted-foreground">
            {event.capacity.toLocaleString("en-US")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-text-secondary">
            <Languages className="h-4 w-4" /> Language
          </span>
          <span className="text-muted-foreground">{language}</span>
        </div>
      </div>
    </div>
  );
}

export function AtRegistrationCard({ questions }) {
  if (!questions.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ClipboardList className="h-4 w-4 text-muted-foreground" /> At registration
      </p>
      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuidelinesCard({ guidelines }) {
  if (!guidelines.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
        <Accessibility className="h-4 w-4 text-muted-foreground" />
        Dietary & Accessibility
      </p>
      <div className="flex flex-col gap-4">
        {guidelines.map((g, i) => {
          const cat = GUIDELINE_CATEGORY_MAP[g.category];
          return (
            <div key={g.id || i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {g.label}
                </span>
                {cat ? (
                  <Badge variant={cat.variant} className="shrink-0">
                    {cat.label}
                  </Badge>
                ) : null}
              </div>
              {g.detail ? (
                <p className="text-sm text-text-secondary">{g.detail}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
