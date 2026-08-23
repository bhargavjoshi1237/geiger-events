"use client";

import React from "react";
import { Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";
import { TICKET_SELECTION_DEFAULTS } from "@/lib/events/ticket_selection";

// Editor for the tickets card's selection modes: a seat-plan route and/or a
// by-price route, the feature chips beneath them, and the numbered booking
// notes. Config shape + defaults live in lib/events/ticket_selection.js so the
// public RegisterCard renders exactly what is configured here.

const MODE_OPTIONS = [
  { value: "both", label: "Seating plan and by price" },
  { value: "seats", label: "Seating plan only" },
  { value: "price", label: "By price only" },
];

const FEATURE_ROWS = [
  {
    id: "plan",
    title: "Selection based on plan",
    description: "Highlights that buyers can choose from the venue's seating plan.",
  },
  {
    id: "insurance",
    title: "Cancellation insurance",
    description: "Flags that orders can be covered by cancellation insurance.",
  },
  {
    id: "digital",
    title: "Digital ticket",
    description: "Flags that tickets are delivered digitally.",
  },
];

export function TicketSelectionSection({ event, headerItem }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(
    event,
    "ticketSelection",
    TICKET_SELECTION_DEFAULTS,
  );

  const set = (key) => (value) => setCfg({ ...cfg, [key]: value });

  const toggleFeature = (id) =>
    set("features")(
      (Array.isArray(cfg.features) ? cfg.features : []).includes(id)
        ? cfg.features.filter((f) => f !== id)
        : [...cfg.features, id],
    );

  const save = () =>
    saveCfg(undefined, { successMsg: "Ticket selection saved." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Ticket Selection"}
        description={
          headerItem?.desc ||
          "Give buyers two routes on the tickets card — pick seats via the plan, or pick a ticket by price — with feature highlights and booking notes."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <SectionCard
        title="Selection modes"
        description="Replaces the single register button with one button per route. Requires a seat map to offer the seating-plan route."
      >
        <SettingsList>
          <SettingRow
            title="Enable selection modes"
            description="Off keeps today's simple ticket list with one register button."
            checked={!!cfg.enabled}
            onCheckedChange={(v) => set("enabled")(v)}
          />
        </SettingsList>
        {cfg.enabled ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Routes shown">
              <Select
                value={cfg.mode || "both"}
                onValueChange={(v) => set("mode")(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="contents">
              <Field label="Seat-plan button label" htmlFor="ts-seats-label">
                <Input
                  id="ts-seats-label"
                  value={cfg.seatsLabel || ""}
                  onChange={(e) => set("seatsLabel")(e.target.value)}
                  placeholder={TICKET_SELECTION_DEFAULTS.seatsLabel}
                />
              </Field>
              <Field label="By-price button label" htmlFor="ts-price-label">
                <Input
                  id="ts-price-label"
                  value={cfg.priceLabel || ""}
                  onChange={(e) => set("priceLabel")(e.target.value)}
                  placeholder={TICKET_SELECTION_DEFAULTS.priceLabel}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Feature highlights"
        description="Small icon chips shown under the buttons."
      >
        <SettingsList>
          {FEATURE_ROWS.map((f) => (
            <SettingRow
              key={f.id}
              title={f.title}
              description={f.description}
              checked={(Array.isArray(cfg.features) ? cfg.features : []).includes(f.id)}
              onCheckedChange={() => toggleFeature(f.id)}
            />
          ))}
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Booking notes"
        description="Numbered footnotes under the buttons. Clear a field to hide its note; the sold-out note only shows when the event is sold out."
      >
        <div className="space-y-4">
          <Field label="Automatic seat assignment" htmlFor="ts-note-auto">
            <Textarea
              id="ts-note-auto"
              rows={3}
              value={cfg.autoAssignNote || ""}
              onChange={(e) => set("autoAssignNote")(e.target.value)}
              placeholder={TICKET_SELECTION_DEFAULTS.autoAssignNote}
            />
          </Field>
          <Field label="Sold out" htmlFor="ts-note-soldout">
            <Textarea
              id="ts-note-soldout"
              rows={2}
              value={cfg.soldOutNote || ""}
              onChange={(e) => set("soldOutNote")(e.target.value)}
              placeholder={TICKET_SELECTION_DEFAULTS.soldOutNote}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export default TicketSelectionSection;
