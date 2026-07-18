"use client";

import React from "react";
import {
  Timer,
  Heart,
  KeyRound,
  Armchair,
  Users,
  Package,
  ArrowRight,
} from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEventConfig } from "@/lib/events/use-event-config";

// Per-event toggles for the project-global Tickets features. Each flag is stored
// in the event's own metadata bag under `ticketRules`, so an event opts into the
// features enabled at the project level (Tickets sidebar). The global setting
// governs availability; this decides whether THIS event uses it. Turning a rule on
// reveals its dedicated config tab in the editor (gated by `showIf` in
// event_sections.js) — the "Configure" action jumps straight to it.
const RULES = [
  {
    key: "earlybird",
    tab: "earlybird",
    icon: Timer,
    title: "Early-bird pricing",
    description: "Discount the ticket price during a limited window.",
  },
  {
    key: "donation",
    tab: "donation",
    icon: Heart,
    title: "Donations",
    description: "Let buyers add a donation at checkout.",
  },
  {
    key: "accessCode",
    tab: "accesscode",
    icon: KeyRound,
    title: "Access-code tickets",
    description: "Hide tickets behind a code buyers unlock on the page.",
  },
  {
    key: "reservedSeating",
    tab: "reserved",
    icon: Armchair,
    title: "Reserved seating",
    description: "Hold back a block of tickets from public sale.",
  },
  {
    key: "groupPurchase",
    tab: "group",
    icon: Users,
    title: "Group purchasing",
    description: "Buy a block and dispense a ticket to each attendee's email.",
  },
  {
    key: "bundles",
    tab: "bundles",
    icon: Package,
    title: "Bundles",
    description: "Sell several tickets together as one purchase.",
  },
];

export function TicketRulesSection({ event, headerItem, onNavigate }) {
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
          "Turn project-wide ticketing features on for this event. Enabling one reveals its own tab where you configure it. Configure the features themselves under the Tickets sidebar."
        }
      />
      <SectionCard
        title="Features"
        description="Each is available only when enabled at the project level. Turn one on, then Configure it."
      >
        <SettingsList>
          {RULES.map((r) => {
            const on = !!rules[r.key];
            return (
              <SettingRow
                key={r.key}
                icon={r.icon}
                title={r.title}
                description={r.description}
                control={
                  <div className="flex items-center gap-2">
                    {on && onNavigate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigate(r.tab)}
                        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      >
                        Configure <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => toggle(r.key, v)}
                      aria-label={`${on ? "Disable" : "Enable"} ${r.title}`}
                    />
                  </div>
                }
              />
            );
          })}
        </SettingsList>
      </SectionCard>
    </div>
  );
}

export default TicketRulesSection;
