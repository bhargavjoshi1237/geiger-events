"use client";

import React, { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  BellRing,
  CalendarClock,
  CalendarCheck,
  Megaphone,
  Ticket,
  TrendingUp,
  TrendingDown,
  CircleCheck,
  Wallet,
  Flag,
  UserPlus,
  Users,
} from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";

// Per-event organizer alerts. Each rule — persisted in the event's metadata bag
// (`metadata.alerts`) via useEventConfig, like tickets/schedule — asks to email
// the organizer's team when a milestone or threshold is hit, so no migration is
// needed and rules rehydrate on reload.
//
// ── Evaluation contract (for the future scheduler; not built in this pass) ──
// A backend job reads `event.metadata.alerts` and, per enabled rule:
//   • time-based  → fires once at `milestone ± {offsetValue}{offsetUnit}`, where
//     milestone is the event start / registration close / sales open / event end.
//   • threshold   → evaluates against live sales (tickets sold, capacity, revenue,
//     waitlist, days since last sale) and fires when the condition first holds.
//   • activity    → fires on each new registration (or batched into a daily
//     digest when `digest` is true) or when the Nth registration lands.
// Recipients = the event's co-hosts/admins when `notifyTeam`, plus any
// `extraEmails`. Dedupe with a persisted `lastFiredAt` stamp. Delivery goes
// through the shared `sendSuiteEmail({ template: "event-alert", to, data })`.

// Trigger catalog — key → { label, category, icon, param kind, and a `clause`
// that renders the human-readable "when" phrase for a saved rule. `param` drives
// which parameter control the dialog shows; `defaults` seed a fresh rule.
const CATEGORIES = ["Time-based", "Sales & capacity", "Activity"];

const TRIGGERS = {
  before_event_start: {
    label: "Before the event starts",
    category: "Time-based",
    icon: CalendarClock,
    param: "offset",
    milestone: "the event starts",
    direction: "before",
    defaults: { offsetValue: 1, offsetUnit: "days" },
    clause: (r) => `${offsetLabel(r)} before the event starts`,
  },
  before_reg_close: {
    label: "Before registration closes",
    category: "Time-based",
    icon: CalendarClock,
    param: "offset",
    milestone: "registration closes",
    direction: "before",
    defaults: { offsetValue: 5, offsetUnit: "days" },
    clause: (r) => `${offsetLabel(r)} before registration closes`,
  },
  before_sales_open: {
    label: "Before tickets go on sale",
    category: "Time-based",
    icon: Megaphone,
    param: "offset",
    milestone: "tickets go on sale",
    direction: "before",
    defaults: { offsetValue: 1, offsetUnit: "days" },
    clause: (r) => `${offsetLabel(r)} before tickets go on sale`,
  },
  after_event_end: {
    label: "After the event ends",
    category: "Time-based",
    icon: CalendarCheck,
    param: "offset",
    milestone: "the event ends",
    direction: "after",
    defaults: { offsetValue: 1, offsetUnit: "days" },
    clause: (r) => `${offsetLabel(r)} after the event ends`,
  },
  low_inventory: {
    label: "Low ticket inventory",
    category: "Sales & capacity",
    icon: Ticket,
    param: "number",
    paramLabel: "Tickets remaining",
    unit: "tickets or fewer",
    defaults: { threshold: 5 },
    clause: (r) => `when ${num(r.threshold)} or fewer tickets remain`,
  },
  sell_through: {
    label: "Sell-through reaches %",
    category: "Sales & capacity",
    icon: TrendingUp,
    param: "number",
    paramLabel: "Percent of capacity sold",
    suffix: "%",
    defaults: { threshold: 90 },
    clause: (r) => `when ${num(r.threshold)}% of capacity is sold`,
  },
  sold_out: {
    label: "Event sells out",
    category: "Sales & capacity",
    icon: CircleCheck,
    param: "none",
    defaults: {},
    clause: () => "when the event sells out",
  },
  revenue_milestone: {
    label: "Revenue milestone",
    category: "Sales & capacity",
    icon: Wallet,
    param: "number",
    paramLabel: "Revenue target",
    prefix: "$",
    defaults: { threshold: 5000 },
    clause: (r) => `when revenue reaches $${num(r.threshold)}`,
  },
  stalled_sales: {
    label: "Sales stall",
    category: "Sales & capacity",
    icon: TrendingDown,
    param: "number",
    paramLabel: "Days with no sales",
    unit: "days",
    defaults: { threshold: 3 },
    clause: (r) => `when there are no sales for ${num(r.threshold)} ${plural(r.threshold, "day")}`,
  },
  reg_milestone: {
    label: "Registration milestone",
    category: "Activity",
    icon: Flag,
    param: "number",
    paramLabel: "Registration count",
    unit: "registrations",
    defaults: { threshold: 50 },
    clause: (r) => `when ${num(r.threshold)} registrations are reached`,
  },
  new_registration: {
    label: "New registration",
    category: "Activity",
    icon: UserPlus,
    param: "digest",
    defaults: { digest: false },
    clause: (r) =>
      r.digest
        ? "as a daily digest of new registrations"
        : "on every new registration",
  },
  waitlist_threshold: {
    label: "Waitlist threshold",
    category: "Activity",
    icon: Users,
    param: "number",
    paramLabel: "Waitlist size",
    unit: "people",
    defaults: { threshold: 20 },
    clause: (r) => `when the waitlist reaches ${num(r.threshold)}`,
  },
};

