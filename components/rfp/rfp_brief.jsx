"use client";

import React from "react";
import { BedDouble, CalendarDays, Coffee, MapPin, MonitorSpeaker, Presentation, Users, Wallet } from "lucide-react";

import {
  formatDateRange,
  formatDay,
  formatMoney,
  normalizeAlternateDates,
  normalizeRoomRequirements,
  normalizeSleepingRooms,
  peakRooms,
  roomNights,
  setupStyleLabel,
} from "@/lib/sourcing/rfp_model";

function Fact({ icon: Icon, label, value, sub }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
        {sub ? <p className="text-xs text-text-tertiary">{sub}</p> : null}
      </div>
    </div>
  );
}

function Block({ icon: Icon, title, children }) {
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-text-secondary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

// The brief as a venue reads it. Takes a camelCase RFP (raw jsonb lists are normalised here).
export function RfpBrief({ rfp, className }) {
  const rooms = normalizeRoomRequirements(rfp?.roomRequirements);
  const sleeping = normalizeSleepingRooms(rfp?.sleepingRooms);
  const nights = roomNights(sleeping);
  const alternates = normalizeAlternateDates(rfp?.alternateDates).filter((d) => d.start);
  const currency = rfp?.currency || "USD";
  const budget =
    rfp?.budgetMin != null || rfp?.budgetMax != null
      ? rfp.budgetMin != null && rfp.budgetMax != null
        ? `${formatMoney(rfp.budgetMin, currency)} – ${formatMoney(rfp.budgetMax, currency)}`
        : rfp.budgetMax != null
          ? `Up to ${formatMoney(rfp.budgetMax, currency)}`
          : `From ${formatMoney(rfp.budgetMin, currency)}`
      : "";
  const dates = rfp?.startDate ? formatDateRange(rfp.startDate, rfp.endDate) : rfp?.datesFlexible ? "Flexible" : "";

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Fact
          icon={CalendarDays}
          label="Dates"
          value={dates}
          sub={[
            rfp?.datesFlexible && rfp?.startDate ? "Flexible on dates" : "",
            alternates.length ? `Also works: ${alternates.map((d) => formatDateRange(d.start, d.end)).join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Fact
          icon={Users}
          label="Attendees"
          value={Number(rfp?.attendees) > 0 ? `${Number(rfp.attendees).toLocaleString("en-US")} people` : ""}
        />
        <Fact icon={MapPin} label="Location" value={rfp?.location} />
        <Fact icon={Wallet} label="Budget" value={budget} sub={budget ? `In ${currency}` : ""} />
      </div>

      {rfp?.summary ? (
        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{rfp.summary}</p>
      ) : null}

      <div className="mt-5 space-y-5">
        {rooms.length ? (
          <Block icon={Presentation} title="Meeting space">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-card text-left text-xs text-text-secondary">
                    <th className="px-3 py-2 font-medium">Room</th>
                    <th className="px-3 py-2 font-medium">Setup</th>
                    <th className="px-3 py-2 text-right font-medium">Capacity</th>
                    <th className="px-3 py-2 text-right font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-foreground">{r.label || "Room"}</td>
                      <td className="px-3 py-2 text-text-secondary">{setupStyleLabel(r.setupStyle)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {r.capacity ? r.capacity.toLocaleString("en-US") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.days || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        ) : null}

        {nights ? (
          <Block icon={BedDouble} title="Sleeping rooms">
            <p className="text-sm text-text-secondary">
              {nights.toLocaleString("en-US")} room nights, peaking at {peakRooms(sleeping).toLocaleString("en-US")} rooms.
            </p>
            <div className="flex flex-wrap gap-2">
              {sleeping.nights
                .filter((n) => n.rooms > 0)
                .map((n, i) => (
                  <span
                    key={`${n.date}-${i}`}
                    className="rounded-md border border-border bg-surface-card px-2.5 py-1 text-xs text-text-secondary"
                  >
                    {n.date ? formatDay(n.date) : `Night ${i + 1}`} ·{" "}
                    <span className="font-medium text-foreground">{n.rooms}</span> rooms
                  </span>
                ))}
            </div>
          </Block>
        ) : null}

        {rfp?.fnbRequirements || rfp?.fnbMinimum ? (
          <Block icon={Coffee} title="Food & beverage">
            {rfp.fnbRequirements ? (
              <p className="whitespace-pre-line text-sm text-text-secondary">{rfp.fnbRequirements}</p>
            ) : null}
            {rfp.fnbMinimum ? (
              <p className="text-xs text-text-tertiary">
                Expected F&amp;B spend around {formatMoney(rfp.fnbMinimum, currency)}
              </p>
            ) : null}
          </Block>
        ) : null}

        {rfp?.avNeeds ? (
          <Block icon={MonitorSpeaker} title="AV & production">
            <p className="whitespace-pre-line text-sm text-text-secondary">{rfp.avNeeds}</p>
          </Block>
        ) : null}
      </div>
    </div>
  );
}

export default RfpBrief;
