"use client";

import React from "react";
import { Heart } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EMPTY_DONATION } from "@/lib/events/donation";

// Per-event checkout-donation editor. Config lives in the event metadata bag
// (metadata.donation), gated by the event's ticketRules.donation flag. See
// lib/events/donation.js for the shape + helpers.

// Parse "5, 10, 25" into [5, 10, 25]; keep only positive numbers.
const parseAmounts = (str) =>
  String(str)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

export function EventDonationSection({ event, headerItem }) {
  const [cfg, , save] = useEventConfig(event, "donation", EMPTY_DONATION);

  // Persist a single-field change into the donation bag.
  const set = (k) => (v) => save({ ...cfg, [k]: v }, { successMsg: "Donations updated." });

  const amounts = Array.isArray(cfg.suggestedAmounts) ? cfg.suggestedAmounts : [];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Donations"}
        description={
          headerItem?.desc ||
          "Let buyers add a donation at checkout — set the cause, suggested amounts, and the message they see."
        }
      />

      <SectionCard
        title="Donations"
        description="How buyers can give when they check out for this event."
      >
        <SettingsList>
          <SettingRow
            icon={Heart}
            title="Allow custom amount"
            description="Let buyers enter their own donation amount."
            checked={!!cfg.allowCustom}
            onCheckedChange={set("allowCustom")}
          />
          <SettingRow
            title="Require a donation"
            description="Buyers must give before they can complete checkout."
            checked={!!cfg.required}
            onCheckedChange={set("required")}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Cause & amounts"
        description="What donations support and how much buyers can give."
      >
        <div className="grid gap-4">
          <Field label="Cause" hint="What donations support." htmlFor="donation-cause">
            <Input
              id="donation-cause"
              value={cfg.cause || ""}
              onChange={(e) => set("cause")(e.target.value)}
              placeholder="e.g. Community scholarship fund"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Suggested amounts"
              hint="Comma-separated, e.g. 5, 10, 25."
              htmlFor="donation-amounts"
            >
              <Input
                id="donation-amounts"
                value={amounts.join(", ")}
                onChange={(e) => set("suggestedAmounts")(parseAmounts(e.target.value))}
                placeholder="5, 10, 25"
                className="tabular-nums"
              />
            </Field>
            <Field label="Minimum" hint="Smallest donation accepted." htmlFor="donation-min">
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  id="donation-min"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={cfg.minAmount ?? 1}
                  onChange={(e) => set("minAmount")(Number(e.target.value) || 0)}
                  className="tabular-nums"
                  placeholder="1"
                />
              </div>
            </Field>
          </div>
          <Field label="Prompt" hint="The message shown to buyers." htmlFor="donation-prompt">
            <Textarea
              id="donation-prompt"
              rows={2}
              value={cfg.prompt || ""}
              onChange={(e) => set("prompt")(e.target.value)}
              placeholder="Tell buyers how their donation helps."
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export default EventDonationSection;