// ── Formatting helpers ──────────────────────────────────────────────────────
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function plural(v, word) {
  return num(v) === 1 ? word : `${word}s`;
}
function offsetLabel(r) {
  const n = num(r.offsetValue);
  const unit = r.offsetUnit === "hours" ? "hour" : "day";
  return `${n} ${plural(n, unit)}`;
}
function parseEmails(str) {
  return String(str || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}
function recipientLabel(r) {
  const parts = [];
  if (r.notifyTeam) parts.push("Co-hosts & admins");
  parts.push(...parseEmails(r.extraEmails));
  return parts.length ? parts.join(" · ") : "No recipients";
}
function alertSummary(r) {
  const t = TRIGGERS[r.trigger];
  if (!t) return "";
  const recipients = r.notifyTeam
    ? ["co-hosts & admins", ...parseEmails(r.extraEmails)]
    : parseEmails(r.extraEmails);
  const who = recipients.length ? recipients.join(", ") : "no one yet";
  const line = `Email ${who} ${t.clause(r)}`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

const EMPTY_DRAFT = {
  trigger: "before_reg_close",
  offsetValue: 5,
  offsetUnit: "days",
  threshold: 5,
  digest: false,
  notifyTeam: true,
  extraEmails: "",
  enabled: true,
};

// Seed a draft's params from the chosen trigger's defaults, preserving recipients.
function draftForTrigger(trigger, prev) {
  return { ...prev, trigger, ...TRIGGERS[trigger]?.defaults };
}

export function AlertsSection({ event, headerItem }) {
  const [alerts, , saveAlerts] = useEventConfig(event, "alerts", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, alert } | null

  const addAlert = (alert) =>
    saveAlerts([...alerts, { ...alert, id: `alr_${Date.now()}` }], {
      successMsg: "Alert created.",
    });

  const updateAlert = (index, alert) =>
    saveAlerts(
      alerts.map((a, i) => (i === index ? { ...a, ...alert } : a)),
      { successMsg: "Alert updated." },
    );

  const toggleAlert = (index, enabled) =>
    saveAlerts(alerts.map((a, i) => (i === index ? { ...a, enabled } : a)));

  const removeAlert = (index) => {
    saveAlerts(
      alerts.filter((_, i) => i !== index),
      { successMsg: "Alert removed." },
    );
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Alerts"}
        description={
          headerItem?.desc ||
          "Get emailed when a milestone or threshold needs your attention."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add alert
          </Button>
        }
      />

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const t = TRIGGERS[a.trigger];
            const Icon = t?.icon || BellRing;
            return (
              <div
                key={a.id || i}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3 transition-opacity",
                  !a.enabled && "opacity-55",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-text-secondary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t ? t.clause(a) : "Alert"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {recipientLabel(a)}
                  </p>
                </div>
                <Switch
                  checked={a.enabled !== false}
                  onCheckedChange={(v) => toggleAlert(i, v)}
                  aria-label={a.enabled ? "Disable alert" : "Enable alert"}
                />
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing({ index: i, alert: a })}
                    aria-label="Edit alert"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeAlert(i)}
                    aria-label="Delete alert"
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BellRing}
          title="No alerts yet"
          description="Create an alert to get an email when registration is closing, tickets are running low, or your event hits a milestone."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Create your first alert
            </Button>
          }
        />
      )}

      <AlertDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={addAlert}
      />
      <AlertDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing?.alert}
        onSave={(alert) => {
          updateAlert(editing.index, alert);
          setEditing(null);
        }}
      />
    </div>
  );
}

