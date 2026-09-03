"use client";

import {
  Accessibility,
  Armchair,
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
  ShieldCheck,
  Smartphone,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";
import { accessCodesEnabled } from "@/lib/events/access_codes";
import { ticketSelectionActive } from "@/lib/events/ticket_selection";
import { activeCtas, ctaIsExternal, normalizeCtas } from "@/lib/events/ctas";
import {
  eventCountdown,
  eventTimezoneLabel,
  eventWeekday,
} from "@/lib/events/schedule";
import { GUIDELINE_CATEGORY_MAP } from "@/components/internal/screens/registrations/constants";

import { formatDate } from "../sample_data";
import { MONTHS, tierAccentDot } from "./constants";
import { SectionNoteBadge } from "./section_note";

const SELECTION_FEATURES = {
  plan: { icon: Armchair, label: "Selection based on plan" },
  insurance: { icon: ShieldCheck, label: "Cancellation insurance" },
  digital: { icon: Smartphone, label: "Digital ticket" },
};

function TicketOption({ ticket, index, selected, setSelected, accent }) {
  const isActive = selected === index;
  const releaseNote = ticket.releaseNote || "";
  const releaseSoldOut =
    ticket.releaseState?.hasReleases && (ticket.releaseState.remaining || 0) <= 0;
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
        releaseSoldOut && "opacity-70",
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
        {releaseNote ? (
          <span className="mt-0.5 block text-[11px] font-medium text-text-tertiary">
            {releaseNote}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {releaseSoldOut ? "Paused" : ticket.price === 0 ? "Free" : `$${ticket.price}`}
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
  note,
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

  const extraCtas = activeCtas(event);
  const primaryLabel = normalizeCtas(event?.ctas).primaryLabel.trim();

  const selection = ticketSelectionActive(event);
  const featureChips = selection
    ? (Array.isArray(selection.features) ? selection.features : [])
        .map((id) => SELECTION_FEATURES[id])
        .filter(Boolean)
    : [];
  const footnotes = selection
    ? [
        selection.mode !== "price" && selection.autoAssignNote.trim()
          ? selection.autoAssignNote.trim()
          : null,
        soldOut && selection.soldOutNote.trim()
          ? selection.soldOutNote.trim()
          : null,
      ].filter(Boolean)
    : [];

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
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
          Select ticket
          <SectionNoteBadge text={note} />
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
        {selection ? (
          <div className="space-y-2">
            {selection.mode !== "price" ? (
              <Button
                style={soldOut ? undefined : primaryBtnStyle}
                disabled={soldOut}
                className={cn(
                  "w-full disabled:opacity-60",
                  soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
                )}
                onClick={() => onCheckout("seats")}
              >
                <Armchair className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {selection.seatsLabel || "Seat selection via the seating plan"}
                </span>
              </Button>
            ) : null}
            {selection.mode !== "seats" ? (
              <Button
                variant="outline"
                disabled={soldOut}
                className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-60"
                onClick={() => onCheckout("price")}
              >
                <Ticket className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {selection.priceLabel || "Selection by price"}
                </span>
              </Button>
            ) : null}
          </div>
        ) : (
          <Button
            style={soldOut ? undefined : primaryBtnStyle}
            disabled={soldOut}
            className={cn(
              "w-full disabled:opacity-60",
              soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
            )}
            onClick={() => onCheckout(null)}
          >
            {soldOut ? (
              "Sold out"
            ) : (
              <>
                {primaryLabel ||
                  (tickets[selected].price === 0 ? "Register" : "Get Tickets")}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}

        {extraCtas.length ? (
          <div className="space-y-2">
            {extraCtas.map((cta) => {
              const external = ctaIsExternal(cta.href);
              return (
                <Button
                  key={cta.id}
                  asChild
                  variant={cta.style === "ghost" ? "ghost" : "outline"}
                  style={cta.style === "primary" ? primaryBtnStyle : undefined}
                  className={cn(
                    "w-full",
                    cta.style === "primary"
                      ? ctaHover || "hover:opacity-90"
                      : "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground",
                    cta.style === "ghost" && "border-0",
                  )}
                >
                  <a
                    href={cta.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                  >
                    <span className="min-w-0 truncate">{cta.label}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        ) : null}
        {featureChips.length ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-0.5">
            {featureChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {footnotes.length ? (
          <div className="space-y-1 border-t border-border pt-2.5">
            {footnotes.map((text, i) => (
              <p
                key={text}
                className="flex items-start gap-1 text-[11px] leading-snug text-text-tertiary"
              >
                <sup className="mt-0.5 font-medium">{i + 1}</sup>
                <span>{text}</span>
              </p>
            ))}
          </div>
        ) : null}
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

export function GoodToKnowCard({ event, TypeIcon, language, note }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        Good To Know
        <SectionNoteBadge text={note} />
      </p>
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

export function AtRegistrationCard({ questions, note }) {
  if (!questions.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ClipboardList className="h-4 w-4 text-muted-foreground" /> At registration
        <SectionNoteBadge text={note} />
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

export function GuidelinesCard({ guidelines, note }) {
  if (!guidelines.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
        <Accessibility className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">Dietary & Accessibility</span>
        <SectionNoteBadge text={note} />
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
