"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Ticket,
  Wallet,
  Users,
  CalendarClock,
  Palette,
  ImageIcon,
  ClipboardList,
  UserCog,
  Link2,
  Copy,
  ExternalLink,
  MapPin,
  Eye,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

import {
  Field,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getEventNotes, saveEventNotes } from "@/lib/supabase/notes";
import {
  EVENT_STATUS_MAP,
  EVENT_TYPE_MAP,
  currency,
  formatDate,
} from "./sample_data";

const OVERVIEW_STATUS = ["Draft", "Scheduled", "On sale", "Sold out", "Ended"];
const OVERVIEW_VISIBILITY = ["Public", "Unlisted", "Private"];

// Whole days between today and the event date (negative = in the past).
function daysUntilEvent(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function GlanceRow({ icon: Icon, label }) {
  return (
    <p className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
      <span className="min-w-0 truncate">{label}</span>
    </p>
  );
}

// Editable pre-launch checklist. Items are user-authored notes that can be
// checked off; the whole list persists to public.flow_event_notes (one JSON row
// per event) through the notes data layer. Optimistic: local state updates
// first, the write follows. Degrades to local-only when Supabase is absent.
const EMPTY_NOTE_DRAFT = { text: "", dueDate: "" };

// Dialog to author a new checklist item — a required label plus an optional due
// date. Matches the suite's create-dialog rhythm (grid of Field-wrapped controls
// + ghost Cancel / primary Add).
function AddNoteDialog({ open, onOpenChange, onAdd }) {
  const [draft, setDraft] = useState(EMPTY_NOTE_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.text.trim()) {
      toast.error("Give the item a name first.");
      return;
    }
    onAdd({ text: draft.text.trim(), dueDate: draft.dueDate });
    setDraft(EMPTY_NOTE_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Add checklist item</DialogTitle>
          <DialogDescription>
            A step to complete before this event goes live. Set a due date to
            keep it on track.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Item" htmlFor="note-text">
            <Input
              id="note-text"
              value={draft.text}
              onChange={(e) => set("text")(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. Finalise the cover image"
              autoFocus
            />
          </Field>
          <Field label="Due date" hint="Optional" htmlFor="note-due">
            <Input
              id="note-due"
              type="date"
              value={draft.dueDate}
              onChange={(e) => set("dueDate")(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreLaunchNotes({ eventId, className }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingDb, setUsingDb] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getEventNotes(eventId).then((rows) => {
      if (!alive) return;
      // An array (even empty) means the table is reachable; null means no DB.
      if (rows) {
        setNotes(rows);
        setUsingDb(true);
      } else {
        setNotes([]);
        setUsingDb(false);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [eventId]);

  const persist = (next) => {
    setNotes(next);
    if (usingDb) {
      saveEventNotes(eventId, next).then((ok) => {
        if (!ok) toast.error("Couldn't save your checklist to the server.");
      });
    }
  };

  const addNote = ({ text, dueDate }) =>
    persist([
      ...notes,
      { id: `note_${Date.now()}`, text, done: false, dueDate: dueDate || "" },
    ]);
  const toggleNote = (id) =>
    persist(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  const deleteNote = (id) => persist(notes.filter((n) => n.id !== id));

  const doneCount = notes.filter((n) => n.done).length;
  const ready = notes.length ? Math.round((doneCount / notes.length) * 100) : 0;

  return (
    <SectionCard
      title="Pre-launch checklist"
      description={
        notes.length
          ? `${doneCount} of ${notes.length} done`
          : "Track the steps to get this event live"
      }
      className={className}
      action={
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      }
    >
      {notes.length ? (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-[#ededed] transition-all"
            style={{ width: `${ready}%` }}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading checklist…
        </div>
      ) : notes.length ? (
        // Fixed window of ~4 rows; anything beyond scrolls inside this area.
        <ScrollArea className="h-[148px]">
          <div className="space-y-0.5 pr-3">
            {notes.map((n) => {
            const overdue =
              n.dueDate && !n.done && (daysUntilEvent(n.dueDate) ?? 1) < 0;
            return (
              <div
                key={n.id}
                className="group flex min-h-[32px] items-center gap-3 rounded-lg px-3 py-1 transition-colors hover:bg-surface-active"
              >
                <Checkbox
                  checked={n.done}
                  onCheckedChange={() => toggleNote(n.id)}
                  aria-label={n.done ? "Mark as not done" : "Mark as done"}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      n.done
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {n.text}
                  </p>
                  {n.dueDate ? (
                    <p
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-xs",
                        overdue ? "text-red-400" : "text-text-tertiary",
                      )}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {overdue ? "Overdue · " : "Due "}
                      {formatDate(n.dueDate)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => deleteNote(n.id)}
                  aria-label="Delete checklist item"
                  className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          </div>
        </ScrollArea>
      ) : (
        <p className="py-6 text-center text-sm text-text-secondary">
          No items yet — add your first pre-launch step.
        </p>
      )}

      <AddNoteDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addNote} />
    </SectionCard>
  );
}

export function OverviewSection({
  event,
  onPreview,
  onPatch,
  onCommit,
  onViewLive,
  onNavigate,
}) {
  // Overview controls take effect immediately — `commit` persists right away
  // (DB + list); `patch` (live, save-on-Save) is the fallback if no committer.
  const commit = onCommit || onPatch || (() => {});

  const capacity = event.capacity || 0;
  const sold = event.sold || 0;
  const revenue = event.revenue || 0;
  const pct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const remaining = Math.max(0, capacity - sold);
  const avgPrice = sold > 0 ? Math.round(revenue / sold) : 0;
  const days = daysUntilEvent(event.date);

  const daysValue =
    days == null ? "—" : days < 0 ? "Ended" : days === 0 ? "Today" : String(days);
  const daysHint =
    days == null
      ? "No date set"
      : days < 0
        ? "in the past"
        : days === 0
          ? "happening today"
          : "days to go";

  const stats = [
    { label: "Tickets sold", value: sold.toLocaleString(), icon: Ticket, hint: `${remaining.toLocaleString()} of ${capacity.toLocaleString()} left` },
    { label: "Revenue", value: currency(revenue), icon: Wallet, hint: avgPrice ? `~${currency(avgPrice)} / ticket` : "Gross, before fees" },
    { label: "Sell-through", value: `${pct}%`, icon: Users, hint: "Seats filled" },
    { label: "Days to go", value: daysValue, icon: CalendarClock, hint: daysHint },
  ];

  const setStatus = (status) => {
    commit({ status });
    toast.success(`Status set to "${status}".`);
  };
  const setVisibility = (visibility) => {
    commit({ visibility });
    toast.success(`Visibility set to ${visibility}.`);
  };

  const copyLink = () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(
        `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/e/${event.id}`,
      )
      .then(
        () => toast.success("Public link copied."),
        () => toast.error("Couldn't copy the link."),
      );
  };

  const quickActions = [
    { label: "Ticket types", icon: Ticket, to: "tickets" },
    { label: "Page design", icon: Palette, to: "design" },
    { label: "Cover media", icon: ImageIcon, to: "cover" },
    { label: "Registration", icon: ClipboardList, to: "questions" },
    { label: "Co-hosts & team", icon: UserCog, to: "team" },
  ];

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />

      {/* Two-up grid: each row pairs a wide control card with a narrow snapshot
          card, so Status & sharing ↔ At a glance and Pre-launch ↔ Quick actions
          stretch to equal heights per row. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px] xl:items-stretch">
        {/* Row 1, left — Status & sharing */}
        <SectionCard
          title="Status & sharing"
          description="Control how this event is published and who can find it."
          className="h-full"
        >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={event.status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERVIEW_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              EVENT_STATUS_MAP[s]?.dotClass || "bg-current",
                            )}
                          />
                          {s}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Visibility">
                <Select value={event.visibility} onValueChange={setVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERVIEW_VISIBILITY.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                /e/{event.id}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={copyLink}
                aria-label="Copy public link"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onViewLive}
                aria-label="Open public page"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
        </SectionCard>

        {/* Row 1, right — At a glance */}
        <SectionCard title="At a glance" className="h-full">
            <div className="flex items-center gap-2">
              <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
                {event.type}
              </Badge>
              <StatusPill status={event.status} map={EVENT_STATUS_MAP} />
            </div>
            <div className="mt-3 space-y-2.5 text-sm">
              <GlanceRow
                icon={CalendarClock}
                label={`${formatDate(event.date)} · ${event.time}`}
              />
              <GlanceRow
                icon={MapPin}
                label={`${event.venue}${event.city && event.city !== "Remote" ? `, ${event.city}` : ""}`}
              />
              <GlanceRow
                icon={Users}
                label={`${capacity.toLocaleString()} capacity`}
              />
              <GlanceRow icon={UserCog} label={event.organizer} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={onViewLive}
              >
                <ExternalLink className="h-4 w-4" /> Live
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={onPreview}
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </div>
        </SectionCard>

        {/* Row 2, left — Pre-launch checklist (editable, persisted notes) */}
        <PreLaunchNotes eventId={event.id} className="h-full" />

        {/* Row 2, right — Quick actions */}
        <SectionCard title="Quick actions" bodyPadding={false} className="h-full">
            <div className="p-2">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => onNavigate?.(a.to)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
                  >
                    <Icon className="h-4 w-4 text-text-secondary" />
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight className="h-4 w-4 text-text-tertiary" />
                  </button>
                );
              })}
            </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default OverviewSection;
