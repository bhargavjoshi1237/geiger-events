"use client";

import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Bell,
  Check,
  Copy,
  Download,
  Home,
  Image as ImageIcon,
  Inbox,
  Menu,
  MessageSquare,
  MessagesSquare,
  Palette,
  Play,
  QrCode,
  Radio,
  ShoppingBag,
  Smartphone,
  Ticket,
  Upload,
  User,
  HelpCircle,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button, Input, Textarea, cn } from "@geiger/ui";
import { ChipsInput } from "@/components/internal/shared/records/record_fields";

// Frontend-only customiser for the organiser's white-label members app.
// TODO(backend): persist `config` per project (e.g. events.branded_app_configs)
// and pipe it into mobile/: app.json (identity), src/theme/tokens.ts (colours),
// src/app/(app)/_layout.tsx (tabs), home/more screens (sections), EAS builds.
const ACCENTS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "White", value: "#ffffff" },
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

// Bottom-bar tabs in mobile/src/components/TabBar.tsx (TAB_ORDER).
const APP_TABS = [
  { key: "home", label: "Home", desc: "Event feed, live strip and upcoming tickets.", icon: Home },
  { key: "tickets", label: "Tickets", desc: "Purchased tickets and QR passes (/pass/[id]).", icon: Ticket },
  { key: "memberships", label: "Memberships", desc: "Plans, benefits and member status.", icon: Award },
  { key: "inbox", label: "Inbox", desc: "Organiser threads, announcements, chats and Q&A.", icon: Inbox },
  { key: "more", label: "More", desc: "Overflow menu hosting Orders, Watch, Account…", icon: Menu },
];

// Hidden routes in mobile/src/app/(app)/_layout.tsx surfaced via More/Home.
const APP_FEATURES = [
  { key: "live", label: "Live rooms", desc: "Join livestreams, webinars and breakouts.", icon: Radio },
  { key: "watch", label: "Watch", desc: "Recordings, simulive premieres and replays.", icon: Play },
  { key: "community", label: "Community", desc: "Event chat, polls, surveys and discussion boards.", icon: MessagesSquare },
  { key: "orders", label: "Orders", desc: "Order history, receipts and refund status.", icon: ShoppingBag },
  { key: "messages", label: "Support threads", desc: "Buyer ↔ organiser conversations about tickets.", icon: MessageSquare },
  { key: "notifications", label: "Notifications", desc: "Push inbox for reminders and announcements.", icon: Bell },
  { key: "account", label: "Account", desc: "Profile, devices, sign-out and data controls.", icon: User },
  { key: "qa", label: "Q&A", desc: "Session questions and upvotes.", icon: HelpCircle },
];

