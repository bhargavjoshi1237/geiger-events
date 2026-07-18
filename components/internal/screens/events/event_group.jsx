"use client";

import React from "react";
import { Users } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EMPTY_GROUP } from "@/lib/events/group";

// Per-event group ordering. Config lives in the event metadata bag
// (metadata.groupPurchase); group mode lets a buyer take a block of seats in one
// payment and dispense one ticket to each attendee's email. See lib/events/group.js.

export function EventGroupSection({ event, headerItem }) {
  const [cfg, , save] = useEventConfig(event, "groupPurchase", EMPTY_GROUP);

  const setField = (key, value) =>
    save({ ...cfg, [key]: value }, { successMsg: "Group settings updated." });

  // Ticket tiers (id + name) so the eligibility chips key on the stable id.
  const ticketTypes = (Array.isArray(event.tickets) ? event.tickets : [])
    .filter((t) => t && t.id)
    .map((t) => ({ id: String(t.id), name: t.name || "Untitled" }));

  const isAllTickets = cfg.eligibleTickets === "all";
  const toggleTicket = (id) => {
    const cur = Array.isArray(cfg.eligibleTickets) ? cfg.eligibleTickets : [];
    const next = cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id];
    setField("eligibleTickets", next.length ? next : "all");
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Group Orders"}
        description={
          headerItem?.desc ||
          "Let a buyer take a block of seats in one payment and dispense one ticket to each attendee's email."
        }
      />

      <SectionCard title="Limits">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum seats" htmlFor="group-min">
            <Input
              id="group-min"
              type="number"
              min={1}
              inputMode="numeric"
              value={cfg.minSeats ?? ""}
              onChange={(e) => setField("minSeats", Number(e.target.value) || 0)}
              className="tabular-nums"
              placeholder="5"
            />
          </Field>
          <Field label="Maximum seats" hint="0 = no max" htmlFor="group-max">
            <Input
              id="group-max"
              type="number"
              min={0}
              inputMode="numeric"
              value={cfg.maxSeats ?? ""}
              onChange={(e) => setField("maxSeats", Number(e.target.value) || 0)}
              className="tabular-nums"
              placeholder="0"
            />
          </Field>
          <Field label="Group discount %" htmlFor="group-discount">
            <Input
              id="group-discount"
              type="number"
              min={0}
              inputMode="numeric"
              value={cfg.discountPercent ?? ""}
              onChange={(e) => setField("discountPercent", Number(e.target.value) || 0)}
              className="tabular-nums"
              placeholder="10"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Approval">
        <SettingsList>
          <SettingRow
            icon={Users}
            title="Require approval"
            description="Review each group order before it's confirmed."
            checked={!!cfg.requireApproval}
            onCheckedChange={(v) => setField("requireApproval", v)}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Eligible tickets"
        description="Which ticket types can be bought as a group."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setField("eligibleTickets", "all")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isAllTickets
                ? "border-white bg-white text-[#161616]"
                : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
            )}
          >
            All tickets
          </button>
          {ticketTypes.map((t) => {
            const active =
              !isAllTickets &&
              Array.isArray(cfg.eligibleTickets) &&
              cfg.eligibleTickets.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTicket(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-white bg-white text-[#161616]"
                    : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

export default EventGroupSection;
