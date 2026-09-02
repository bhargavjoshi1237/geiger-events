"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Info, Plus, X, ArrowRight } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getCheckinSettings } from "@/lib/supabase/checkin";
import { useEventConfig } from "@/lib/events/use-event-config";
import { newId } from "./sample_data";
import { EventDatePicker, EventTimeField } from "./date_time_fields";
import { withDefaults } from "../checkin/constants";

function useCheckinGlobals() {
  const { projectId } = useProject();
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let alive = true;
    getCheckinSettings(projectId).then((res) => {
      if (alive) setConfig(res?.config || {});
    });
    return () => {
      alive = false;
    };
  }, [projectId]);
  return config;
}

function GlobalOffHint({ feature }) {
  const { setTab } = useWorkspaceUrl();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
      <Info className="h-4 w-4 shrink-0 text-text-tertiary" />
      <p className="min-w-0 flex-1 text-sm text-text-secondary">
        Turn on <span className="font-medium text-foreground">{feature}</span> for
        the whole project first — under the Check-in sidebar — then enable it here
        for this event.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setTab(feature)}
        className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
      >
        Open {feature}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CheckinOptionsSection({ event, headerItem }) {
  const globals = useCheckinGlobals();
  const [cfg, , save] = useEventConfig(event, "checkin", {
    qrOnTicket: true,
    selfCheckin: false,
    methods: { qr: true, manual: true },
  });

  const selfOn = globals ? withDefaults(globals, "selfCheckin").enabled : false;

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Check-in options"}
        description={headerItem?.desc || "How attendees get in at this event."}
      />

      <SectionCard title="Tickets" description="What each ticket carries for entry.">
        <SettingsList>
          <SettingRow
            title="Include QR code on tickets"
            description="Print a scannable QR on this event's tickets. Style it under QR Tickets."
            checked={!!cfg.qrOnTicket}
            onCheckedChange={(v) =>
              save({ ...cfg, qrOnTicket: v }, { successMsg: "Saved." })
            }
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Admission" description="How staff and attendees check in on the day.">
        <SettingsList>
          <SettingRow
            title="Self check-in"
            description={
              selfOn
                ? "Let attendees scan their own QR to admit themselves."
                : "Requires Self Check-in enabled for the project."
            }
            checked={!!cfg.selfCheckin && selfOn}
            control={selfOn ? undefined : <DisabledSwitch />}
            onCheckedChange={
              selfOn
                ? (v) => save({ ...cfg, selfCheckin: v }, { successMsg: "Saved." })
                : undefined
            }
          />
          <SettingRow
            title="QR scan (staff)"
            checked={!!cfg.methods?.qr}
            onCheckedChange={(v) =>
              save(
                { ...cfg, methods: { ...cfg.methods, qr: v } },
                { successMsg: "Saved." },
              )
            }
          />
          <SettingRow
            title="Manual entry (staff)"
            checked={!!cfg.methods?.manual}
            onCheckedChange={(v) =>
              save(
                { ...cfg, methods: { ...cfg.methods, manual: v } },
                { successMsg: "Saved." },
              )
            }
          />
        </SettingsList>
      </SectionCard>
    </div>
  );
}

function DisabledSwitch() {
  return <Switch checked={false} disabled />;
}

