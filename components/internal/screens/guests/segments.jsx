"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listContacts, listGuests } from "@/lib/supabase/contacts";
import {
  listSegments,
  createSegment,
  updateSegment,
  softDeleteSegment,
  isSegmentMember,
} from "@/lib/supabase/segments";
import { getUser } from "@/lib/supabase/user";
import {
  CONTACT_STATUS_VALUES,
  SEGMENT_COLOR_MAP,
  SEGMENT_COLOR_OPTIONS,
  SEGMENT_OP_LABELS,
  SEGMENT_RULE_FIELDS,
  initials,
} from "./constants";

const FIELD_BY_VALUE = Object.fromEntries(
  SEGMENT_RULE_FIELDS.map((f) => [f.value, f]),
);

const emptyRule = () => ({ field: "status", op: "is", value: "Active" });

export function SegmentsScreen() {
  const [segments, setSegments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendingEmails, setAttendingEmails] = useState(new Set());
  const [eventsByEmail, setEventsByEmail] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [membersOf, setMembersOf] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([
      listSegments(projectId),
      listContacts(projectId),
      listEvents(projectId),
      listGuests(projectId),
    ]).then(([segs, cs, evs, guests]) => {
      if (!alive) return;
      setSegments(segs ?? []);
      setContacts(cs ?? []);
      setEvents(evs ?? []);
      const emails = new Set();
      const byEmail = new Map();
      for (const g of guests ?? []) {
        const key = String(g.email || "").toLowerCase();
        if (!key) continue;
        emails.add(key);
        byEmail.set(key, g.eventIds || []);
      }
      setAttendingEmails(emails);
      setEventsByEmail(byEmail);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const ctx = useMemo(
    () => ({ attendingEmails, eventsByEmail }),
    [attendingEmails, eventsByEmail],
  );

  const countMembers = (segment) =>
    contacts.filter((c) => isSegmentMember(segment, c, ctx)).length;

  const stats = useMemo(() => {
    const counts = segments.map((s) => countMembers(s));
    const largest = counts.length ? Math.max(...counts) : 0;
    const reachable = contacts.filter((c) =>
      segments.some((s) => isSegmentMember(s, c, ctx)),
    ).length;
    const avg = counts.length
      ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
      : 0;
    return [
      { label: "Segments", value: segments.length.toLocaleString() },
      { label: "Largest", value: largest.toLocaleString() },
      { label: "Reachable", value: reachable.toLocaleString() },
      { label: "Avg size", value: avg.toLocaleString() },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, contacts, ctx]);

  const openCreate = () => {
    setEditing({ name: "", description: "", color: "slate", rules: [emptyRule()] });
    setEditorOpen(true);
  };
  const openEdit = (seg) => {
    setEditing({ ...seg, rules: seg.rules.length ? seg.rules : [emptyRule()] });
    setEditorOpen(true);
  };

  const handleSave = (draft) => {
    const clean = {
      name: draft.name.trim() || "Untitled segment",
      description: draft.description || "",
      color: draft.color || "slate",
      rules: draft.rules || [],
    };
    if (draft.id) {
      setSegments((prev) =>
        prev.map((s) => (s.id === draft.id ? { ...s, ...clean } : s)),
      );
      updateSegment(draft.id, clean).then((res) => {
        if (res === false) toast.error("Couldn't save the segment.");
      });
      toast.success("Segment updated.");
    } else {
      const seg = {
        id: crypto.randomUUID(),
        projectId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        ...clean,
      };
      setSegments((prev) => [seg, ...prev]);
      toast.success("Segment created.");
      createSegment(seg).then((saved) => {
        if (saved === null) return;
        if (!saved) toast.error("Couldn't save the segment.");
        else setSegments((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      });
    }
    setEditorOpen(false);
    setEditing(null);
  };

  const handleDelete = (seg) => {
    setSegments((prev) => prev.filter((s) => s.id !== seg.id));
    toast.success("Segment deleted.");
    softDeleteSegment(seg.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const members = membersOf
    ? contacts.filter((c) => isSegmentMember(membersOf, c, ctx))
    : [];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Segments"
        description="Saved audience filters. Membership recomputes live as your contacts change — build a rule, reuse it anywhere."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New segment
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading segments…
        </div>
      ) : segments.length ? (
        <div className="grid gap-3">
          {segments.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              count={countMembers(seg)}
              onView={() => setMembersOf(seg)}
              onEdit={() => openEdit(seg)}
              onDelete={() => setDeleteTarget(seg)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ListChecks}
            title="No segments yet"
            description="Group your contacts by status, tags, consent, or event attendance — then reuse the segment for exports and campaigns."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> New segment
              </Button>
            }
          />
        </div>
      )}

      <SegmentEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        events={events}
        onSave={handleSave}
      />

      {/* Members panel */}
      <Sheet open={!!membersOf} onOpenChange={(o) => !o && setMembersOf(null)}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{membersOf?.name}</SheetTitle>
            <SheetDescription>
              {members.length} {members.length === 1 ? "member" : "members"} · live
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            {members.length ? (
              <div className="space-y-1.5">
                {members.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-xs font-semibold text-foreground">
                      {initials(c.name, c.email) || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.name || "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {c.email || "No email"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-text-tertiary">
                No contacts match this segment yet.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete segment</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? Your contacts aren&apos;t affected — only this saved filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

function SegmentCard({ segment, count, onView, onEdit, onDelete }) {
  const rules = segment.rules || [];
  return (
    <div className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4 transition-colors hover:border-border-strong hover:bg-surface-hover">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary transition-colors group-hover:text-foreground">
        <ListChecks className="h-5 w-5" />
      </div>
      <div className="w-px self-stretch bg-border" />

      <button
        type="button"
        onClick={onView}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
                SEGMENT_COLOR_MAP[segment.color] || SEGMENT_COLOR_MAP.slate,
              )}
            />
            <span className="truncate font-medium text-foreground">
              {segment.name}
            </span>
          </div>
          {segment.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
              {segment.description}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {rules.slice(0, 3).map((r, i) => (
              <Badge key={i} variant="neutral">
                {FIELD_BY_VALUE[r.field]?.label || r.field}
              </Badge>
            ))}
            {rules.length > 3 ? (
              <span className="text-xs text-text-tertiary">
                +{rules.length - 3}
              </span>
            ) : null}
            {rules.length === 0 ? (
              <span className="text-xs text-text-tertiary">All contacts</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-lg font-semibold text-foreground tabular-nums">
            {count.toLocaleString()}
          </span>
          <p className="text-[11px] text-text-tertiary">
            {count === 1 ? "member" : "members"}
          </p>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-text-secondary hover:text-foreground"
            aria-label="Segment actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-border bg-surface-subtle text-foreground"
        >
          <DropdownMenuItem className="focus:bg-surface-hover" onClick={onView}>
            <Users className="h-4 w-4" /> View members
          </DropdownMenuItem>
          <DropdownMenuItem className="focus:bg-surface-hover" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit rules
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SegmentEditor({ open, onOpenChange, editing, events, onSave }) {
  const [draft, setDraft] = useState(null);
  const [seed, setSeed] = useState(null);

  // Re-seed the local draft whenever a different segment is opened.
  const editingKey = editing ? editing.id || "new" : null;
  if (open && editingKey !== seed) {
    setSeed(editingKey);
    setDraft(
      editing || { name: "", description: "", color: "slate", rules: [emptyRule()] },
    );
  }

  if (!draft) return null;

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const setRule = (i, patch) =>
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));

  const addRule = () =>
    setDraft((d) => ({ ...d, rules: [...d.rules, emptyRule()] }));
  const removeRule = (i) =>
    setDraft((d) => ({ ...d, rules: d.rules.filter((_, idx) => idx !== i) }));

  const changeField = (i, field) => {
    const def = FIELD_BY_VALUE[field];
    const op = def?.ops?.[0] || "is";
    let value = "";
    if (def?.input === "status") value = "Active";
    else if (def?.input === "bool") value = "true";
    else if (def?.input === "event") value = events[0]?.id || "";
    setRule(i, { field, op, value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit segment" : "New segment"}</DialogTitle>
          <DialogDescription>
            Contacts matching <span className="font-medium text-foreground">all</span>{" "}
            of these rules are members. Membership updates automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <Field label="Name" htmlFor="seg-name">
              <Input
                id="seg-name"
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. VIPs attending"
              />
            </Field>
            <Field label="Color">
              <Select value={draft.color} onValueChange={set("color")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <Input
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Rules</p>
            <div className="space-y-2">
              {draft.rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  events={events}
                  onChangeField={(field) => changeField(i, field)}
                  onChange={(patch) => setRule(i, patch)}
                  onRemove={() => removeRule(i)}
                  removable={draft.rules.length > 1}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={addRule}
            >
              <Plus className="h-4 w-4" /> Add rule
            </Button>
          </div>
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
            onClick={() => onSave(draft)}
          >
            {draft.id ? "Save segment" : "Create segment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow({ rule, events, onChangeField, onChange, onRemove, removable }) {
  const def = FIELD_BY_VALUE[rule.field] || SEGMENT_RULE_FIELDS[0];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card p-2">
      <Select value={rule.field} onValueChange={onChangeField}>
        <SelectTrigger className="w-40 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SEGMENT_RULE_FIELDS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={rule.op} onValueChange={(v) => onChange({ op: v })}>
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.ops.map((op) => (
            <SelectItem key={op} value={op}>
              {SEGMENT_OP_LABELS[op] || op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="min-w-0 flex-1">
        {def.input === "status" ? (
          <Select value={rule.value} onValueChange={(v) => onChange({ value: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : def.input === "bool" ? (
          <Select
            value={String(rule.value)}
            onValueChange={(v) => onChange({ value: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        ) : def.input === "event" ? (
          <Select value={rule.value} onValueChange={(v) => onChange({ value: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={rule.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value"
          />
        )}
      </div>

      <Button
        size="icon"
        variant="ghost"
        disabled={!removable}
        className="h-8 w-8 shrink-0 text-text-tertiary hover:text-red-300"
        onClick={onRemove}
        aria-label="Remove rule"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default SegmentsScreen;
