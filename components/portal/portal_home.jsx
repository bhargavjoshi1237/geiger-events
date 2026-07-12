"use client";

import React, { useMemo } from "react";
import { Ticket, BadgeCheck, CalendarDays, Wallet, MapPin, ArrowRight } from "lucide-react";

import {
  Cover,
  Countdown,
  SectionTitle,
  CalendarButton,
  DirectionsButton,
  money,
  fmtDay,
  fmtDate,
  greeting,
  firstName,
  isUpcoming,
} from "./portal_kit";
import { StatusPill } from "@/components/internal/shared/screen_kit";

const ORDER_STATUS = {
  confirmed: { label: "Confirmed", dotClass: "bg-emerald-400" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
  refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function NextEventHero({ ticket, onOpenTicket }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      <div className="relative h-40 w-full sm:h-48">
        <Cover url={ticket.coverUrl} name={ticket.eventName} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">
            Your next event
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
            {ticket.eventName}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {ticket.eventDate ? fmtDay(ticket.eventDate) : "Date TBA"}
              {ticket.eventTime ? ` · ${ticket.eventTime}` : ""}
            </span>
            {ticket.venue || ticket.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[ticket.venue, ticket.city].filter(Boolean).join(", ")}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <Countdown dateStr={ticket.eventDate} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenTicket("tickets")}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Ticket className="h-4 w-4" /> View ticket
          </button>
          <CalendarButton order={ticket} />
          <DirectionsButton order={ticket} />
        </div>
      </div>
    </div>
  );
}

export function PortalHome({ member, data, onNavigate }) {
  const { orders = [], memberships = [], tickets = [] } = data || {};

  const nextTicket = useMemo(() => {
    const upcoming = (tickets || [])
      .filter((t) => t.eventDate && isUpcoming(t.eventDate))
      .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    return upcoming[0] || null;
  }, [tickets]);

  const stats = useMemo(() => {
    const upcomingCount = (tickets || []).filter((t) => isUpcoming(t.eventDate)).length;
    const activeMemberships = (memberships || []).filter((m) => m.status === "Active").length;
    const spent = (orders || [])
      .filter((o) => o.status !== "refunded" && o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    return {
      upcoming: upcomingCount,
      tickets: (tickets || []).length,
      memberships: activeMemberships,
      spent,
    };
  }, [orders, memberships, tickets]);

  const recentOrders = (orders || []).slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {greeting()}, {firstName(member?.name, member?.email)}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {nextTicket
            ? "Here's what's coming up."
            : "You're all caught up — no upcoming events."}
        </p>
      </div>

      {nextTicket ? (
        <NextEventHero ticket={nextTicket} onOpenTicket={onNavigate} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={CalendarDays} label="Upcoming" value={stats.upcoming} />
        <StatTile icon={Ticket} label="Tickets" value={stats.tickets} />
        <StatTile icon={BadgeCheck} label="Memberships" value={stats.memberships} />
        <StatTile icon={Wallet} label="Total spent" value={money(stats.spent)} />
      </div>

      {recentOrders.length ? (
        <section>
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => onNavigate("orders")}
                className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-foreground"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            Recent orders
          </SectionTitle>
          <div className="divide-y divide-border rounded-xl border border-border bg-surface-card">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{o.eventName}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{fmtDate(o.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill status={o.status} map={ORDER_STATUS} />
                  <span className="text-sm tabular-nums text-foreground">{money(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default PortalHome;
