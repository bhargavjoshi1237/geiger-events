"use client";

import { useId, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  Handshake,
  MessageSquare,
  MessagesSquare,
  Moon,
  Smartphone,
  Ticket,
} from "lucide-react";

import { EditorSections } from "@/components/internal/shared/editor_shell";
import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@geiger/ui/toggle-group";
import {
  EVENT_OFFSET_OPTIONS,
  MEMBERSHIP_DAY_OPTIONS,
  PUSH_CATEGORIES,
  PUSH_TYPES,
  isTypeEnabled,
} from "@/lib/push/types";
import { cn } from "@/lib/utils";
import { MAX_TIMINGS, dayLabel, listLabel, offsetLabel } from "./constants";
import { PauseSwitch } from "./shared";

const CATEGORY_ICONS = {
  tickets: Ticket,
  reminders: AlarmClock,
  updates: CalendarClock,
  messages: MessageSquare,
  community: MessagesSquare,
  meetings: Handshake,
};

const MEMBERSHIP_OPTIONS = MEMBERSHIP_DAY_OPTIONS.map((days) => ({ value: days, label: dayLabel(days) }));

const QUIET_TYPES = PUSH_TYPES.filter((t) => t.quiet);

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function setType(key, value) {
  return (settings) => ({ types: { ...settings.types, [key]: value } });
}

function setQuietHours(patch) {
  return (settings) => ({ quietHours: { ...settings.quietHours, ...patch } });
}

// Same note the email groups show when their master switch is off.
function PausedNote() {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
      Push is paused for this project, so none of these send. Unpause it under Delivery.
    </div>
  );
}

function QuietBadge() {
  return (
    <Badge
      className="h-4 shrink-0 gap-1 border-border bg-surface-card px-1.5 text-[9px] font-medium text-muted-foreground [&_svg]:size-2.5"
      title="Waits until quiet hours end when they're on"
    >
      <Moon />
      Quiet hours
    </Badge>
  );
}

// The current timings, appended to the two reminder types that use them.
function timingNote(key, settings) {
  if (key === "event_starting") {
    return settings.eventOffsets.length
      ? `Currently ${listLabel(settings.eventOffsets.map(offsetLabel))}.`
      : "No timings picked, so none are sent.";
  }
  if (key === "membership_expiring") {
    return settings.membershipDays.length
      ? `Currently ${listLabel(settings.membershipDays.map(dayLabel))}.`
      : "No timings picked, so none are sent.";
  }
  return "";
}

function TypeRow({ type, settings, update }) {
  const on = isTypeEnabled(settings, type.key);
  const note = timingNote(type.key, settings);
  return (
    <SettingRow
      title={
        <span className="flex flex-wrap items-center gap-2">
          {type.label}
          {type.quiet ? <QuietBadge /> : null}
        </span>
      }
      description={note ? `${type.description} ${note}` : type.description}
      control={
        <Switch
          checked={on}
          disabled={settings.paused}
          onCheckedChange={(v) => update(setType(type.key, v))}
          aria-label={`${on ? "Disable" : "Enable"} ${type.label}`}
        />
      }
    />
  );
}

// The Delivery section: the pause switch plus a read-out of what's on.
function DeliverySection({ settings, update }) {
  const enabled = PUSH_TYPES.filter((t) => isTypeEnabled(settings, t.key)).length;
  const quiet = settings.quietHours;
  const stats = [
    { label: "Types enabled", value: `${enabled} / ${PUSH_TYPES.length}` },
    { label: "Quiet hours", value: quiet.enabled ? `${quiet.start}–${quiet.end}` : "Off" },
    { label: "Status", value: settings.paused ? "Paused" : "Sending", alert: settings.paused },
  ];

  return (
    <div className="space-y-6">
      <PauseSwitch paused={settings.paused} onChange={(v) => update({ paused: v })} />

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface-subtle px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{stat.label}</p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                stat.alert ? "text-red-600 dark:text-red-400" : "text-foreground",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-text-tertiary">
        Pushes reach members signed in to the app on a phone that allows notifications. Members can also turn whole
        categories off on their own phone; this screen decides which of this project&apos;s pushes may go out at all.
        Changes save as you make them.
      </p>
    </div>
  );
}

