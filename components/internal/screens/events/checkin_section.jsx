"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Info, Plus, X } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { getCheckinSettings } from "@/lib/supabase/checkin";
import { useEventConfig } from "@/lib/events/use-event-config";
import { newId } from "./sample_data";
import { withDefaults } from "../checkin/constants";

// Per-event Check-in config lives in independent metadata keys (like guidelines
// / dietaryRequests) so each section's save never clobbers another's:
//   checkin           → { qrOnTicket, walletPass, selfCheckin, methods }
//   checkinGates      → { gates: [id], zones: [id] }
//   checkinSessions   → { sessions: [{ id, name, startsAt }] }
//   checkinDoorKiosk  → { doorSales, kiosk, rfid }
// Each per-event toggle is gated on the matching GLOBAL feature being enabled
// (checkin_settings), configured under the Check-in sidebar screens.

// The project's global check-in settings (null while loading).
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

// A note shown when a feature is off globally.
function GlobalOffHint({ feature }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
      <p className="text-sm text-text-secondary">
        Turn on <span className="font-medium text-foreground">{feature}</span> for
        the whole project first — under the Check-in sidebar — then enable it here
        for this event.
      </p>
    </div>
  );
}

// --- Check-in options --------------------------------------------------------

export function CheckinOptionsSection({ event, headerItem }) {
  const globals = useCheckinGlobals();
  const [cfg, , save] = useEventConfig(event, "checkin", {
    qrOnTicket: true,
    walletPass: false,
    selfCheckin: false,
    methods: { qr: true, manual: true },
  });

  const walletOn = globals ? withDefaults(globals, "walletPasses").enabled : false;
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
          <SettingRow
            title="Wallet pass"
            description={
              walletOn
                ? "Offer Apple/Google Wallet passes for this event."
                : "Requires Wallet Passes enabled for the project."
            }
            checked={!!cfg.walletPass && walletOn}
            control={walletOn ? undefined : <DisabledSwitch />}
            onCheckedChange={
              walletOn
                ? (v) => save({ ...cfg, walletPass: v }, { successMsg: "Saved." })
                : undefined
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

// A read-only, off-looking switch stand-in for gated rows.
function DisabledSwitch() {
  return (
    <span className="inline-flex h-5 w-9 items-center rounded-full border border-border bg-surface-strong opacity-50">
      <span className="ml-0.5 h-4 w-4 rounded-full bg-text-tertiary" />
    </span>
  );
}

// --- Gates & Zones -----------------------------------------------------------

function ChipToggle({ options, selectedIds, onToggle, emptyHint }) {
  if (!options.length) return <p className="text-xs text-text-tertiary">{emptyHint}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selectedIds.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              on
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-surface-card text-text-secondary hover:text-foreground",
            )}
          >
            {o.name}
          </button>
        );
      })}
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
        <EditorSectionHeader title={headerItem?.label || "Gates & Zones"} description={headerItem?.desc} />
        <GlobalOffHint feature="Multi-gate & Zones" />
      </div>
    );
  }

  // Store the full { id, name } so the anonymous staff routes (which can't read
  // the member-only global gate/zone names) can render pickers from the event.
  const toggle = (key, opt) => {
    const has = (cfg[key] || []).some((x) => x.id === opt.id);
    setCfg({
      ...cfg,
      [key]: has
        ? cfg[key].filter((x) => x.id !== opt.id)
        : [...(cfg[key] || []), { id: opt.id, name: opt.name }],
    });
  };
  const idsOf = (arr) => (arr || []).map((x) => x.id);

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Gates & Zones"}
        description={headerItem?.desc || "Which entrances and restricted areas apply to this event."}
      />
      <SectionCard
        title="Assigned gates & zones"
        description="Pick from the gates and zones defined under Multi-gate & Zones."
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
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Gates</p>
            <ChipToggle
              options={mg.gates || []}
              selectedIds={idsOf(cfg.gates)}
              onToggle={(opt) => toggle("gates", opt)}
              emptyHint="No gates defined yet."
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Zones</p>
            <ChipToggle
              options={mg.zones || []}
              selectedIds={idsOf(cfg.zones)}
              onToggle={(opt) => toggle("zones", opt)}
              emptyHint="No zones defined yet."
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Sessions ----------------------------------------------------------------

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
              {cfg.sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.name}</span>
                  <Input
                    type="datetime-local"
                    value={s.startsAt || ""}
                    onChange={(e) => setTime(s.id, e.target.value)}
                    className="h-8 w-52 bg-surface-subtle"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => remove(s.id)}
                    className="text-text-tertiary transition-colors hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No sessions yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// --- Door Sales & Kiosk ------------------------------------------------------

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
