"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CloudOff, Info, Loader2, ShieldAlert, Timer } from "lucide-react";

import { SectionCard, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { useProject } from "@/context/project-context";
import { updateCheckinSettings } from "@/lib/supabase/checkin";
import { RowSelect } from "../checkin_kit";
import { withDefaults } from "../constants";

const REFRESH_OPTIONS = [1, 2, 5, 10, 15, 30].map((m) => ({ value: String(m), label: m === 1 ? "Every minute" : `Every ${m} minutes` }));

// config.offline = { enabled, refreshMinutes, allowCappedZones, events: { [eventId]: boolean } }.
// The project switch falls back to Check-in App's older "Offline caching" toggle, which it keeps in step.
export function offlineSlice(config) {
  const raw = config?.offline && typeof config.offline === "object" ? config.offline : {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : !!withDefaults(config, "checkinApp").offlineCache,
    refreshMinutes: Number(raw.refreshMinutes) || 5,
    allowCappedZones: !!raw.allowCappedZones,
    events: raw.events && typeof raw.events === "object" ? raw.events : {},
  };
}

export function offlineOnForEvent(slice, eventId) {
  const own = eventId ? slice.events?.[eventId] : undefined;
  return typeof own === "boolean" ? own : slice.enabled;
}

export function OfflineSettings({ config, eventId, eventName, onSaved }) {
  const { projectId } = useProject();
  const initial = useMemo(() => offlineSlice(config), [config]);
  const [slice, setSlice] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(slice) !== JSON.stringify(initial);

  const own = eventId ? slice.events[eventId] : undefined;
  const eventMode = own === true ? "on" : own === false ? "off" : "inherit";
  const setEventMode = (mode) => {
    const events = { ...slice.events };
    if (mode === "inherit") delete events[eventId];
    else events[eventId] = mode === "on";
    setSlice({ ...slice, events });
  };

  const save = async () => {
    setSaving(true);
    const res = await updateCheckinSettings(projectId, {
      offline: slice,
      checkinApp: { ...withDefaults(config, "checkinApp"), offlineCache: slice.enabled },
    });
    setSaving(false);
    if (!res) {
      toast.error("Couldn't save offline settings.");
      return;
    }
    toast.success("Offline settings saved. Devices pick them up on their next refresh.");
    onSaved?.(res);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Offline mode"
        description="Project default — each event can follow it or override it below."
        action={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        }
      >
        <SettingsList>
          <SettingRow
            icon={CloudOff}
            title="Offline check-in"
            description="Staff devices keep the guest list and go on admitting without a connection, then sync."
            checked={slice.enabled}
            onCheckedChange={(v) => setSlice({ ...slice, enabled: v })}
          />
          {eventId ? (
            <SettingRow
              title={eventName ? `For ${eventName}` : "For this event"}
              description="Override the project default for the selected event."
              control={
                <RowSelect
                  value={eventMode}
                  onChange={setEventMode}
                  options={[
                    { value: "inherit", label: `Project default (${slice.enabled ? "on" : "off"})` },
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              }
            />
          ) : null}
          <SettingRow
            icon={Timer}
            title="Guest list refresh"
            description="How often connected devices download a fresh guest list."
            control={
              <RowSelect
                value={String(slice.refreshMinutes)}
                onChange={(v) => setSlice({ ...slice, refreshMinutes: Number(v) })}
                options={REFRESH_OPTIONS}
              />
            }
          />
          <SettingRow
            icon={ShieldAlert}
            title="Offline admits into capped areas"
            description="A hard cap can't be enforced across devices without a connection. When on, these admits are counted on sync and flagged if they went past the cap."
            checked={slice.allowCappedZones}
            onCheckedChange={(v) => setSlice({ ...slice, allowCappedZones: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Before doors open">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <ol className="list-decimal space-y-1 pl-4 text-sm text-text-secondary">
            <li>Open the scanner once on every device while it has signal. That caches the app and the guest list.</li>
            <li>Check each device shows up under Devices with a fresh guest list.</li>
            <li>If the network drops, keep scanning. Queued check-ins sync on their own when it returns; staff can also tap Sync now.</li>
          </ol>
        </div>
      </SectionCard>
    </div>
  );
}

export default OfflineSettings;
