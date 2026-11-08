"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Bell,
  CalendarDays,
  CloudOff,
  Download,
  Handshake,
  HelpCircle,
  Home,
  Inbox,
  Map as MapIcon,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  Play,
  Radio,
  ShoppingBag,
  Ticket,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button, Input, LogoLoading, Textarea, cn } from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { getAppConfig, saveAppConfig } from "@/lib/supabase/app_config";
import { MAX_SHORTCUTS, SHORTCUT_KEYS, normalizeAppConfig } from "@/lib/app_config/model";

// One app for every attendee: this screen decides what it shows for this project's events (events.app_configs).

const APP_SECTIONS = [
  { key: "memberships", label: "Memberships", desc: "Plans, perks and renewals — its own tab.", icon: Award },
  { key: "live", label: "Live rooms", desc: "Livestreams, webinars and breakouts.", icon: Radio },
  { key: "watch", label: "Watch", desc: "Recordings, simulive premieres and replays.", icon: Play },
  { key: "orders", label: "Orders", desc: "Order history, receipts and refund status.", icon: ShoppingBag },
  { key: "community", label: "Group chats", desc: "Event chat channels and polls.", icon: MessagesSquare },
  { key: "qa", label: "Q&A", desc: "Session questions and upvotes.", icon: HelpCircle },
  { key: "messages", label: "Organiser messages", desc: "Attendee ↔ organiser support threads.", icon: MessageSquare },
  { key: "notifications", label: "Updates", desc: "Announcements you send.", icon: Bell },
];

const CONFERENCE_SECTIONS = [
  { key: "agenda", label: "Agenda", desc: "The schedule and each attendee's picks.", icon: CalendarDays },
  { key: "speakers", label: "Speakers", desc: "Speaker profiles and their sessions.", icon: Mic },
  { key: "sponsors", label: "Sponsors", desc: "Sponsors and their resources.", icon: Handshake },
  { key: "map", label: "Map", desc: "Venue map and the expo floor plan.", icon: MapIcon },
  { key: "networking", label: "Networking", desc: "Attendee directory and meeting requests.", icon: Users },
  { key: "discussions", label: "Discussions", desc: "Discussion boards.", icon: MessagesSquare },
];

const SHORTCUT_META = {
  community: { label: "Group chat", icon: MessagesSquare },
  watch: { label: "Watch", icon: Play },
  memberships: { label: "Membership", icon: Award },
  live: { label: "Live", icon: Radio },
  orders: { label: "Orders", icon: ShoppingBag },
  qa: { label: "Q&A", icon: HelpCircle },
};

const PREVIEW_TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "memberships", label: "Memberships", icon: Award },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "more", label: "More", icon: Menu },
];

const THEME_TABS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const ANDROID_FORMAT_TABS = [
  { value: "apk", label: "APK" },
  { value: "aab", label: "AAB" },
];

const IOS_METHOD_TABS = [
  { value: "testflight", label: "TestFlight" },
  { value: "store", label: "App Store" },
];

const SAVE_STATES = {
  saved: { label: "Saved", variant: "success", dotClass: "bg-emerald-400" },
  saving: { label: "Saving…", variant: "neutral", dotClass: "bg-[#737373]" },
  unsaved: { label: "Unsaved", variant: "neutral", dotClass: "bg-[#737373]" },
  error: { label: "Not saved", variant: "warning", dotClass: "bg-amber-400" },
};

