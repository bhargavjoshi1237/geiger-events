"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CalendarClock,
  Contact,
  CreditCard,
  DoorOpen,
  History,
  Info,
  Link2,
  Loader2,
  Replace,
  Save,
  ShieldOff,
  Undo2,
  Unlink,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { LogoLoading, Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { EmptyState, Field, StatusPill } from "@/components/internal/shared/screen_kit";
import {
  assignBadges,
  listBadgeHistory,
  listBadgeTaps,
  replaceBadge,
  setBadgeStatus,
  unbindBadge,
  updateBadgeNotes,
} from "@/lib/supabase/smart_badges";
import { holderPayload } from "@/lib/smart_badges/roster";
import { buildTimeline, summarizeTimeline } from "@/lib/smart_badges/timeline";
import { formatMoney } from "../constants";
import { AttendeePicker } from "./attendee_picker";
import { UidCapture } from "./uid_capture";
import {
  BADGE_STATUS_MAP,
  BIND_ERRORS,
  OUTCOME_MAP,
  badgeTitle,
  formatDateTime,
  holderOf,
} from "./constants";

const PURPOSE_ICONS = {
  gate: DoorOpen,
  session: CalendarClock,
  lead: Contact,
  payment: CreditCard,
  info: Info,
};

const HISTORY_ICONS = {
  bound: Link2,
  rebound: Link2,
  unbound: Unlink,
  replaced: Replace,
};

const REPLACE_REASONS = ["Lost", "Damaged", "Name change", "Upgrade"];

function StatLine({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function TimelineRow({ entry }) {
  const Icon =
    entry.type === "tap"
      ? PURPOSE_ICONS[entry.purpose] || Info
      : entry.type === "rejected"
        ? Ban
        : HISTORY_ICONS[entry.kind] || History;
  const charged = entry.type === "tap" && (entry.chargeStatus === "pending" || entry.chargeStatus === "settled");
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border ${
          entry.type === "rejected" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-surface-subtle text-text-secondary"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{entry.title}</p>
        {entry.detail ? <p className="mt-0.5 truncate text-xs text-text-secondary">{entry.detail}</p> : null}
        <p className="mt-0.5 text-[11px] text-text-tertiary">{formatDateTime(entry.at)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {entry.type === "tap" ? <StatusPill status={entry.outcome} map={OUTCOME_MAP} /> : null}
        {entry.type === "rejected" ? <StatusPill status="rejected" map={OUTCOME_MAP} /> : null}
        {charged ? (
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {formatMoney(entry.amountCents, entry.currency)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusDialog({ target, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  const copy = {
    lost: {
      title: "Mark badge lost",
      body: "Readers refuse it from now on and every refused tap is logged here. Replace it to give the holder a new chip.",
      cta: "Mark lost",
    },
    revoked: {
      title: "Revoke badge",
      body: "Readers refuse it from now on. Use this for confiscated or misused badges.",
      cta: "Revoke",
    },
  }[target] || { title: "", body: "", cta: "" };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Field label="Reason" hint="Optional — shown in the badge's history.">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={target === "lost" ? "e.g. Reported at the info desk" : "e.g. Badge sharing"}
            className="bg-surface-card"
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            disabled={busy}
            onClick={() => onConfirm(target, reason)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceDialog({ open, badge, holder, onClose, onReplaced }) {
  const [reason, setReason] = useState("Lost");
  const [busy, setBusy] = useState(false);

  const capture = async (uid) => {
    setBusy(true);
    const res = await replaceBadge(badge.id, uid, reason);
    setBusy(false);
    if (!res) {
      toast.error("Couldn't replace the badge.");
      return;
    }
    if (!res.ok) {
      toast.error(BIND_ERRORS[res.reason] || "Couldn't replace the badge.");
      return;
    }
    toast.success(`${holder?.name || "Holder"} is now on ${uid}. The old badge is refused at readers.`);
    onReplaced(res.badge_id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace badge</DialogTitle>
          <DialogDescription>
            Tap the new badge. It takes over {holder?.name || "this holder"}, and {badgeTitle(badge)} is marked
            replaced — taps on it are refused and logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Why">
            <div className="flex flex-wrap gap-2">
              {REPLACE_REASONS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant="outline"
                  onClick={() => setReason(r)}
                  className={
                    reason === r
                      ? "border-foreground/30 bg-surface-active text-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  }
                >
                  {r}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="New badge">
            {open ? <UidCapture onCapture={capture} busy={busy} actionLabel="Replace" focusKey={open} /> : null}
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BadgeDrawerBody({ badge, badges, batches, pointsById, roster, rosterByKey, liveByHolder, eventId, onChanged, onOpenBadge }) {
  const [taps, setTaps] = useState(null);
  const [history, setHistory] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notes, setNotes] = useState(badge.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listBadgeTaps(badge.id), listBadgeHistory(badge.id)]).then(([t, h]) => {
      if (!alive) return;
      setTaps(t ?? []);
      setHistory(h ?? []);
    });
    return () => {
      alive = false;
    };
  }, [badge.id, reloadKey]);

  const holder = holderOf(badge, rosterByKey);
  const batch = batches.find((b) => b.id === badge.batchId) || null;
  const replacedBy = badge.replacedBy ? badges.find((b) => b.id === badge.replacedBy) : null;
  const replaces = badge.replacesId ? badges.find((b) => b.id === badge.replacesId) : null;
  const loading = taps === null || history === null;

  const timeline = useMemo(
    () => buildTimeline({ taps: taps || [], history: history || [], points: pointsById }),
    [taps, history, pointsById],
  );
  const summary = useMemo(() => summarizeTimeline(taps || []), [taps]);
  const currency = (taps || []).find((t) => t.amountCents)?.currency || "usd";

  const refresh = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  const changeStatus = async (status, reason = "") => {
    setBusy(true);
    const res = await setBadgeStatus(badge.id, status, reason);
    setBusy(false);
    setStatusTarget(null);
    if (!res?.ok) {
      toast.error(BIND_ERRORS[res?.reason] || "Couldn't update the badge.");
      return;
    }
    toast.success(
      status === "active" ? "Badge reactivated." : status === "lost" ? "Badge marked lost." : "Badge revoked.",
    );
    refresh();
  };

  const unbind = async () => {
    setBusy(true);
    const saved = await unbindBadge(badge);
    setBusy(false);
    if (!saved) {
      toast.error("Couldn't unbind the badge.");
      return;
    }
    toast.success("Badge returned to the spare pool.");
    refresh();
  };

  const bindTo = async (person) => {
    const live = liveByHolder.get(person.key) || [];
    if (live.length) {
      toast.error(`${person.name} already holds ${badgeTitle(live[0])}. Replace that badge instead.`);
      return;
    }
    setBusy(true);
    const res = await assignBadges(eventId, [{ badge_id: badge.id, ...holderPayload(person) }]);
    setBusy(false);
    if (!res?.ok || !res.assigned) {
      toast.error("Couldn't bind the badge.");
      return;
    }
    toast.success(`Bound to ${person.name}.`);
    refresh();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const saved = await updateBadgeNotes(badge.id, notes);
    setSavingNotes(false);
    if (saved) {
      toast.success("Notes saved.");
      onChanged();
    } else toast.error("Couldn't save the notes.");
  };

  const ghost = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="font-mono text-base">{badgeTitle(badge)}</SheetTitle>
        <div className="flex items-center justify-between gap-3">
          <SheetDescription className="truncate">
            {[badge.serial && badge.uid ? `UID ${badge.uid}` : null, !badge.uid ? "UID pending" : null, batch?.name]
              .filter(Boolean)
              .join(" · ") || "No batch"}
          </SheetDescription>
          <StatusPill status={badge.status} map={BADGE_STATUS_MAP} />
        </div>
      </SheetHeader>

      <div className="space-y-4 px-5 py-4">
        {holder ? (
          <div className="rounded-lg border border-border bg-surface-card px-4 py-3">
            <p className="font-medium text-foreground">{holder.name}</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {[holder.email, [holder.title, holder.company].filter(Boolean).join(", ")].filter(Boolean).join(" · ") ||
                "No contact details"}
            </p>
            {holder.tier || holder.role || holder.code ? (
              <p className="mt-1 text-xs text-text-tertiary">
                {[holder.role, holder.tier, holder.code].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : badge.status === "unassigned" ? (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Spare badge — pick who it belongs to.</p>
            <AttendeePicker roster={roster} liveByHolder={liveByHolder} onSelect={bindTo} limit={5} />
          </div>
        ) : null}

        {replacedBy || replaces ? (
          <div className="space-y-1 text-xs text-text-secondary">
            {replacedBy ? (
              <p>
                Replaced by{" "}
                <button type="button" className="font-mono text-foreground underline" onClick={() => onOpenBadge(replacedBy.id)}>
                  {badgeTitle(replacedBy)}
                </button>
              </p>
            ) : null}
            {replaces ? (
              <p>
                Replaces{" "}
                <button type="button" className="font-mono text-foreground underline" onClick={() => onOpenBadge(replaces.id)}>
                  {badgeTitle(replaces)}
                </button>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {badge.status === "active" ? (
            <>
              <Button size="sm" variant="outline" className={ghost} disabled={busy} onClick={() => setStatusTarget("lost")}>
                <ShieldOff className="h-4 w-4" /> Mark lost
              </Button>
              <Button size="sm" variant="outline" className={ghost} disabled={busy} onClick={() => setStatusTarget("revoked")}>
                <Ban className="h-4 w-4" /> Revoke
              </Button>
            </>
          ) : null}
          {badge.status === "lost" || badge.status === "revoked" ? (
            <Button size="sm" variant="outline" className={ghost} disabled={busy} onClick={() => changeStatus("active")}>
              <Undo2 className="h-4 w-4" /> Reactivate
            </Button>
          ) : null}
          {holder && ["active", "lost", "revoked"].includes(badge.status) ? (
            <Button size="sm" variant="outline" className={ghost} disabled={busy} onClick={() => setReplacing(true)}>
              <Replace className="h-4 w-4" /> Replace
            </Button>
          ) : null}
          {badge.status === "active" && holder ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={unbind}>
              <Unlink className="h-4 w-4" /> Unbind
            </Button>
          ) : null}
          {badge.status === "unassigned" ? (
            <Button size="sm" variant="outline" className={ghost} disabled={busy} onClick={() => setStatusTarget("revoked")}>
              <Ban className="h-4 w-4" /> Revoke
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatLine label="Taps" value={loading ? "—" : summary.taps} />
          <StatLine label="Entries" value={loading ? "—" : summary.entries} />
          <StatLine label="Sessions" value={loading ? "—" : summary.sessions} />
          <StatLine label="Leads" value={loading ? "—" : summary.leads} />
        </div>
        {summary.spentCents ? (
          <p className="text-xs text-text-secondary">
            {formatMoney(summary.spentCents, currency)} charged to this badge at payment points.
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="activity" className="gap-0 px-5 pb-6">
        <TabsList className="w-full">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-3 pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <LogoLoading size={40} label="Loading activity" />
            </div>
          ) : timeline.length ? (
            <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
              {timeline.map((entry) => (
                <TimelineRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No activity yet"
              description="Taps at gates, sessions and exhibitor stands appear here as they happen."
            />
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4 pt-4">
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-card text-sm">
            {[
              ["Chip UID", badge.uid || "Pending", true],
              ["Serial", badge.serial || "—", true],
              ["Batch", batch?.name || "—"],
              ["Issued", formatDateTime(badge.issuedAt) || "—"],
              ["Bound", formatDateTime(badge.boundAt) || "—"],
            ].map(([label, value, mono]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-text-secondary">{label}</span>
                <span className={`truncate text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
              </div>
            ))}
          </div>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Collected from lost property, name reprinted"
              className="h-28 bg-surface-card"
            />
          </Field>
          <Button
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={savingNotes || notes === (badge.notes || "")}
            onClick={saveNotes}
          >
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save notes
          </Button>
        </TabsContent>
      </Tabs>

      <StatusDialog
        key={statusTarget || "status-closed"}
        target={statusTarget}
        busy={busy}
        onClose={() => setStatusTarget(null)}
        onConfirm={changeStatus}
      />
      <ReplaceDialog
        open={replacing}
        badge={badge}
        holder={holder}
        onClose={() => setReplacing(false)}
        onReplaced={(newId) => {
          setReplacing(false);
          // Open the new badge once the list holds it, so the drawer hops straight to it.
          Promise.resolve(onChanged()).then(() => {
            if (newId) onOpenBadge(newId);
          });
        }}
      />
    </>
  );
}

export function BadgeDrawer({ badge, onOpenChange, ...rest }) {
  return (
    <Sheet open={!!badge} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {badge ? <BadgeDrawerBody key={badge.id} badge={badge} {...rest} /> : null}
      </SheetContent>
    </Sheet>
  );
}

export default BadgeDrawer;
