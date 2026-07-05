"use client";

import React, { useState } from "react";
import { Map, Plus, X } from "lucide-react";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newId } from "@/components/internal/screens/events/sample_data";
import { CheckinSettingsScreen } from "./checkin_kit";

// A reusable add/remove list of named entries (gates or zones).
function NamedList({ label, placeholder, items, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    onChange([...(items || []), { id: newId(), name }]);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
        />
        <Button
          variant="outline"
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={add}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {items?.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <span
              key={it.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 py-1 text-sm text-foreground"
            >
              {it.name}
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
                onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                className="text-text-tertiary transition-colors hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">No {label.toLowerCase()} yet.</p>
      )}
    </div>
  );
}

export function MultiGateZonesScreen() {
  return (
    <CheckinSettingsScreen
      title="Multi-gate & Zones"
      description="Support multiple entrances and restricted areas with a single ticket. Define the gates and zones here, then assign them per event."
      icon={Map}
      feature="multiGate"
      enableLabel="Multi-gate & zones"
      enableHint="Track which gate an attendee entered and which zones a ticket can access."
    >
      {({ slice, set, enabled }) => (
        <div className={enabled ? "grid gap-6 lg:grid-cols-2" : "hidden"}>
          <SectionCard title="Gates" description="Entrances staff scan attendees through.">
            <NamedList
              label="Gates"
              placeholder="e.g. North entrance"
              items={slice.gates}
              onChange={(gates) => set({ gates })}
            />
          </SectionCard>
          <SectionCard title="Zones" description="Restricted areas a ticket may grant access to.">
            <NamedList
              label="Zones"
              placeholder="e.g. Backstage"
              items={slice.zones}
              onChange={(zones) => set({ zones })}
            />
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default MultiGateZonesScreen;