const SAVE_DELAY_MS = 600;

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PhonePreview({ config }) {
  const tabs = PREVIEW_TABS.filter((t) => t.key !== "memberships" || config.sections.memberships);
  const shortcuts = config.home.shortcuts.map((key) => ({ key, ...SHORTCUT_META[key] }));

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2.75rem] border-[6px] border-border bg-background">
        <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#2a2a2a]" />
        <div className="space-y-2.5 px-4 pb-4 pt-10">
          <div>
            <p className="text-[10px] text-text-secondary">Good evening,</p>
            <p className="text-lg font-semibold leading-tight text-foreground">Alex</p>
          </div>
          {config.home.welcome ? (
            <div className="rounded-xl border border-border bg-surface-subtle p-3 text-xs text-foreground">
              {config.home.welcome}
            </div>
          ) : null}
          {config.home.liveStrip && config.sections.live ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2.5 text-xs font-medium text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live now — Main Stage
            </div>
          ) : null}
          {shortcuts.length ? (
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-card px-2.5 py-2"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                    <span className="truncate text-[11px] font-medium text-foreground">{s.label}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface-subtle px-2 py-2">
          <div className="flex items-center justify-around">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              const tone = i === 0 ? "text-foreground" : "text-text-tertiary";
              return (
                <div key={t.key} className="flex flex-col items-center gap-1">
                  <Icon className={cn("h-4 w-4", tone)} />
                  <span className={cn("text-[9px] font-medium", tone)}>{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({ label, hint, value, placeholder, onChange }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: value }} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

export function BrandedAppScreen() {
  const projectId = useOptionalProject()?.projectId ?? null;
  // Keyed by project so a project switch shows the loader instead of the previous project's settings.
  const [loaded, setLoaded] = useState({ projectId: undefined, config: null, failed: false });
  const [reloadKey, setReloadKey] = useState(0);
  const [saveState, setSaveState] = useState("saved");
  const configRef = useRef(null);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const userIdRef = useRef(null);
  const inflightRef = useRef(Promise.resolve());
  const activeProjectRef = useRef(projectId);

  const isCurrent = loaded.projectId === projectId;
  const config = isCurrent ? loaded.config : null;
  const loadFailed = isCurrent && loaded.failed;

  useEffect(() => {
    activeProjectRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    Promise.all([getAppConfig(projectId), getUser()]).then(([res, user]) => {
      if (!alive) return;
      userIdRef.current = user?.id ?? null;
      // A failed read must not show the editor, or the first edit would overwrite the stored config with defaults.
      if (!res && projectId) {
        configRef.current = null;
        setLoaded({ projectId, config: null, failed: true });
        return;
      }
      const next = res?.config ?? normalizeAppConfig(null);
      configRef.current = next;
      setLoaded({ projectId, config: next, failed: false });
    });
    return () => {
      alive = false;
    };
  }, [projectId, reloadKey]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next || !projectId) return;
    setSaveState("saving");
    // Chain saves so an older payload can never land after a newer one.
    inflightRef.current = inflightRef.current.then(async () => {
      // Never let a throw leave the chain rejected, or every later save would be skipped.
      try {
        const saved = await saveAppConfig(projectId, next, { userId: userIdRef.current });
        const active = activeProjectRef.current === projectId;
        // A newer edit is queued, or the project changed; neither should touch this status.
        const newerQueued = Boolean(pendingRef.current);
        // Keep a failed payload so the next edit or the unmount flush retries it (same project only).
        if (!saved && active && !newerQueued) pendingRef.current = next;
        if (!active || newerQueued) return;
        setSaveState(saved ? "saved" : "error");
        if (!saved) toast.error("Couldn't save the app settings.");
      } catch {
        if (activeProjectRef.current === projectId && !pendingRef.current) {
          pendingRef.current = next;
          setSaveState("error");
        }
      }
    });
    await inflightRef.current;
  }, [projectId]);

  // Save whatever is still queued when leaving the screen or switching project.
  useEffect(() => () => void flush(), [flush]);

  const update = (change) => {
    const next = change(configRef.current);
    configRef.current = next;
    pendingRef.current = next;
    setLoaded({ projectId, config: next });
    setSaveState("unsaved");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const setSection = (key) => (on) =>
    update((c) => {
      const sections = { ...c.sections, [key]: on };
      return { ...c, sections, home: { ...c.home, shortcuts: c.home.shortcuts.filter((s) => sections[s]) } };
    });
  const setHome = (partial) => update((c) => ({ ...c, home: { ...c.home, ...partial } }));
  const setWhiteLabel = (partial) => update((c) => ({ ...c, whiteLabel: { ...c.whiteLabel, ...partial } }));

  const toggleShortcut = (key) => (on) => {
    const current = configRef.current.home.shortcuts;
    if (on && current.length >= MAX_SHORTCUTS) {
      toast.message(`Home fits ${MAX_SHORTCUTS} shortcuts — turn one off first.`);
      return;
    }
    setHome({ shortcuts: on ? [...current, key] : current.filter((s) => s !== key) });
  };

  const description =
    "One app for every attendee. Choose what it shows for this project's events — changes reach phones the next time the app opens.";

  if (loadFailed) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Branded App" description={description} />
        <EmptyState
          icon={CloudOff}
          title="Couldn't load the app settings"
          description="Your saved settings are untouched. Check your connection and try again."
          action={
            <Button type="button" variant="secondary" onClick={() => {
                // Back to the loader while the retry is in flight.
                setLoaded({ projectId: undefined, config: null, failed: false });
                setReloadKey((k) => k + 1);
              }}>
              Try again
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  if (!config) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Branded App" description={description} />
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading app settings" />
        </div>
      </MainScreenWrapper>
    );
  }

  const wl = config.whiteLabel;
  const shortcutOptions = SHORTCUT_KEYS.filter((key) => config.sections[key]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Branded App"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            {projectId ? <StatusPill status={saveState} map={SAVE_STATES} /> : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadJson(`${wl.slug || "geiger-app"}.app-config.json`, {
                  $schema: "geiger.app-config/v1",
                  ...normalizeAppConfig(config),
                })
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Export config
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="Sections"
            description="Turn off what this project doesn't use. Someone with tickets from several organisers sees a section if any of them leaves it on."
          >
            <SettingsList>
              {APP_SECTIONS.map((s) => (
                <SettingRow
                  key={s.key}
                  icon={s.icon}
                  title={s.label}
                  description={s.desc}
                  checked={config.sections[s.key]}
                  onCheckedChange={setSection(s.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Conference sections"
            description="Saved now; each one appears in the app as it ships."
          >
            <SettingsList>
              {CONFERENCE_SECTIONS.map((s) => (
                <SettingRow
                  key={s.key}
                  icon={s.icon}
                  title={s.label}
                  description={s.desc}
                  checked={config.sections[s.key]}
                  onCheckedChange={setSection(s.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard title="Home screen" description="What attendees see first when they open the app.">
            <div className="space-y-4">
              <Field label="Welcome message" hint="Shown at the top of Home when this is the attendee's only organiser.">
                <Textarea
                  rows={2}
                  maxLength={280}
                  value={config.home.welcome}
                  onChange={(e) => setHome({ welcome: e.target.value })}
                  placeholder="e.g. Doors open at 9 — grab a coffee by the main stage."
                />
              </Field>
              <SettingsList>
                <SettingRow
                  icon={Radio}
                  title="Live strip"
                  description="Rooms that are live right now, pinned under the next event."
                  checked={config.home.liveStrip}
                  onCheckedChange={(on) => setHome({ liveStrip: on })}
                />
                <SettingRow
                  icon={ShoppingBag}
                  title="Recent orders"
                  description="The three latest orders at the bottom of Home."
                  checked={config.home.recentOrders}
                  onCheckedChange={(on) => setHome({ recentOrders: on })}
                />
              </SettingsList>
              <Field label="Shortcuts" hint={`Up to ${MAX_SHORTCUTS}, in the order you turn them on.`}>
                <SettingsList>
                  {shortcutOptions.map((key) => {
                    const meta = SHORTCUT_META[key];
                    const position = config.home.shortcuts.indexOf(key);
                    return (
                      <SettingRow
                        key={key}
                        icon={meta.icon}
                        title={meta.label}
                        description={position >= 0 ? `Shortcut ${position + 1}` : "Not on Home"}
                        checked={position >= 0}
                        onCheckedChange={toggleShortcut(key)}
                      />
                    );
                  })}
                </SettingsList>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="White-label build"
            description="Only used when this organiser gets their own app in the stores. The shared Geiger Events app keeps Geiger's name and look."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="App name" value={wl.appName} placeholder="e.g. Acme Events" onChange={(v) => setWhiteLabel({ appName: v })} />
                <TextField label="Organisation" value={wl.orgName} placeholder="e.g. Acme Organisation" onChange={(v) => setWhiteLabel({ orgName: v })} />
              </div>
              <TextField label="Tagline" value={wl.tagline} placeholder="A short welcome line" onChange={(v) => setWhiteLabel({ tagline: v })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Slug" value={wl.slug} placeholder="acme-events" onChange={(v) => setWhiteLabel({ slug: v })} />
                <TextField label="Deep-link scheme" hint="e.g. acmeevents://tickets/123." value={wl.scheme} placeholder="acmeevents" onChange={(v) => setWhiteLabel({ scheme: v })} />
                <TextField label="iOS bundle id" value={wl.iosBundleId} placeholder="com.acme.events" onChange={(v) => setWhiteLabel({ iosBundleId: v })} />
                <TextField label="Android package" value={wl.androidPackage} placeholder="com.acme.events" onChange={(v) => setWhiteLabel({ androidPackage: v })} />
                <TextField label="Version" value={wl.version} placeholder="1.0.0" onChange={(v) => setWhiteLabel({ version: v })} />
                <TextField label="EAS project id" value={wl.easProjectId} placeholder="xxxxxxxx-xxxx-…" onChange={(v) => setWhiteLabel({ easProjectId: v })} />
              </div>
              <Field label="Appearance">
                <SegmentedTabs tabs={THEME_TABS} value={wl.themeMode} onChange={(v) => setWhiteLabel({ themeMode: v })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Accent" value={wl.accent} onChange={(v) => setWhiteLabel({ accent: v })} />
                <ColorField label="Background" value={wl.background} onChange={(v) => setWhiteLabel({ background: v })} />
                <ColorField label="Card" value={wl.card} onChange={(v) => setWhiteLabel({ card: v })} />
                <ColorField label="Active tab" value={wl.primary} onChange={(v) => setWhiteLabel({ primary: v })} />
                <ColorField label="Splash background" value={wl.splashBackground} onChange={(v) => setWhiteLabel({ splashBackground: v })} />
                <TextField label="Splash message" value={wl.splashMessage} placeholder="Shown on first launch…" onChange={(v) => setWhiteLabel({ splashMessage: v })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Android artifact">
                  <SegmentedTabs tabs={ANDROID_FORMAT_TABS} value={wl.androidFormat} onChange={(v) => setWhiteLabel({ androidFormat: v })} />
                </Field>
                <Field label="iOS distribution">
                  <SegmentedTabs tabs={IOS_METHOD_TABS} value={wl.iosMethod} onChange={(v) => setWhiteLabel({ iosMethod: v })} />
                </Field>
                <TextField label="Google Play / APK link" value={wl.androidUrl} placeholder="https://play.google.com/…" onChange={(v) => setWhiteLabel({ androidUrl: v })} />
                <TextField label="App Store / TestFlight link" value={wl.iosUrl} placeholder="https://apps.apple.com/…" onChange={(v) => setWhiteLabel({ iosUrl: v })} />
              </div>
              <Field label="Release notes">
                <Textarea
                  rows={2}
                  value={wl.releaseNotes}
                  onChange={(e) => setWhiteLabel({ releaseNotes: e.target.value })}
                  placeholder="What's new in this build…"
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-0">
            <p className="mb-3 text-center text-xs font-medium text-text-secondary">Preview</p>
            <PhonePreview config={config} />
          </div>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default BrandedAppScreen;
