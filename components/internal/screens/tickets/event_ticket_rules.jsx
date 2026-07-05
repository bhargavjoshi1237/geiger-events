"use client";

import React from "react";
import {
  Timer,
  Heart,
  KeyRound,
  Armchair,
  Users,
} from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { useEventConfig } from "@/lib/events/use-event-config";

// Per-event toggles for the project-global Tickets features. Each flag is stored
// in the event's own metadata bag under `ticketRules`, so an event opts into the
// features enabled at the project level (Tickets sidebar). The global setting
// governs availability; this decides whether THIS event uses it.
const RULES = [
  {
    key: "earlybird",
    icon: Timer,
    title: "Early-bird pricing",
    description: "Offer the early-bird discount on this event.",
  },
  {
    key: "donation",
    icon: Heart,
    title: "Donations",
    description: "Let buyers add a donation at checkout.",
  },
  {
    key: "accessCode",
    icon: KeyRound,
    title: "Access-code tickets",
    description: "Allow hidden tickets unlocked by a code.",
  },
  {
    key: "reservedSeating",
    icon: Armchair,
    title: "Reserved seating",
    description: "Buyers pick a seat instead of general admission.",
  },
  {
    key: "groupPurchase",
    icon: Users,
    title: "Group purchasing",
    description: "Allow discounted bulk/group orders.",
  },
];

export function TicketRulesSection({ event, headerItem }) {
  const [rules, , save] = useEventConfig(event, "ticketRules", {});

  const toggle = (key, value) =>
    save(
      { ...rules, [key]: value },
      { successMsg: value ? "Enabled for this event." : "Disabled." },
    );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Ticket Rules"}
        description={
          headerItem?.desc ||
          "Turn project-wide ticketing features on for this event. Configure the features themselves under the Tickets sidebar."
        }
      />
      <SectionCard
        title="Features"
        description="Each is available only when enabled at the project level."
      >
        <SettingsList>
          {RULES.map((r) => (
            <SettingRow
              key={r.key}
              icon={r.icon}
              title={r.title}
              description={r.description}
              checked={!!rules[r.key]}
              onCheckedChange={(v) => toggle(r.key, v)}
            />
          ))}
        </SettingsList>
      </SectionCard>
    </div>
  );
}

export default TicketRulesSection;
