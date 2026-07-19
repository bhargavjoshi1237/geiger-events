"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  Check,
  Handshake,
  Loader2,
  Map as MapIcon,
  Mic,
  Radio,
  Smartphone,
  Users,
  Wifi,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button, Input, Textarea, cn } from "@geiger/ui";
import { ChipsInput } from "@/components/internal/shared/records/record_fields";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { conferenceApi } from "@/lib/supabase/conference";

// Mobile Event App — a project-level singleton (module "mobile_app", one record
// per project) that configures the attendee app and previews it live in a phone
// mockup. The accent is user data applied via inline style (not a theme token).
// Edits are optimistic: toggles/chips save immediately, text fields on blur.

const MODULE = "mobile_app";

// The tabs the attendee app can surface, each an on/off switch. `icon` is used in
// both the config list and the phone preview's bottom bar.
const TABS = [
  { key: "agenda", label: "Agenda", desc: "The full schedule and each attendee's picks.", icon: CalendarDays },
  { key: "speakers", label: "Speakers", desc: "Speaker profiles, bios, and their sessions.", icon: Mic },
  { key: "maps", label: "Maps", desc: "Venue maps and the exhibitor floor plan.", icon: MapIcon },
  { key: "networking", label: "Networking", desc: "Attendee directory and meeting requests.", icon: Users },
  { key: "sponsors", label: "Sponsors", desc: "Sponsor rooms, booths, and resources.", icon: Handshake },
  { key: "live", label: "Live", desc: "Livestreams, webinars, and simulive premieres.", icon: Radio },
  { key: "notifications", label: "Notifications", desc: "Push alerts for reminders and updates.", icon: Bell },
];

const ACCENTS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
];

const DEFAULT_CONFIG = {
  appName: "Event App",
  tagline: "Everything you need, in your pocket.",
  accent: "#6366f1",
  tabs: { agenda: true, speakers: true, maps: true, networking: false, sponsors: true, live: true, notifications: true },
  homeCards: ["Up next on the Main Stage", "Your saved sessions", "Explore sponsors"],
  splashMessage: "Welcome! Tap Agenda to plan your day.",
  published: false,
  iosUrl: "",
  androidUrl: "",
};

// Populated config for the landing playground — a published, branded app so the
// phone preview reads as a real product rather than an empty default.
const DEMO_CONFIG = {
  ...DEFAULT_CONFIG,
  appName: "DevCon 2026",
  tagline: "Your whole conference, in your pocket.",
  accent: "#8b5cf6",
  tabs: { agenda: true, speakers: true, maps: true, networking: true, sponsors: true, live: true, notifications: true },
  homeCards: ["Keynote starts in 20 min", "Your saved sessions", "Meet other attendees", "Explore sponsors"],
  splashMessage: "Welcome to DevCon! Tap Agenda to plan your day.",
  published: true,
};

// --- Phone preview -----------------------------------------------------------

