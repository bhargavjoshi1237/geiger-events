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
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EMPTY_DONATION } from "@/lib/events/donation";

const parseAmounts = (str) =>
  String(str)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

export function EventDonationSection({ event, headerItem }) {
  const [cfg, setCfg, save] = useEventConfig(event, "donation", EMPTY_DONATION);

  const commit = (key, value) =>
    save({ ...cfg, [key]: value }, { successMsg: "Donations updated." });

  const draft = (key) => (value) => setCfg({ ...cfg, [key]: value });

  const amounts = Array.isArray(cfg.suggestedAmounts) ? cfg.suggestedAmounts : [];
  const [amountsDraft, setAmountsDraft] = React.useState(null);
  const amountsValue = amountsDraft ?? amounts.join(", ");

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
            onCheckedChange={(v) => commit("allowCustom", v)}
          />
          <SettingRow
            title="Require a donation"
            description="Buyers must give before they can complete checkout."
            checked={!!cfg.required}
            onCheckedChange={(v) => commit("required", v)}
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
              onChange={(e) => draft("cause")(e.target.value)}
              onBlur={() => commit("cause", cfg.cause)}
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
                value={amountsValue}
                onChange={(e) => setAmountsDraft(e.target.value)}
                onBlur={() => {
                  commit("suggestedAmounts", parseAmounts(amountsValue));
                  setAmountsDraft(null);
                }}
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
                  onChange={(e) => draft("minAmount")(Number(e.target.value) || 0)}
                  onBlur={() => commit("minAmount", cfg.minAmount)}
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
              onChange={(e) => draft("prompt")(e.target.value)}
              onBlur={() => commit("prompt", cfg.prompt)}
              placeholder="Tell buyers how their donation helps."
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export default EventDonationSection;
