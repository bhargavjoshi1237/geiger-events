"use client";

import React from "react";
import { Layers } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { RecordsScreen } from "./records_kit";
import { NumField as Num } from "./controls";
import { defaultTierConfig, TIER_COLOR_OPTIONS } from "./constants";

const KINDS = [
  { value: "tier", label: "Tier", defaultConfig: defaultTierConfig },
];

const colorDot = (value) =>
  TIER_COLOR_OPTIONS.find((c) => c.value === value)?.dotClass ||
  TIER_COLOR_OPTIONS[0].dotClass;

// List-card summary line: "Rank 1 · VIP access".
function summarize(r) {
  const c = r.config || {};
  const desc = (c.description || "").trim();
  return [`Rank ${c.rank ?? 1}`, desc || "no description"].join(" · ");
}

function TierEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  return (
    <SectionCard
      title="Tier"
      description="A level events group their tickets into — General, VIP, Platinum."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Num
          label="Rank"
          hint="Lower ranks show first."
          value={config.rank ?? 1}
          onChange={(v) => set({ rank: v })}
          min={1}
        />
        <Field label="Accent">
          <Select
            value={config.color || "slate"}
            onValueChange={(v) => set({ color: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_COLOR_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full", c.dotClass)}
                    />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <Field
          label="Description"
          hint="What this tier includes — shown beside its tickets."
        >
          <Textarea
            rows={2}
            value={config.description || ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Front-row seating and early entry."
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
        <span className={cn("h-2.5 w-2.5 rounded-full", colorDot(config.color))} />
        Preview accent
      </div>
    </SectionCard>
  );
}

export function TicketTiersScreen() {
  return (
    <RecordsScreen
      module="tier"
      title="Ticket Tiers"
      description="Reusable ticket levels. Create a tier here, then group an event's tickets into it from the event's edit page."
      singular="tier"
      icon={Layers}
      kinds={KINDS}
      summarize={summarize}
      EditForm={TierEditForm}
    />
  );
}

export default TicketTiersScreen;