function PhonePreview({ config }) {
  const accent = config.accent || "#6366f1";
  const enabledTabs = TABS.filter((t) => config.tabs?.[t.key]);
  // The bottom bar shows at most four tabs (as a real app would).
  const barTabs = enabledTabs.slice(0, 4);
  const cards = (config.homeCards || []).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2.75rem] border-[6px] border-[#2a2a2a] bg-background shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#2a2a2a]" />

        {/* Header */}
        <div className="px-5 pb-4 pt-9 text-white" style={{ background: `linear-gradient(160deg, ${accent}, ${accent}cc)` }}>
          <p className="text-[10px] font-medium uppercase tracking-widest opacity-80">
            {config.published ? "Live" : "Preview"}
          </p>
          <h3 className="mt-0.5 truncate text-lg font-bold leading-tight">
            {config.appName || "Event App"}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs opacity-90">{config.tagline}</p>
        </div>

        {/* Body */}
        <div className="space-y-2.5 px-4 py-4">
          {config.splashMessage ? (
            <div
              className="rounded-xl border p-3 text-xs font-medium"
              style={{ borderColor: `${accent}55`, background: `${accent}18`, color: "#fff" }}
            >
              {config.splashMessage}
            </div>
          ) : null}

          {cards.length ? (
            cards.slice(0, 4).map((card, i) => (
              <div
                key={`${card}-${i}`}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-card px-3 py-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: accent }}
                >
                  <Wifi className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-xs font-medium text-foreground">{card}</span>
              </div>
            ))
          ) : (
            <p className="px-1 py-4 text-center text-[11px] text-text-tertiary">
              Add home cards to fill the app&apos;s home screen.
            </p>
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface-subtle/95 px-2 py-2 backdrop-blur">
          {barTabs.length ? (
            <div className="flex items-center justify-around">
              {barTabs.map((t, i) => {
                const Icon = t.icon;
                const first = i === 0;
                return (
                  <div key={t.key} className="flex flex-col items-center gap-1">
                    <Icon className="h-4 w-4" style={first ? { color: accent } : { color: "#737373" }} />
                    <span
                      className="text-[9px] font-medium"
                      style={first ? { color: accent } : { color: "#737373" }}
                    >
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-1 text-center text-[10px] text-text-tertiary">No tabs enabled</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Screen ------------------------------------------------------------------

// `demo` seeds a populated app config and skips the fetch/create so the phone
// preview runs as a live playground on the public landing (no session there).
export function MobileAppScreen({ demo = false }) {
  const projectId = useOptionalProject()?.projectId ?? null;
  const [recordId, setRecordId] = useState(null);
  const [config, setConfig] = useState(demo ? DEMO_CONFIG : DEFAULT_CONFIG);
  const [loading, setLoading] = useState(!demo);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    Promise.all([conferenceApi.list(projectId, MODULE), getUser()]).then(([rows, user]) => {
      if (!alive) return;
      const uid = user?.id || null;
      setUserId(uid);
      if (rows && rows.length) {
        const rec = rows[0];
        setRecordId(rec.id);
        setConfig({ ...DEFAULT_CONFIG, ...rec.config, tabs: { ...DEFAULT_CONFIG.tabs, ...(rec.config?.tabs || {}) } });
      } else if (rows) {
        // Configured DB with no record yet — create the singleton.
        const id = crypto.randomUUID();
        setRecordId(id);
        conferenceApi
          .create({
            id,
            module: MODULE,
            name: "Mobile Event App",
            status: "Draft",
            coverUrl: "",
            config: DEFAULT_CONFIG,
            createdBy: uid,
            projectId,
          })
          .then((saved) => {
            if (saved && alive) setRecordId(saved.id);
          });
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, demo]);

  // Merge a patch into the config, update local state, and (optionally) persist.
  const commit = (partial, { save = true } = {}) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      if (save && recordId) {
        conferenceApi.update(recordId, { config: next }).then((ok) => {
          if (!ok) toast.error("Couldn't save your changes.");
        });
      }
      return next;
    });
  };

  const setTab = (key) => (on) =>
    commit({ tabs: { ...config.tabs, [key]: on } });

  const enabledCount = useMemo(
    () => TABS.filter((t) => config.tabs?.[t.key]).length,
    [config.tabs],
  );

  if (loading) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Mobile Event App" description="Configure the attendee app and preview it live." />
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading app config…
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Mobile Event App"
        description="Configure the attendee mobile app — its identity, which tabs appear, the home screen, and store links — and preview it live."
        actions={
          <StatusPill
            status={config.published ? "Published" : "Draft"}
            map={{
              Published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
              Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
            }}
          />
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Config */}
        <div className="min-w-0 space-y-6">
          <SectionCard title="App identity" description="The name, tagline, and accent colour attendees see.">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="App name">
                  <Input
                    value={config.appName}
                    onChange={(e) => commit({ appName: e.target.value }, { save: false })}
                    onBlur={() => commit({}, { save: true })}
                    placeholder="e.g. DevCon 2026"
                  />
                </Field>
                <Field label="Tagline">
                  <Input
                    value={config.tagline}
                    onChange={(e) => commit({ tagline: e.target.value }, { save: false })}
                    onBlur={() => commit({}, { save: true })}
                    placeholder="A short welcome line"
                  />
                </Field>
              </div>
              <Field label="Accent colour">
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => {
                    const on = config.accent === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => commit({ accent: a.value })}
                        aria-label={a.name}
                        title={a.name}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                          on ? "border-white" : "border-transparent",
                        )}
                        style={{ background: a.value }}
                      >
                        {on ? <Check className="h-4 w-4 text-white" /> : null}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Navigation tabs"
            description={`Choose which sections appear in the app. ${enabledCount} enabled — the first four fill the bottom bar.`}
          >
            <SettingsList>
              {TABS.map((t) => (
                <SettingRow
                  key={t.key}
                  icon={t.icon}
                  title={t.label}
                  description={t.desc}
                  checked={Boolean(config.tabs?.[t.key])}
                  onCheckedChange={setTab(t.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard title="Home screen" description="The welcome message and the quick cards on the app's home tab.">
            <div className="space-y-4">
              <Field label="Welcome message">
                <Textarea
                  rows={2}
                  value={config.splashMessage}
                  onChange={(e) => commit({ splashMessage: e.target.value }, { save: false })}
                  onBlur={() => commit({}, { save: true })}
                  placeholder="Shown at the top of the home screen…"
                />
              </Field>
              <Field label="Home cards" hint="Quick shortcuts shown on the home screen.">
                <ChipsInput
                  value={config.homeCards}
                  onChange={(v) => commit({ homeCards: v })}
                  placeholder="Add a home card…"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Publish" description="Make the app available and link to the app stores.">
            <div className="space-y-4">
              <SettingsList>
                <SettingRow
                  icon={Smartphone}
                  title="Published"
                  description="Turn the app live for attendees."
                  checked={Boolean(config.published)}
                  onCheckedChange={(on) => commit({ published: on })}
                />
              </SettingsList>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="App Store link">
                  <Input
                    value={config.iosUrl}
                    onChange={(e) => commit({ iosUrl: e.target.value }, { save: false })}
                    onBlur={() => commit({}, { save: true })}
                    placeholder="https://apps.apple.com/…"
                  />
                </Field>
                <Field label="Google Play link">
                  <Input
                    value={config.androidUrl}
                    onChange={(e) => commit({ androidUrl: e.target.value }, { save: false })}
                    onBlur={() => commit({}, { save: true })}
                    placeholder="https://play.google.com/…"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Live preview */}
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-0">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Live preview
            </p>
            <PhonePreview config={config} />
          </div>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default MobileAppScreen;