const DEFAULT_CONFIG = {
  appName: "Acme Events",
  orgName: "Acme Organisation",
  tagline: "All our events, in your pocket.",
  slug: "acme-events",
  scheme: "acmeevents",
  version: "1.0.0",
  iosBundleId: "studio.geiger.events",
  androidPackage: "studio.geiger.events",
  themeMode: "dark",
  accent: "#6366f1",
  background: "#161616",
  card: "#202020",
  primary: "#ffffff",
  splashBackground: "#161616",
  splashMessage: "Welcome! Your tickets live here.",
  logoUrl: "",
  iconUrl: "",
  splashUrl: "",
  tabs: { home: true, tickets: true, memberships: true, inbox: true, more: true },
  features: {
    live: true,
    watch: true,
    community: true,
    orders: true,
    messages: true,
    notifications: true,
    account: true,
    qa: false,
  },
  home: { showLiveStrip: true, showUpcoming: true, showMemberships: true },
  homeCards: ["This weekend near you", "Your upcoming tickets", "New membership perks"],
  auth: { emailOtp: true, apple: true, google: true, guestBrowsing: false, requireLogin: true },
  push: { pushEnabled: true, reminders: true, announcements: true, liveAlerts: true, marketing: false },
  build: {
    easProjectId: "",
    androidFormat: "apk",
    iosMethod: "testflight",
    releaseNotes: "",
    androidUrl: "",
    iosUrl: "",
  },
  published: false,
};

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
  const accent = config.accent || "#6366f1";
  const bg = config.background || "#161616";
  const card = config.card || "#202020";
  const enabledTabs = APP_TABS.filter((t) => config.tabs?.[t.key]);
  const barTabs = enabledTabs.slice(0, 5);
  const cards = (config.homeCards || []).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div
        className="relative aspect-[9/19] w-full overflow-hidden rounded-[2.75rem] border-[6px] border-border shadow-2xl"
        style={{ background: bg }}
      >
        <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#2a2a2a]" />
        <div
          className="px-5 pb-4 pt-9 text-white"
          style={{ background: `linear-gradient(160deg, ${accent}, ${accent}cc)` }}
        >
          <p className="text-[10px] font-medium uppercase tracking-widest opacity-80">
            {config.published ? "Live" : "Preview"}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
            ) : null}
            <h3 className="truncate text-lg font-bold leading-tight">
              {config.appName || "Event App"}
            </h3>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs opacity-90">{config.tagline}</p>
        </div>

        <div className="space-y-2.5 px-4 py-4">
          {config.splashMessage ? (
            <div
              className="rounded-xl border p-3 text-xs font-medium"
              style={{ borderColor: `${accent}55`, background: `${accent}18`, color: "#fff" }}
            >
              {config.splashMessage}
            </div>
          ) : null}
          {config.home?.showLiveStrip ? (
            <div
              className="rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-foreground"
              style={{ background: card }}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
              Live now — Main Stage
            </div>
          ) : null}
          {cards.length ? (
            cards.slice(0, 3).map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5"
                style={{ background: card }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: accent }}
                >
                  <Ticket className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-xs font-medium text-foreground">{c}</span>
              </div>
            ))
          ) : (
            <p className="px-1 py-4 text-center text-[11px] text-text-tertiary">
              Add home cards to fill the home tab.
            </p>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface-subtle/95 px-2 py-2 backdrop-blur">
          {barTabs.length ? (
            <div className="flex items-center justify-around">
              {barTabs.map((t, i) => {
                const Icon = t.icon;
                const first = i === 0;
                return (
                  <div key={t.key} className="flex flex-col items-center gap-1">
                    <Icon
                      className={cn("h-4 w-4", !first && "text-text-tertiary")}
                      style={first ? { color: accent } : undefined}
                    />
                    <span
                      className={cn("text-[9px] font-medium", !first && "text-text-tertiary")}
                      style={first ? { color: accent } : undefined}
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

function UploadTile({ label, hint, preview, onFile, onClear }) {
  const inputRef = useRef(null);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`Upload ${label}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-card transition-colors hover:border-white/40"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-text-tertiary" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
          </Button>
          {preview ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function BrandedAppScreen() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [buildState, setBuildState] = useState("ready");

  const patch = (partial) => setConfig((prev) => ({ ...prev, ...partial }));
  const setTab = (key) => (on) => patch({ tabs: { ...config.tabs, [key]: on } });
  const setFeature = (key) => (on) => patch({ features: { ...config.features, [key]: on } });
  const setHome = (key) => (on) => patch({ home: { ...config.home, [key]: on } });
  const setAuth = (key) => (on) => patch({ auth: { ...config.auth, [key]: on } });
  const setPush = (key) => (on) => patch({ push: { ...config.push, [key]: on } });
  const setBuild = (partial) =>
    patch({ build: { ...config.build, ...partial } });

  const enabledTabs = useMemo(
    () => APP_TABS.filter((t) => config.tabs?.[t.key]).length,
    [config.tabs],
  );
  const ready = config.appName.trim().length > 1 && enabledTabs >= 2;

  const onFile = (key) => (file) => {
    const url = URL.createObjectURL(file);
    patch({ [key]: url });
    toast.success("Preview updated — file upload wires to storage next.");
  };

  const copy = async (value, label) => {
    if (!value) {
      toast.error(`No ${label} yet — paste one above first.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  const exportConfig = () =>
    downloadJson(
      `${config.slug || "branded-app"}.app-config.json`,
      { $schema: "geiger.branded-app/v1", ...config },
    );

  const requestBuild = () => {
    if (buildState === "building") return;
    setBuildState("building");
    toast.message("Build requested — EAS pipeline wires up next.");
    setTimeout(() => {
      setBuildState("ready");
      toast.success("Preview build ready (simulated — connect EAS for real binaries).");
    }, 2500);
  };

  const downloadBinary = (platform) => {
    const url = platform === "android" ? config.build.androidUrl : config.build.iosUrl;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    exportConfig();
    toast.message(
      "No binary linked yet — exported the app config JSON instead. Connect the EAS build to enable direct downloads.",
    );
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Branded App"
        description="White-label the members app for this organiser — identity, theme, tabs, home, sign-in and installs. Frontend only for now; the mobile wiring comes next."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill
              status={ready ? "Ready" : "Draft"}
              map={{
                Ready: { label: "Ready", variant: "success", dotClass: "bg-emerald-400" },
                Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
              }}
            />
            <Button type="button" variant="secondary" onClick={exportConfig}>
              <Download className="mr-1.5 h-4 w-4" /> Export config
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="App identity"
            description="Maps to mobile/app.json — name, slug, scheme, bundle ids and version."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="App name">
                  <Input
                    value={config.appName}
                    onChange={(e) => patch({ appName: e.target.value })}
                    placeholder="e.g. Acme Events"
                  />
                </Field>
                <Field label="Organisation">
                  <Input
                    value={config.orgName}
                    onChange={(e) => patch({ orgName: e.target.value })}
                    placeholder="e.g. Acme Organisation"
                  />
                </Field>
              </div>
              <Field label="Tagline" hint="Shown under the app name on the home header.">
                <Input
                  value={config.tagline}
                  onChange={(e) => patch({ tagline: e.target.value })}
                  placeholder="A short welcome line"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug" hint="app.json slug + config filename.">
                  <Input
                    value={config.slug}
                    onChange={(e) => patch({ slug: e.target.value })}
                    placeholder="acme-events"
                  />
                </Field>
                <Field label="Deep-link scheme" hint="e.g. acmeevents://tickets/123.">
                  <Input
                    value={config.scheme}
                    onChange={(e) => patch({ scheme: e.target.value })}
                    placeholder="acmeevents"
                  />
                </Field>
                <Field label="iOS bundle id">
                  <Input
                    value={config.iosBundleId}
                    onChange={(e) => patch({ iosBundleId: e.target.value })}
                    placeholder="studio.geiger.events"
                  />
                </Field>
                <Field label="Android package">
                  <Input
                    value={config.androidPackage}
                    onChange={(e) => patch({ androidPackage: e.target.value })}
                    placeholder="studio.geiger.events"
                  />
                </Field>
                <Field label="Version" hint="Matches app.json version.">
                  <Input
                    value={config.version}
                    onChange={(e) => patch({ version: e.target.value })}
                    placeholder="1.0.0"
                  />
                </Field>
                <Field label="EAS project id" hint="expo.extra.eas.projectId for builds.">
                  <Input
                    value={config.build.easProjectId}
                    onChange={(e) => setBuild({ easProjectId: e.target.value })}
                    placeholder="xxxxxxxx-xxxx-…"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Branding & theme"
            description="Maps to mobile/src/theme/tokens.ts plus splash/icon assets. Files preview locally until storage upload is wired."
          >
            <div className="space-y-4">
              <Field label="Accent colour">
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => {
                    const on = config.accent === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => patch({ accent: a.value })}
                        aria-label={a.name}
                        title={a.name}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                          on ? "border-white" : "border-transparent",
                        )}
                        style={{ background: a.value }}
                      >
                        {on ? <Check className="h-4 w-4 text-white mix-blend-difference" /> : null}
                      </button>
                    );
                  })}
                  <Input
                    value={config.accent}
                    onChange={(e) => patch({ accent: e.target.value })}
                    className="w-28 font-mono"
                    aria-label="Custom accent hex"
                  />
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Background" hint="tokens.colors.background">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border border-border"
                      style={{ background: config.background }}
                    />
                    <Input
                      value={config.background}
                      onChange={(e) => patch({ background: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </Field>
                <Field label="Card" hint="tokens.colors.card">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border border-border"
                      style={{ background: config.card }}
                    />
                    <Input
                      value={config.card}
                      onChange={(e) => patch({ card: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </Field>
                <Field label="Active tab" hint="tokens.colors.primary">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border border-border"
                      style={{ background: config.primary }}
                    />
                    <Input
                      value={config.primary}
                      onChange={(e) => patch({ primary: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </Field>
              </div>
              <Field label="Appearance">
                <SegmentedTabs tabs={THEME_TABS} value={config.themeMode} onChange={(v) => patch({ themeMode: v })} />
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <UploadTile
                  label="Logo"
                  hint="Home header mark. PNG with transparency."
                  preview={config.logoUrl}
                  onFile={onFile("logoUrl")}
                  onClear={() => patch({ logoUrl: "" })}
                />
                <UploadTile
                  label="App icon"
                  hint="1024×1024 PNG for app.json icon."
                  preview={config.iconUrl}
                  onFile={onFile("iconUrl")}
                  onClear={() => patch({ iconUrl: "" })}
                />
                <UploadTile
                  label="Splash"
                  hint="Splash-screen artwork over the colour below."
                  preview={config.splashUrl}
                  onFile={onFile("splashUrl")}
                  onClear={() => patch({ splashUrl: "" })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Splash background">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border border-border"
                      style={{ background: config.splashBackground }}
                    />
                    <Input
                      value={config.splashBackground}
                      onChange={(e) => patch({ splashBackground: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </Field>
                <Field label="Splash message">
                  <Input
                    value={config.splashMessage}
                    onChange={(e) => patch({ splashMessage: e.target.value })}
                    placeholder="Shown on first launch…"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Bottom tabs"
            description={`${enabledTabs} of 5 enabled — mirrors TAB_ORDER in mobile/src/components/TabBar.tsx.`}
          >
            <SettingsList>
              {APP_TABS.map((t) => (
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

          <SectionCard
            title="App sections"
            description="Hidden routes in (app)/_layout.tsx reached from More and Home. Turn off what this organiser doesn't sell."
          >
            <SettingsList>
              {APP_FEATURES.map((f) => (
                <SettingRow
                  key={f.key}
                  icon={f.icon}
                  title={f.label}
                  description={f.desc}
                  checked={Boolean(config.features?.[f.key])}
                  onCheckedChange={setFeature(f.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard title="Home screen" description="Welcome copy and the sections on the home tab.">
            <div className="space-y-4">
              <SettingsList>
                <SettingRow
                  icon={Radio}
                  title="Live strip"
                  description="Now-live rooms pinned to the top of Home."
                  checked={Boolean(config.home?.showLiveStrip)}
                  onCheckedChange={setHome("showLiveStrip")}
                />
                <SettingRow
                  icon={Ticket}
                  title="Upcoming tickets"
                  description="The member's next tickets with QR shortcuts."
                  checked={Boolean(config.home?.showUpcoming)}
                  onCheckedChange={setHome("showUpcoming")}
                />
                <SettingRow
                  icon={Award}
                  title="Memberships"
                  description="Perks and renewal prompts when a plan is held."
                  checked={Boolean(config.home?.showMemberships)}
                  onCheckedChange={setHome("showMemberships")}
                />
              </SettingsList>
              <Field label="Home cards" hint="Quick shortcuts rendered under the welcome banner.">
                <ChipsInput
                  value={config.homeCards}
                  onChange={(v) => patch({ homeCards: v })}
                  placeholder="Add a home card…"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Sign-in & access" description="Which doors the app opens. Guest browsing skips auth for public events.">
            <SettingsList>
              <SettingRow
                icon={MessageSquare}
                title="Email code"
                description="Passwordless OTP via the portal API."
                checked={Boolean(config.auth?.emailOtp)}
                onCheckedChange={setAuth("emailOtp")}
              />
              <SettingRow
                icon={Smartphone}
                title="Apple sign-in"
                description="Required when an iOS binary ships."
                checked={Boolean(config.auth?.apple)}
                onCheckedChange={setAuth("apple")}
              />
              <SettingRow
                icon={Smartphone}
                title="Google sign-in"
                description="One-tap sign-in on Android and iOS."
                checked={Boolean(config.auth?.google)}
                onCheckedChange={setAuth("google")}
              />
              <SettingRow
                icon={Palette}
                title="Guest browsing"
                description="Let people explore events before signing in."
                checked={Boolean(config.auth?.guestBrowsing)}
                onCheckedChange={setAuth("guestBrowsing")}
              />
              <SettingRow
                icon={User}
                title="Require login for tickets"
                description="Gate passes, orders and inbox behind sign-in."
                checked={Boolean(config.auth?.requireLogin)}
                onCheckedChange={setAuth("requireLogin")}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Push notifications" description="Expo push channels. Per-member opt-out always stays available in-app.">
            <SettingsList>
              <SettingRow
                icon={Bell}
                title="Push enabled"
                description="Master switch for expo-notifications."
                checked={Boolean(config.push?.pushEnabled)}
                onCheckedChange={setPush("pushEnabled")}
              />
              <SettingRow
                icon={Bell}
                title="Ticket reminders"
                description="Doors-open and day-before nudges."
                checked={Boolean(config.push?.reminders)}
                onCheckedChange={setPush("reminders")}
              />
              <SettingRow
                icon={MessagesSquare}
                title="Announcements"
                description="Organiser broadcasts and schedule changes."
                checked={Boolean(config.push?.announcements)}
                onCheckedChange={setPush("announcements")}
              />
              <SettingRow
                icon={Radio}
                title="Live alerts"
                description="Room opened / premiere starting."
                checked={Boolean(config.push?.liveAlerts)}
                onCheckedChange={setPush("liveAlerts")}
              />
              <SettingRow
                icon={Palette}
                title="Marketing"
                description="Off by default; needs explicit opt-in."
                checked={Boolean(config.push?.marketing)}
                onCheckedChange={setPush("marketing")}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Build settings"
            description="Feeds EAS (eas.json) when binaries are wired. Download buttons open the linked file, or export the config JSON until then."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Android artifact">
                  <SegmentedTabs
                    tabs={ANDROID_FORMAT_TABS}
                    value={config.build.androidFormat}
                    onChange={(v) => setBuild({ androidFormat: v })}
                  />
                </Field>
                <Field label="iOS distribution">
                  <SegmentedTabs
                    tabs={IOS_METHOD_TABS}
                    value={config.build.iosMethod}
                    onChange={(v) => setBuild({ iosMethod: v })}
                  />
                </Field>
              </div>
              <Field label="Release notes" hint="Shown on the download card and TestFlight.">
                <Textarea
                  rows={2}
                  value={config.build.releaseNotes}
                  onChange={(e) => setBuild({ releaseNotes: e.target.value })}
                  placeholder="What's new in this build…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Android file URL">
                  <Input
                    value={config.build.androidUrl}
                    onChange={(e) => setBuild({ androidUrl: e.target.value })}
                    placeholder="https://…/app.apk"
                  />
                </Field>
                <Field label="iOS link">
                  <Input
                    value={config.build.iosUrl}
                    onChange={(e) => setBuild({ iosUrl: e.target.value })}
                    placeholder="https://testflight.apple.com/…"
                  />
                </Field>
              </div>
              <SettingsList>
                <SettingRow
                  icon={Smartphone}
                  title="Published"
                  description="Mark this branding live. Binaries stay optional."
                  checked={Boolean(config.published)}
                  onCheckedChange={(on) => patch({ published: on })}
                />
              </SettingsList>
            </div>
          </SectionCard>
        </div>

        <aside className="min-w-0 space-y-6">
          <div className="lg:sticky lg:top-0 lg:space-y-6">
            <div>
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                Live preview
              </p>
              <PhonePreview config={config} />
            </div>

            <SectionCard title="Download" description={`v${config.version || "1.0.0"} · ${buildState === "building" ? "building…" : "latest ready"}`}>
              <div className="space-y-3">
                <Button type="button" className="w-full" onClick={() => downloadBinary("android")}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Android · {config.build.androidFormat.toUpperCase()}
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => downloadBinary("ios")}>
                  <Download className="mr-1.5 h-4 w-4" />
                  iOS · {config.build.iosMethod === "store" ? "App Store" : "TestFlight"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={buildState === "building"}
                  onClick={requestBuild}
                >
                  {buildState === "building" ? "Requesting…" : "Request new build"}
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-text-secondary">
                  <QrCode className="h-8 w-8 shrink-0 text-text-tertiary" />
                  <span>
                    Install QR appears here once a binary URL is saved. Until then, share the config export with the
                    mobile pipeline.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => copy(config.build.androidUrl, "Android link")}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Android link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => copy(config.build.iosUrl, "iOS link")}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> iOS link
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    patch(DEFAULT_CONFIG);
                    toast.message("Reset to defaults.");
                  }}
                >
                  Reset to defaults
                </Button>
              </div>
            </SectionCard>
          </div>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default BrandedAppScreen;
