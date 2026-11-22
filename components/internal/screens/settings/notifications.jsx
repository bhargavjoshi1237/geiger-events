"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  FolderOpen,
  Loader2,
  Mail,
  Megaphone,
  Mic,
  ScanLine,
  Send,
  ShieldCheck,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorSections } from "@/components/internal/shared/editor_shell";
import {
  EmptyState,
  ScreenHeader,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { LoadingArea } from "@geiger/ui";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import { useProject } from "@/context/project-context";
import { useCan } from "@/context/rbac-context";
import { cn } from "@/lib/utils";
import {
  EMAIL_GROUPS,
  EMAIL_NOTIFICATIONS,
  NOTIFICATIONS_MODULE,
  defaultNotificationConfig,
  notificationsInGroup,
} from "@/lib/email/catalog";
import { retryPush, sendTestPush } from "@/lib/push/client";
import { getSetting, upsertSetting } from "@/lib/supabase/ticketing_settings";

import PushTab from "./push/push_tab";
import DeliveryTab from "./push/delivery_tab";
import SchedulerTab from "./push/scheduler_tab";
import { LoadError } from "./push/shared";
import { usePushSettings } from "./push/use_push_settings";
import { usePushLog } from "./push/use_push_log";
import { usePushScheduler } from "./push/use_push_scheduler";

// Settings -> Notifications: per-project email switches (lib/email/catalog.js, enforced by lib/email/notifications.js) and member push (lib/push/types.js).

const GROUP_ICONS = {
  registrations: ClipboardList,
  orders: Ticket,
  onsite: ScanLine,
  memberships: BadgeCheck,
  portal: UserCog,
  team: Users,
  program: Mic,
  partners: Building2,
  marketing: Megaphone,
};

// A type is on unless explicitly switched off; a key absent from the bag means "never touched".
function isOn(config, key) {
  return config?.types?.[key] !== false;
}

function setType(config, key, value) {
  return { types: { ...(config.types || {}), [key]: value } };
}

// "Live" = a send site exists today; "Planned" = declared and stored, but nothing fires it yet.
function StatusBadge({ live }) {
  return (
    <Badge
      className={cn(
        "h-4 shrink-0 px-1.5 text-[9px] font-medium",
        live
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-surface-card text-muted-foreground",
      )}
    >
      {live ? "Live" : "Planned"}
    </Badge>
  );
}

function NotificationRow({ notification, config, set, disabled }) {
  return (
    <SettingRow
      title={
        <span className="flex flex-wrap items-center gap-2">
          {notification.label}
          <StatusBadge live={notification.live} />
        </span>
      }
      description={`${notification.audience} · ${notification.description}`}
      control={
        <Switch
          checked={isOn(config, notification.key)}
          disabled={disabled}
          onCheckedChange={(v) => set(setType(config, notification.key, v))}
          aria-label={`${isOn(config, notification.key) ? "Disable" : "Enable"} ${notification.label}`}
        />
      }
    />
  );
}

// The Delivery section: the master switch plus a read-out of what it governs.
function DeliverySection({ config, set }) {
  const counts = useMemo(() => {
    const on = EMAIL_NOTIFICATIONS.filter((n) => isOn(config, n.key));
    return {
      on: on.length,
      total: EMAIL_NOTIFICATIONS.length,
      live: EMAIL_NOTIFICATIONS.filter((n) => n.live).length,
    };
  }, [config]);

  const paused = config.enabled === false;

  return (
    <div className="space-y-6">
      <SettingsList>
        <SettingRow
          icon={Mail}
          title="Send transactional emails"
          description="The master switch. Off, this project sends no automated mail at all — every type below is suppressed."
          checked={config.enabled !== false}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </SettingsList>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Types enabled", value: `${counts.on} / ${counts.total}` },
          { label: "Wired up today", value: String(counts.live) },
          { label: "Status", value: paused ? "Paused" : "Sending" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface-subtle px-4 py-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold",
                stat.label === "Status" && paused
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-text-tertiary">
        Delivery itself is handled by the shared Geiger email service — templates,
        sending domain and the send log all live there. This screen only decides
        which of this project&apos;s emails are allowed to go out. Types marked
        Planned are reserved: the preference is saved now and honoured as soon as
        that email is built.
      </p>
    </div>
  );
}

// One section per catalog group, each rendering its own switches.
const SECTIONS = [
  {
    key: "delivery",
    label: "Delivery",
    icon: Mail,
    desc: "Whether this project sends automated email at all.",
    render: DeliverySection,
  },
  ...EMAIL_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    icon: GROUP_ICONS[group.key] || Mail,
    desc: group.desc,
    render: function GroupSection({ config, set }) {
      const disabled = config.enabled === false;
      return (
        <div className="space-y-4">
          {disabled ? (
            <div className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
              Transactional email is switched off for this project, so none of
              these send. Turn it back on under Delivery.
            </div>
          ) : null}
          <SettingsList className={cn(disabled && "opacity-50")}>
            {notificationsInGroup(group.key).map((notification) => (
              <NotificationRow
                key={notification.key}
                notification={notification}
                config={config}
                set={set}
                disabled={disabled}
              />
            ))}
          </SettingsList>
        </div>
      );
    },
  })),
];

const TABS = [
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
  { key: "delivery", label: "Delivery" },
  { key: "scheduler", label: "Scheduler" },
];

const POLL_MS = 15_000;

