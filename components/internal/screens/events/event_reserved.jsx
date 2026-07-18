"use client";

import React, { useState } from "react";
import { Armchair } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { ticketAvailable } from "@/lib/events/reserved";
import { useEventConfig } from "@/lib/events/use-event-config";

// Reserved (held-back) ticket allocation editor. Holds a block of a ticket's
// inventory out of public sale so the organiser hands it out or sells it offline.
// Config lives in the event metadata bag (metadata.reserved), an object keyed by
// the event's ticket id: { [ticketId]: { qty, note } }. Availability everywhere
// becomes `capacity − sold − reserved`. See lib/events/reserved.js for helpers.

function fmtCount(n) {
  return n === Infinity ? "Unlimited" : String(n);
}

// One held-quantity row per ticket tier. Note is buffered locally and persisted
// on blur; the reserved qty persists immediately and clamps to the tier qty.
function ReservedRow({ event, ticket, entry, ticketSold, onSave }) {
  const [note, setNote] = useState(entry.note || "");

  const [seedId, setSeedId] = useState(ticket.id);
  if (ticket.id !== seedId) {
    setSeedId(ticket.id);
    setNote(entry.note || "");
  }

  const qty = Number(ticket.qty) || 0;
  const sold = Number(ticketSold[ticket.id]) || 0;
  const held = Math.max(0, Number(entry.qty) || 0);
  const available = ticketAvailable(event, ticket, ticketSold);

  const persist = (nextQty, nextNote) =>
    onSave(ticket.id, { qty: nextQty, note: nextNote });

  const onQty = (value) => {
    let next = Math.max(0, Number(value) || 0);
    if (qty > 0) next = Math.min(next, qty); // never hold back more than the tier has
    persist(next, note);
  };

  return (
    <SectionCard title={ticket.name || "Untitled ticket"}>
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary tabular-nums">
          <span>{qty > 0 ? `${qty} qty` : "Unlimited qty"}</span>
          <span className="text-text-tertiary">•</span>
          <span>{sold} sold</span>
          <span className="text-text-tertiary">•</span>
          <span>{held} reserved</span>
          <span className="text-text-tertiary">•</span>
          <span>{fmtCount(available)} available</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reserved" hint={qty > 0 ? `Max ${qty}` : "Held out of sale"}>
            <Input
              type="number"
              min={0}
              max={qty > 0 ? qty : undefined}
              inputMode="numeric"
              value={held}
              onChange={(e) => onQty(e.target.value)}
              className="tabular-nums"
              placeholder="0"
            />
          </Field>
          <Field label="Note" hint="Optional">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => persist(held, note)}
              placeholder="e.g. Press & VIP hold"
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}

export function EventReservedSection({ event, headerItem }) {
  const [reserved, , save] = useEventConfig(event, "reserved", {});

  const tickets = Array.isArray(event.tickets) ? event.tickets : [];
  const ticketSold = event.ticketSold || {};

  const saveEntry = (ticketId, entry) =>
    save({ ...reserved, [ticketId]: entry }, { successMsg: "Reserved updated." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Reserved Seating"}
        description={
          headerItem?.desc ||
          "Hold back a block of each ticket's inventory from public sale — for guest lists, press, or offline sales."
        }
      />

      {tickets.length ? (
        <div className="space-y-4">
          {tickets
            .filter((t) => t && t.id)
            .map((ticket) => (
              <ReservedRow
                key={ticket.id}
                event={event}
                ticket={ticket}
                entry={reserved?.[ticket.id] || {}}
                ticketSold={ticketSold}
                onSave={saveEntry}
              />
            ))}
        </div>
      ) : (
        <EmptyState
          icon={Armchair}
          title="No tickets yet"
          description="Add ticket types in the Tickets tab first — reserved allocation holds back inventory from those tiers."
        />
      )}
    </div>
  );
}

export default EventReservedSection;