// Create or edit a single alert — pick a trigger, fill its one parameter, choose
// recipients, and see a live plain-English preview of what will be emailed.
function AlertDialog({ open, onOpenChange, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [alsoEmail, setAlsoEmail] = useState(false);

  // Re-seed whenever the dialog opens (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const seed = initial ? { ...EMPTY_DRAFT, ...initial } : EMPTY_DRAFT;
      setDraft(seed);
      setAlsoEmail(Boolean(parseEmails(seed.extraEmails).length));
    }
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const t = TRIGGERS[draft.trigger];

  const submit = () => {
    if (!t) return;
    if (t.param === "offset" && num(draft.offsetValue) < 1) {
      toast.error("Enter how long before the milestone to alert.");
      return;
    }
    if (t.param === "number" && num(draft.threshold) < 1) {
      toast.error(`Enter a value for “${t.paramLabel}”.`);
      return;
    }
    const extraEmails = alsoEmail ? draft.extraEmails : "";
    if (!draft.notifyTeam && !parseEmails(extraEmails).length) {
      toast.error("Choose at least one recipient.");
      return;
    }
    onSave({ ...draft, extraEmails });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit alert" : "New alert"}</DialogTitle>
          <DialogDescription>
            We&apos;ll email you when this condition is met.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Alert me">
            <Select
              value={draft.trigger}
              onValueChange={(v) => setDraft((d) => draftForTrigger(v, d))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectGroup key={cat}>
                    <SelectLabel>{cat}</SelectLabel>
                    {Object.entries(TRIGGERS)
                      .filter(([, cfg]) => cfg.category === cat)
                      .map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <ParamField draft={draft} set={set} />

          {/* Recipients */}
          <Field label="Recipients">
            <div className="space-y-3 rounded-lg border border-border bg-surface-card p-3">
              <label className="flex items-center gap-2.5 text-sm text-foreground">
                <Checkbox
                  checked={draft.notifyTeam}
                  onCheckedChange={(v) => set("notifyTeam")(Boolean(v))}
                />
                Co-hosts &amp; admins
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground">
                <Checkbox
                  checked={alsoEmail}
                  onCheckedChange={(v) => setAlsoEmail(Boolean(v))}
                />
                Also send to specific emails
              </label>
              {alsoEmail ? (
                <Input
                  value={draft.extraEmails}
                  onChange={(e) => set("extraEmails")(e.target.value)}
                  placeholder="ops@acme.com, me@acme.com"
                />
              ) : null}
            </div>
          </Field>

          {/* Live preview */}
          {t ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
              <p className="text-sm text-muted-foreground">
                {alertSummary({
                  ...draft,
                  extraEmails: alsoEmail ? draft.extraEmails : "",
                })}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {initial ? "Save alert" : "Add alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The single parameter control for the selected trigger — an offset (value +
// unit), a numeric threshold (with a prefix/suffix), a digest frequency, or
// nothing for parameterless triggers (e.g. "sells out").
function ParamField({ draft, set }) {
  const t = TRIGGERS[draft.trigger];
  if (!t || t.param === "none") return null;

  if (t.param === "offset") {
    return (
      <Field label="How far ahead">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={draft.offsetValue}
            onChange={(e) => set("offsetValue")(e.target.value)}
            className="w-24"
          />
          <Select value={draft.offsetUnit} onValueChange={set("offsetUnit")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">hours</SelectItem>
              <SelectItem value="days">days</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-text-secondary">
            {t.direction} {t.milestone}
          </span>
        </div>
      </Field>
    );
  }

  if (t.param === "digest") {
    return (
      <Field label="Frequency">
        <Select
          value={draft.digest ? "digest" : "immediate"}
          onValueChange={(v) => set("digest")(v === "digest")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">On every registration</SelectItem>
            <SelectItem value="digest">Once daily (digest)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    );
  }

  // Numeric threshold.
  return (
    <Field label={t.paramLabel}>
      <div className="flex items-center gap-2">
        {t.prefix ? (
          <span className="text-sm text-text-secondary">{t.prefix}</span>
        ) : null}
        <Input
          type="number"
          min={1}
          value={draft.threshold}
          onChange={(e) => set("threshold")(e.target.value)}
          className="w-32"
        />
        {t.suffix || t.unit ? (
          <span className="text-sm text-text-secondary">
            {t.suffix || t.unit}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

export default AlertsSection;
