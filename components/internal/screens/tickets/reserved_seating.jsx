"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Armchair, Loader2 } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultReservedSeatingConfig, formatDate } from "./constants";

const SEAT_STATUS_MAP = {
  on: { label: "Reserved seating", dotClass: "bg-emerald-400" },
  off: { label: "General admission", dotClass: "bg-slate-400", variant: "neutral" },
};

// Read-only roster of the project's events and whether each uses reserved
// seating (per-event flag stored in event.ticketRules.reservedSeating).
function EventsReservedSeatingList() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      setEvents(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const rows = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        name: e.name,
        date: e.date,
        on: !!e.ticketRules?.reservedSeating,
      })),
    [events],
  );

  return (
    <SectionCard
      title="Events"
      description="Which events use reserved seating. Turn it on for an event from its edit page → Ticket Rules."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      ) : rows.length ? (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-text-secondary">{formatDate(r.date)}</p>
              </div>
              <StatusPill status={r.on ? "on" : "off"} map={SEAT_STATUS_MAP} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Armchair}
          title="No events yet"
          description="Create an event, then enable reserved seating for it from its edit page."
        />
      )}
    </SectionCard>
  );
}

function ReservedSeatingForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Reserved seating"
        description="Buyers pick a specific seat instead of general admission. Enable it here; turn it on per event from its edit page."
      >
        <SettingsList>
          <SettingRow
            icon={Armchair}
            title="Enable reserved seating"
            description="Allow seat-map selection for this project's events."
            checked={!!config.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <SettingRow
            title="Pick-your-seat"
            description="Let buyers choose their own seat from the map."
            checked={!!config.allowPickYourSeat}
            onCheckedChange={(v) => set({ allowPickYourSeat: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Defaults">
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Seat hold"
            hint="Minutes a seat is held during checkout."
            value={config.holdMinutes ?? 10}
            onChange={(v) => set({ holdMinutes: v })}
            unit="min"
          />
          <Field label="Default seat map" hint="Name of the map events start from.">
            <Input
              value={config.defaultMapName || ""}
              onChange={(e) => set({ defaultMapName: e.target.value })}
              placeholder="e.g. Main hall"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function ReservedSeatingScreen() {
  return (
    <SettingsScreen
      module="reserved_seating"
      title="Reserved Seating"
      description="Project-wide reserved-seating settings, plus which events use it. Enable and configure here; toggle per event on its edit page."
      defaultConfig={defaultReservedSeatingConfig}
      Form={ReservedSeatingForm}
    >
      <EventsReservedSeatingList />
    </SettingsScreen>
  );
}

export default ReservedSeatingScreen;
