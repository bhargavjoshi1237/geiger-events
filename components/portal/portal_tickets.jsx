"use client";

import React, { useMemo, useState } from "react";
import {
  Ticket,
  Clock,
  MapPin,
  CalendarDays,
  MessageSquare,
  RotateCcw,
  Loader2,
  User,
  Building2,
} from "lucide-react";

import { EmptyState, StatusPill, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  money,
  fmtDate,
  fmtDay,
  isUpcoming,
} from "./portal_kit";
import { locationText } from "@/lib/portal/calendar";

export const REFUND_STATUS = {
  Requested: { label: "Refund requested", dotClass: "bg-amber-400" },
  Approved: { label: "Refund approved", dotClass: "bg-emerald-400" },
  Denied: { label: "Refund denied", dotClass: "bg-red-400" },
  Refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};

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
      <div className="flex shrink-0 flex-col items-end gap-1 pr-4 text-right">
        <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-xs text-muted-foreground">
          {t.ticket || "Admission"} ×{t.quantity}
        </span>
        {t.refund ? <StatusPill status={t.refund.status} map={REFUND_STATUS} /> : null}
      </div>
    </Card>
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

export function RefundPanel({ ticket, onRequestRefund }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (ticket.refund) {
    return (
      <div className="rounded-xl border border-border bg-surface-card p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Refund</span>
          <StatusPill status={ticket.refund.status} map={REFUND_STATUS} />
        </div>
        {ticket.refund.reason ? (
          <p className="mt-1 text-xs text-text-tertiary">“{ticket.refund.reason}”</p>
        ) : null}
      </div>
    );
  }

  // Only paid, still-confirmed orders can be refunded.
  if (!ticket.paid || ticket.status !== "confirmed") return null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
      >
        <RotateCcw className="h-4 w-4" /> Request refund
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-card p-3">
      <p className="text-sm font-medium text-foreground">Request a refund</p>
      <Textarea
        rows={3}
        value={reason}
        autoFocus
        onChange={(e) => setReason(e.target.value)}
        placeholder="Tell the organiser why (optional)…"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onRequestRefund(ticket, reason);
            setBusy(false);
            if (ok) setOpen(false);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
        </Button>
      </div>
    </div>
  );
}

function TicketDialog({ ticket, onClose, onMessage, onRequestRefund }) {
  const loc = ticket ? locationText(ticket) : "";
  return (
    <Dialog open={Boolean(ticket)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
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
                <Row icon={User} label="Attendee">
                  {ticket.buyerName}
                </Row>
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
              {ticket.organizer ? (
                <Row icon={Building2} label="Organiser">
                  {ticket.organizer}
                </Row>
              ) : null}
            </div>

            {/* Purchase breakdown */}
            <div className="space-y-2 rounded-xl border border-border bg-surface-card p-4 text-sm">
              <Row label="Order">{ticket.orderCode}</Row>
              {ticket.createdAt ? <Row label="Purchased">{fmtDate(ticket.createdAt)}</Row> : null}
              {ticket.slot ? (
                <Row label="Slot">
                  {ticket.slot.label}
                  {ticket.slot.band ? ` · ${ticket.slot.band}` : ""}
                </Row>
              ) : null}
              {ticket.offerings?.length ? (
                <div>
                  <p className="text-text-secondary">Add-ons</p>
                  <ul className="mt-1 space-y-0.5">
                    {ticket.offerings.map((o, i) => (
                      <li key={i} className="text-xs text-foreground">
                        {typeof o === "string" ? o : o?.name || o?.label || JSON.stringify(o)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ticket.purchasables?.length ? (
                <div>
                  <p className="text-text-secondary">Purchasables</p>
                  <ul className="mt-1 space-y-0.5">
                    {ticket.purchasables.map((p, i) => (
                      <li key={i} className="flex justify-between text-xs text-foreground">
                        <span>
                          {p?.name || "Add-on"}
                          {p?.quantity > 1 ? ` × ${p.quantity}` : ""}
                        </span>
                        {p?.total > 0 ? (
                          <span className="tabular-nums text-text-secondary">
                            {money(p.total)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ticket.bundle ? (
                <div>
                  <p className="text-text-secondary">Bundle · {ticket.bundle.name}</p>
                  {Array.isArray(ticket.bundle.items) ? (
                    <ul className="mt-1 space-y-0.5">
                      {ticket.bundle.items.map((it, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {it?.name || "Ticket"}
                          {it?.qty > 1 ? ` × ${it.qty}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {ticket.group?.size ? (
                <Row label="Group order">1 of {ticket.group.size}</Row>
              ) : null}
              {ticket.discount ? (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Discount ({ticket.discount.code})</span>
                  <span className="tabular-nums">−{money(ticket.discount.amount)}</span>
                </div>
              ) : null}
              {/* Order-level amounts only on single-buyer orders — group rows show
                  each attendee's own share as the total. */}
              {!ticket.group && ticket.earlybird?.amount > 0 ? (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Early bird</span>
                  <span className="tabular-nums">−{money(ticket.earlybird.amount)}</span>
                </div>
              ) : null}
              {!ticket.group && ticket.donation?.amount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">
                    Donation{ticket.donation.cause ? ` · ${ticket.donation.cause}` : ""}
                  </span>
                  <span className="tabular-nums text-foreground">{money(ticket.donation.amount)}</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>Total paid</span>
                <span className="tabular-nums">{money(ticket.total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <CalendarButton order={ticket} />
              <DirectionsButton order={ticket} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onMessage(ticket)}
                className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
              >
                <MessageSquare className="h-4 w-4" /> Message organiser
              </Button>
            </div>

            <RefundPanel ticket={ticket} onRequestRefund={onRequestRefund} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function PortalTickets({ tickets, onMessage, onRequestRefund }) {
  const [open, setOpen] = useState(null);

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    for (const t of tickets || []) (isUpcoming(t.eventDate) ? up : pa).push(t);
    return { upcoming: up, past: pa };
  }, [tickets]);

  // Keep the open dialog's data fresh after a refund refetch.
  const openTicket = useMemo(
    () => (open ? (tickets || []).find((t) => t.id === open.id) || open : null),
    [open, tickets],
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Tickets"
        description="Your tickets, ready to scan at the door — tap one for the QR, calendar and directions."
      />

      {!tickets?.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Ticket}
            title="No tickets yet"
            description="Buy a ticket to any event and it'll appear here, ready to scan at the door."
          />
        </div>
      ) : (
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
        </div>
      )}

      <TicketDialog
        ticket={openTicket}
        onClose={() => setOpen(null)}
        onMessage={(t) => {
          setOpen(null);
          onMessage?.(t);
        }}
        onRequestRefund={onRequestRefund}
      />
    </MainScreenWrapper>
  );
}

export default PortalTickets;
