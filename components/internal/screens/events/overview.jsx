"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Ticket,
  Wallet,
  Users,
  CalendarClock,
  UserCog,
  ExternalLink,
  IdCard,
  MapPin,
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
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Checkbox } from "@geiger/ui/checkbox";
import { ScrollArea } from "@geiger/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { getEventNotes, saveEventNotes } from "@/lib/supabase/notes";
import { EventDatePicker } from "./date_time_fields";
import { EventPassShowcase } from "./event_badge";
import {
  EVENT_STATUS_MAP,
  EVENT_TYPE_MAP,
  currency,
  formatDate,
} from "./sample_data";

const OVERVIEW_STATUS = ["Draft", "Scheduled", "On sale", "Sold out", "Ended"];
const OVERVIEW_VISIBILITY = ["Public", "Unlisted", "Private"];

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

function ProgressFill({ pct }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const EMPTY_NOTE_DRAFT = { text: "", dueDate: "" };

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
          <DialogTitle className="capitalize">Add checklist item</DialogTitle>
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
          <Field label="Due date" hint="Optional">
            <EventDatePicker
              value={draft.dueDate}
              onChange={set("dueDate")}
              placeholder="Pick a due date"
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
            className="bg-primary capitalize text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Add Item
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
      bare
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
          className="bg-primary capitalize text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      }
    >
      {notes.length ? (
        <div className="mb-4">
          <ProgressFill pct={ready} />
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading checklist…
        </div>
      ) : notes.length ? (
        <ScrollArea className="h-[148px]">
          <div className="space-y-0.5 pr-3">
            {notes.map((n) => {
            const overdue =
              n.dueDate && !n.done && (daysUntilEvent(n.dueDate) ?? 1) < 0;
            return (
              <div
                key={n.id}
                className="group -mx-3 flex min-h-[32px] items-center gap-3 rounded-lg px-3 py-1 transition-colors hover:bg-surface-active"
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteNote(n.id)}
                  aria-label="Delete checklist item"
                  className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
  onPatch,
  onCommit,
  onNavigate,
  onViewLive,
}) {
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
    { label: "Tickets sold", value: sold.toLocaleString("en-US"), icon: Ticket, hint: `${remaining.toLocaleString("en-US")} of ${capacity.toLocaleString("en-US")} left` },
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

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />

      <SectionCard
        bare
        title="Status & sharing"
        description="Control how this event is published and who can find it."
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
      </SectionCard>

      <SectionCard
        bare
        title="At a glance"
        className="pt-4"
        action={
          <div className="flex items-center gap-2">
            <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
              {event.type}
            </Badge>
            <StatusPill status={event.status} map={EVENT_STATUS_MAP} />
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={onViewLive}
            >
              <ExternalLink className="h-4 w-4" /> Live
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
          <GlanceRow
            icon={CalendarClock}
            label={
              [formatDate(event.date), event.time].filter(Boolean).join(" · ") ||
              "No date set"
            }
          />
          <GlanceRow
            icon={Users}
            label={`${capacity.toLocaleString("en-US")} capacity`}
          />
          <GlanceRow
            icon={MapPin}
            label={`${event.venue}${event.city && event.city !== "Remote" ? `, ${event.city}` : ""}`}
          />
          <GlanceRow icon={UserCog} label={event.organizer} />
        </div>
      </SectionCard>

      <EventPassShowcase
        event={event}
        className="pt-4"
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onNavigate?.("badge")}
          >
            <IdCard className="h-4 w-4" /> Badge printing
          </Button>
        }
      />

      <PreLaunchNotes eventId={event.id} className="border-t border-border pt-6" />
    </div>
  );
}

export default OverviewSection;
