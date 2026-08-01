"use client";

import React, { useMemo } from "react";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Mail,
  Megaphone,
  Mic,
  ScanLine,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";

import {
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  EMAIL_GROUPS,
  EMAIL_NOTIFICATIONS,
  NOTIFICATIONS_MODULE,
  defaultNotificationConfig,
  notificationsInGroup,
} from "@/lib/email/catalog";

import { SettingsScreen } from "../tickets/settings_kit";

// Settings -> Notifications. One switch per transactional email in
// lib/email/catalog.js, grouped the way the catalog groups them. The config bag
// is stored per project in events.ticketing_settings (module 'notifications')
// and enforced server-side by lib/email/notifications.js, so a switch turned off
// here suppresses the real send.

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

// A type is on unless it was explicitly switched off, matching the catalog's
// default-on contract (a key absent from the bag means "never touched").
function isOn(config, key) {
  return config?.types?.[key] !== false;
}

function setType(config, key, value) {
  return { types: { ...(config.types || {}), [key]: value } };
}

// "Live" = a send site exists today; "Planned" = the type is declared and the
// preference is stored, but nothing fires it yet.
function StatusBadge({ live }) {
  return (
    <Badge
      className={cn(
        "h-4 shrink-0 px-1.5 text-[9px] font-medium",
        live
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
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
                  ? "text-red-400"
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

export function NotificationsSettingsScreen() {
  return (
    <SettingsScreen
      module={NOTIFICATIONS_MODULE}
      title="Notifications"
      description="Choose which automated emails this project sends, and to whom. Switching a type off stops it for every event in the project."
      defaultConfig={defaultNotificationConfig}
      sections={SECTIONS}
    />
  );
}

export default NotificationsSettingsScreen;