// The email config, loaded and saved the way SettingsScreen does it so the bag can sit under the shared tabs.
function useEmailNotifications(projectId) {
  const [config, setConfig] = useState(defaultNotificationConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getSetting(projectId, NOTIFICATIONS_MODULE).then((res) => {
      if (!alive) return;
      // Merge saved config over defaults so new keys always have a value.
      setConfig({ ...defaultNotificationConfig(), ...(res?.config || {}) });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const set = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);

  const save = async (next) => {
    const payload = next === undefined ? config : next;
    if (next !== undefined) setConfig(next);
    setSaving(true);
    const res = await upsertSetting(projectId, NOTIFICATIONS_MODULE, payload);
    setSaving(false);
    // null means not configured; only a hard failure (false) is an error.
    if (res === false) {
      toast.error("Couldn't save your settings to the server.");
      return false;
    }
    toast.success("Settings saved.");
    return true;
  };

  return { config, loading, saving, set, save };
}

export function NotificationsSettingsScreen() {
  const { projectId, loading: projectLoading } = useProject();
  const canManage = useCan("events.settings.manage");
  const [tab, setTab] = useState("email");
  const [pushSection, setPushSection] = useState("delivery");
  const [testing, setTesting] = useState(false);

  // Every push route needs Manage settings, so the push tabs only read when the viewer has it.
  const pushAllowed = Boolean(projectId) && canManage;
  const email = useEmailNotifications(projectId);
  const push = usePushSettings(projectId, pushAllowed && tab !== "email");
  const log = usePushLog(projectId, pushAllowed && tab === "delivery");
  const scheduler = usePushScheduler(projectId, pushAllowed && tab === "scheduler");
  const { refresh: refreshLog, replaceItem, extended: logExtended } = log;
  const { refresh: refreshScheduler } = scheduler;

  // The log and the scheduler are live: re-read them while on screen (the log only while it's a single page).
  useEffect(() => {
    const live = tab === "scheduler" || (tab === "delivery" && !logExtended);
    if (!live || !pushAllowed) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (tab === "scheduler") refreshScheduler();
      else refreshLog();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [tab, logExtended, pushAllowed, refreshLog, refreshScheduler]);

  async function handleTest() {
    setTesting(true);
    const result = await sendTestPush(projectId);
    setTesting(false);
    if (result.error) toast.error(result.error.message);
    else if (result.ok) toast.success(result.message || "Test push sent.");
    else toast.error(result.message || "The test push didn't go out.");
    refreshLog();
  }

  async function handleRetry(item) {
    const result = await retryPush(projectId, item.id);
    if (result.error) {
      toast.error(result.error.message);
      return false;
    }
    replaceItem(result.item);
    toast.success("Push queued to send again");
    return true;
  }

  let headerAction = null;
  if (tab === "email") {
    headerAction = (
      <Button
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={email.saving || email.loading}
        onClick={() => email.save()}
      >
        {email.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {email.saving ? "Saving…" : "Save Changes"}
      </Button>
    );
  } else if (tab === "delivery" && pushAllowed) {
    headerAction = (
      <Button className="bg-primary text-primary-foreground" onClick={handleTest} disabled={testing}>
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send test push
      </Button>
    );
  }

  let body;
  if (tab === "email") {
    body = email.loading ? (
      <LoadingArea panel />
    ) : (
      <EditorSections nav={SECTIONS} defaultSection={SECTIONS[0].key}>
        {({ activeItem }) => {
          // Rendered as an element, not called — sections own their own hooks.
          const Body = activeItem.render;
          return <Body config={email.config} set={email.set} save={email.save} saving={email.saving} />;
        }}
      </EditorSections>
    );
  } else if (!projectId) {
    body = projectLoading ? (
      <LoadingArea size={48} panel label="Loading push settings" />
    ) : (
      <EmptyState
        icon={FolderOpen}
        title="Open a project"
        description="Push notifications belong to a project. Choose one to manage them."
      />
    );
  } else if (!canManage) {
    body = (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={ShieldCheck}
          title="Push needs the Manage settings permission"
          description="Ask a project owner for it to change push settings, read the delivery log or check the scheduler."
        />
      </div>
    );
  } else if (tab === "delivery") {
    body = (
      <DeliveryTab
        log={log}
        paused={Boolean(push.settings?.paused)}
        canManage={canManage}
        testing={testing}
        onTest={handleTest}
        onRetry={handleRetry}
      />
    );
  } else if (push.loading || (tab === "scheduler" && scheduler.loading)) {
    body = <LoadingArea size={48} panel label="Loading push settings" />;
  } else if (tab === "push") {
    body = push.settings ? (
      <PushTab settings={push.settings} update={push.update} section={pushSection} onSectionChange={setPushSection} />
    ) : (
      <LoadError title="Couldn't load push settings" error={push.error} onRetry={push.refresh} />
    );
  } else {
    body = scheduler.data ? (
      <SchedulerTab
        data={scheduler.data}
        paused={push.settings ? push.settings.paused : scheduler.data.paused}
        pauseDisabled={!push.settings}
        onPause={(paused) => push.update({ paused })}
        onRefresh={refreshScheduler}
      />
    ) : (
      <LoadError title="Couldn't load the scheduler" error={scheduler.error} onRetry={refreshScheduler} />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Notifications"
        description="Choose which automated emails and app push notifications this project sends. Switching a type off stops it for every event in the project."
        actions={headerAction}
      />

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative shrink-0 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "text-foreground" : "text-text-secondary hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.key ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
          </button>
        ))}
      </div>

      {body}
    </MainScreenWrapper>
  );
}

export default NotificationsSettingsScreen;