// Per-event gate/zone CRUD: create new ones for this event, flip them on/off,
// or remove them. Also lets staff pull in a name already used elsewhere on the
// project so scanning-role scopes (which read the project catalog) still line up.
function GateZoneManager({ placeholder, items, catalog, onChange, emptyHint }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    onChange([...(items || []), { id: newId(), name, enabled: true }]);
    setDraft("");
  };
  const remove = (id) => onChange((items || []).filter((x) => x.id !== id));
  const toggle = (id, enabled) =>
    onChange((items || []).map((x) => (x.id === id ? { ...x, enabled } : x)));
  const addFromCatalog = (opt) => {
    if ((items || []).some((x) => x.id === opt.id)) return;
    onChange([...(items || []), { id: opt.id, name: opt.name, enabled: true }]);
  };

  const availableCatalog = (catalog || []).filter(
    (opt) => !(items || []).some((x) => x.id === opt.id),
  );

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
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.name}</span>
              <Switch checked={it.enabled !== false} onCheckedChange={(v) => toggle(it.id, v)} />
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
                onClick={() => remove(it.id)}
                className="text-text-tertiary transition-colors hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">{emptyHint}</p>
      )}

      {availableCatalog.length ? (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs text-text-tertiary">From the project catalog</p>
          <div className="flex flex-wrap gap-2">
            {availableCatalog.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => addFromCatalog(opt)}
                className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-text-secondary transition-colors hover:border-primary hover:text-foreground"
              >
                + {opt.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GatesZonesSection({ event, headerItem }) {
  const globals = useCheckinGlobals();
  const [cfg, setCfg, save, saving] = useEventConfig(event, "checkinGates", {
    gates: [],
    zones: [],
  });

  if (globals === null) return <SectionLoading />;
  const mg = withDefaults(globals, "multiGate");
  if (!mg.enabled) {
    return (
      <div className="space-y-6">
        <EditorSectionHeader title={headerItem?.label || "Multi-gate & Zones"} description={headerItem?.desc} />
        <GlobalOffHint feature="Multi-gate & Zones" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Multi-gate & Zones"}
        description={headerItem?.desc || "Create the entrances and restricted areas for this event, turn them on or off, or remove them."}
      />
      <SectionCard
        title="Gates & zones"
        description="These apply to this event only."
        action={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => save(undefined, { successMsg: "Saved." })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Gates</p>
            <GateZoneManager
              placeholder="e.g. North entrance"
              items={cfg.gates}
              catalog={mg.gates}
              onChange={(gates) => setCfg({ ...cfg, gates })}
              emptyHint="No gates yet."
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Zones</p>
            <GateZoneManager
              placeholder="e.g. Backstage"
              items={cfg.zones}
              catalog={mg.zones}
              onChange={(zones) => setCfg({ ...cfg, zones })}
              emptyHint="No zones yet."
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function SessionsSection({ event, headerItem }) {
  const globals = useCheckinGlobals();
  const [cfg, setCfg, save, saving] = useEventConfig(event, "checkinSessions", {
    sessions: [],
  });
  const [draft, setDraft] = useState("");

  if (globals === null) return <SectionLoading />;
  const on = withDefaults(globals, "session").enabled;
  if (!on) {
    return (
      <div className="space-y-6">
        <EditorSectionHeader title={headerItem?.label || "Sessions"} description={headerItem?.desc} />
        <GlobalOffHint feature="Session Check-in" />
      </div>
    );
  }

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    setCfg({ ...cfg, sessions: [...(cfg.sessions || []), { id: newId(), name, startsAt: "" }] });
    setDraft("");
  };
  const remove = (id) =>
    setCfg({ ...cfg, sessions: (cfg.sessions || []).filter((s) => s.id !== id) });
  const setTime = (id, startsAt) =>
    setCfg({
      ...cfg,
      sessions: (cfg.sessions || []).map((s) => (s.id === id ? { ...s, startsAt } : s)),
    });
  const splitDateTime = (v) => {
    if (!v) return ["", ""];
    const [date, time = ""] = String(v).split("T");
    return [date || "", time];
  };
  const joinDateTime = (date, time) =>
    [date, time].filter(Boolean).join("T");

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Sessions"}
        description={headerItem?.desc || "Break this event into sessions staff can check attendees into separately."}
      />
      <SectionCard
        title="Sessions"
        description="Each session gets its own live count in Real-time Attendance."
        action={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => save(undefined, { successMsg: "Sessions saved." })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="e.g. Morning keynote"
            />
            <Button
              variant="outline"
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={add}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {cfg.sessions?.length ? (
            <div className="space-y-2">
              {cfg.sessions.map((s) => {
                const [sessionDate, sessionTime] = splitDateTime(s.startsAt || "");
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="w-[9.5rem]">
                        <EventDatePicker
                          value={sessionDate}
                          onChange={(date) => setTime(s.id, joinDateTime(date, sessionTime))}
                          placeholder="Session date"
                        />
                      </div>
                      <div className="w-36">
                        <EventTimeField
                          value={sessionTime}
                          onChange={(time) => setTime(s.id, joinDateTime(sessionDate, time))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => remove(s.id)}
                      className="text-text-tertiary transition-colors hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No sessions yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function DoorKioskSection({ event, headerItem }) {
  const globals = useCheckinGlobals();
  const [cfg, , save] = useEventConfig(event, "checkinDoorKiosk", {
    doorSales: false,
    kiosk: false,
    rfid: false,
  });

  if (globals === null) return <SectionLoading />;
  const doorOn = withDefaults(globals, "doorSales").enabled;
  const kioskOn = withDefaults(globals, "kiosk").enabled;
  const rfidOn = withDefaults(globals, "rfid").enabled;

  const gatedRow = (key, on, title, feature) => (
    <SettingRow
      title={title}
      description={on ? `Enable ${title.toLowerCase()} for this event.` : `Requires ${feature} enabled for the project.`}
      checked={!!cfg[key] && on}
      control={on ? undefined : <DisabledSwitch />}
      onCheckedChange={on ? (v) => save({ ...cfg, [key]: v }, { successMsg: "Saved." }) : undefined}
    />
  );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Door Sales & Kiosk"}
        description={headerItem?.desc || "On-site sales, self-service kiosk, and tap-to-enter for this event."}
      />
      <SectionCard title="On-site" description="Point-of-entry features for this event.">
        <SettingsList>
          {gatedRow("doorSales", doorOn, "Door sales", "Door Sales")}
          {gatedRow("kiosk", kioskOn, "Kiosk mode", "Kiosk Mode")}
          {gatedRow("rfid", rfidOn, "RFID / NFC entry", "RFID / NFC")}
        </SettingsList>
      </SectionCard>
    </div>
  );
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}