function TimingPicker({ label, description, options, format, value, off, onChange }) {
  const full = value.length >= MAX_TIMINGS;
  // A stored timing outside the presets still gets a chip, so it can be seen and removed.
  const known = new Set(options.map((o) => o.value));
  const chips = [...options, ...value.filter((v) => !known.has(v)).map((v) => ({ value: v, label: format(v) }))].sort(
    (a, b) => b.value - a.value,
  );
  let hint = `${value.length} of ${MAX_TIMINGS} picked.`;
  if (!value.length) hint = "None picked, so none are sent.";
  else if (full) hint = "That's the most you can pick. Remove one to choose another.";

  return (
    <div className="space-y-3 py-5 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={2}
        value={value.map(String)}
        onValueChange={(next) => next.length <= MAX_TIMINGS && onChange(next.map(Number))}
        className="flex-wrap gap-2 shadow-none"
        aria-label={label}
      >
        {chips.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={String(option.value)}
            disabled={full && !value.includes(option.value)}
            className="rounded-lg bg-surface-card px-3 text-xs shadow-none data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-text-tertiary">
        {off ? `${off} is switched off under Reminders, so these aren't used right now.` : hint}
      </p>
    </div>
  );
}

function TimingsSection({ settings, update }) {
  return (
    <div className="space-y-4">
      {settings.paused ? <PausedNote /> : null}
      <div className="divide-y divide-border">
        <TimingPicker
          label="Event reminders"
          description="Sent to ticket holders ahead of the event's start time."
          options={EVENT_OFFSET_OPTIONS}
          format={offsetLabel}
          value={settings.eventOffsets}
          off={isTypeEnabled(settings, "event_starting") ? "" : "Event reminder"}
          onChange={(eventOffsets) => update({ eventOffsets })}
        />
        <TimingPicker
          label="Membership expiry"
          description="Sent to members before their membership runs out."
          options={MEMBERSHIP_OPTIONS}
          format={dayLabel}
          value={settings.membershipDays}
          off={isTypeEnabled(settings, "membership_expiring") ? "" : "Membership expiring"}
          onChange={(membershipDays) => update({ membershipDays })}
        />
      </div>
    </div>
  );
}

// Saves on blur (or Enter), so stepping through hours and minutes doesn't send a request per keystroke.
function TimeField({ label, value, disabled, onCommit }) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  function commit() {
    if (HHMM.test(draft) && draft !== value) onCommit(draft);
    else setDraft(value);
  }

  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="time"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="bg-surface-card"
      />
    </Field>
  );
}

function QuietHoursSection({ settings, update }) {
  const quiet = settings.quietHours;
  return (
    <div className="space-y-6">
      {settings.paused ? <PausedNote /> : null}
      <SettingsList>
        <SettingRow
          icon={Moon}
          title="Hold non-urgent pushes overnight"
          description={`Applies to ${listLabel(QUIET_TYPES.map((t) => t.label))}.`}
          control={
            <Switch
              checked={quiet.enabled}
              onCheckedChange={(v) => update(setQuietHours({ enabled: v }))}
              aria-label="Quiet hours"
            />
          }
        />
      </SettingsList>

      <div className="grid max-w-md gap-4 sm:grid-cols-2">
        {/* Keyed on the saved value so a save, or a rollback, resets the draft. */}
        <TimeField
          key={`start-${quiet.start}`}
          label="Start"
          value={quiet.start}
          disabled={!quiet.enabled}
          onCommit={(start) => update(setQuietHours({ start }))}
        />
        <TimeField
          key={`end-${quiet.end}`}
          label="End"
          value={quiet.end}
          disabled={!quiet.enabled}
          onCommit={(end) => update(setQuietHours({ end }))}
        />
      </div>

      <p className="text-xs leading-relaxed text-text-tertiary">
        Announcements and community messages wait until quiet hours end, in the event&apos;s timezone. Tickets,
        reminders and event changes always go out.
      </p>
    </div>
  );
}

// One section per catalog category, each rendering its own switches.
const SECTIONS = [
  {
    key: "delivery",
    label: "Delivery",
    icon: Smartphone,
    desc: "Whether this project sends push notifications at all.",
    render: DeliverySection,
  },
  ...PUSH_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    icon: CATEGORY_ICONS[category.key] || Smartphone,
    desc: category.description,
    render: function CategorySection({ settings, update }) {
      const types = PUSH_TYPES.filter((t) => t.category === category.key);
      return (
        <div className="space-y-4">
          {settings.paused ? <PausedNote /> : null}
          <SettingsList className={cn(settings.paused && "opacity-50")}>
            {types.map((type) => (
              <TypeRow key={type.key} type={type} settings={settings} update={update} />
            ))}
          </SettingsList>
        </div>
      );
    },
  })),
  {
    key: "timings",
    label: "Reminder timings",
    icon: AlarmClock,
    desc: "When event and membership reminders go out. Pick up to four of each.",
    render: TimingsSection,
  },
  {
    key: "quiet",
    label: "Quiet hours",
    icon: Moon,
    desc: "Hold chatty pushes overnight so members aren't woken up.",
    render: QuietHoursSection,
  },
];

export default function PushTab({ settings, update, section, onSectionChange }) {
  return (
    <EditorSections
      nav={SECTIONS}
      defaultSection={SECTIONS[0].key}
      active={section}
      onActiveChange={onSectionChange}
      syncToUrl={false}
    >
      {({ activeItem }) => {
        // Rendered as an element, not called — sections own their own hooks.
        const Body = activeItem.render;
        return <Body settings={settings} update={update} />;
      }}
    </EditorSections>
  );
}
