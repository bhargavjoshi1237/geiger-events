"use client";

import React, { useMemo, useState } from "react";
import { Ticket, Clock, MapPin, CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/internal/shared/screen_kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  Cover,
  SectionTitle,
  TicketQr,
  CalendarButton,
  DirectionsButton,
  fmtDate,
  fmtDay,
  isUpcoming,
} from "./portal_kit";
import { locationText } from "@/lib/portal/calendar";

function TicketCard({ t, onOpen }) {
  return (
    <Card onClick={() => onOpen(t)} className="flex items-center gap-4 p-0">
      <Cover
        url={t.coverUrl}
        name={t.eventName}
        className="h-20 w-20 shrink-0 rounded-l-xl"
      />
      <div className="min-w-0 flex-1 py-3 pr-4">
        <p className="truncate text-sm font-semibold text-foreground">
          {t.eventName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
          <CalendarDays className="h-3.5 w-3.5" />
          {t.eventDate ? fmtDate(t.eventDate) : "Date TBA"}
          {t.eventTime ? ` · ${t.eventTime}` : ""}
        </p>
        {t.venue || t.city ? (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-tertiary">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {[t.venue, t.city].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 pr-4 text-right">
        <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-xs text-muted-foreground">
          {t.ticket || "Admission"} ×{t.quantity}
        </span>
      </div>
    </Card>
  );
}

function TicketDialog({ ticket, onClose }) {
  const loc = ticket ? locationText(ticket) : "";
  return (
    <Dialog open={Boolean(ticket)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {ticket ? (
          <>
            <DialogHeader>
              <DialogTitle>{ticket.eventName}</DialogTitle>
            </DialogHeader>

            <TicketQr orderId={ticket.id} />
            <p className="-mt-2 text-center text-xs text-text-tertiary">
              Show this at the door · {ticket.orderCode}
            </p>

            <div className="space-y-2 rounded-xl border border-border bg-surface-card p-4 text-sm">
              <Row icon={Ticket} label="Ticket">
                {ticket.ticket || "Admission"} × {ticket.quantity}
              </Row>
              {ticket.buyerName ? (
                <Row label="Attendee">{ticket.buyerName}</Row>
              ) : null}
              <Row icon={CalendarDays} label="When">
                {ticket.eventDate ? fmtDay(ticket.eventDate) : "TBA"}
                {ticket.eventTime ? ` · ${ticket.eventTime}` : ""}
              </Row>
              {loc ? (
                <Row icon={MapPin} label="Where">
                  {loc}
                </Row>
              ) : null}
              {ticket.timezone ? (
                <Row icon={Clock} label="Timezone">
                  {ticket.timezone}
                </Row>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <CalendarButton order={ticket} />
              <DirectionsButton order={ticket} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-text-secondary">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

export function PortalTickets({ tickets }) {
  const [open, setOpen] = useState(null);

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    for (const t of tickets || []) (isUpcoming(t.eventDate) ? up : pa).push(t);
    return { upcoming: up, past: pa };
  }, [tickets]);

  if (!tickets?.length) {
    return (
      <EmptyState
        icon={Ticket}
        title="No tickets yet"
        description="Buy a ticket to any event and it'll appear here, ready to scan at the door."
      />
    );
  }

  return (
    <div className="space-y-8">
      {upcoming.length ? (
        <section>
          <SectionTitle>Upcoming</SectionTitle>
          <div className="space-y-3">
            {upcoming.map((t) => (
              <TicketCard key={t.id} t={t} onOpen={setOpen} />
            ))}
          </div>
        </section>
      ) : null}

      {past.length ? (
        <section>
          <SectionTitle>Past</SectionTitle>
          <div className="space-y-3 opacity-75">
            {past.map((t) => (
              <TicketCard key={t.id} t={t} onOpen={setOpen} />
            ))}
          </div>
        </section>
      ) : null}

      <TicketDialog ticket={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default PortalTickets;
