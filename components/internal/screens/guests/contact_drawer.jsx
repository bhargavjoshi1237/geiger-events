"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Loader2,
  Plus,
  ShieldBan,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  listContactActivity,
  logContactActivity,
} from "@/lib/supabase/contacts";
import {
  ACTIVITY_CHANNEL_MAP,
  ACTIVITY_CHANNEL_VALUES,
  CONTACT_STATUS_MAP,
  CONTACT_STATUS_VALUES,
  GUEST_STATUS_MAP,
  formatDate,
  formatDateTime,
  initials,
} from "./constants";

const OVERVIEW_FIELDS = [
  { key: "name", label: "Full name", placeholder: "e.g. Jordan Lee" },
  { key: "email", label: "Email", placeholder: "jordan@example.com" },
  { key: "phone", label: "Phone", placeholder: "Optional" },
  { key: "company", label: "Company", placeholder: "Optional" },
  { key: "title", label: "Job title", placeholder: "Optional" },
  { key: "location", label: "Location", placeholder: "City / region" },
];

// Full-height quick-look + edit panel for a single contact. Persistence is
// delegated to the host via onPatch/onDelete so the list stays in sync.
export function ContactDrawer({
  contact,
  projectId,
  userId,
  attendedEvents = [],
  onPatch,
  onDelete,
  onClose,
}) {
  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {contact ? (
          <ContactDrawerBody
            contact={contact}
            projectId={projectId}
            userId={userId}
            attendedEvents={attendedEvents}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ContactDrawerBody({
  contact,
  projectId,
  userId,
  attendedEvents,
  onPatch,
  onDelete,
}) {
  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border">
        <div className="flex items-center gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-sm font-semibold text-foreground">
            {initials(contact.name, contact.email) || "?"}
          </div>
          <div className="min-w-0">
            <SheetTitle className="flex items-center gap-2 truncate">
              <span className="truncate">{contact.name || "Unnamed"}</span>
              <StatusPill status={contact.status} map={CONTACT_STATUS_MAP} />
            </SheetTitle>
            <SheetDescription className="truncate">
              {contact.email || "No email"}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="scrollbar-subtle overflow-x-auto px-4 pt-4 pb-3">
          <TabsList>
            {[
              { value: "overview", label: "Overview" },
              { value: "tags-notes", label: "Tags & Notes" },
              { value: "activity", label: "Activity" },
              { value: "consent", label: "Consent" },
              { value: "events", label: "Events" },
            ].map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="overview" className="m-0 p-4">
            <OverviewTab contact={contact} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="tags-notes" className="m-0 p-4">
            <TagsNotesTab contact={contact} userId={userId} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="activity" className="m-0 p-4">
            <ActivityTab contact={contact} projectId={projectId} userId={userId} />
          </TabsContent>
          <TabsContent value="consent" className="m-0 p-4">
            <ConsentTab contact={contact} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="events" className="m-0 p-4">
            <EventsTab attendedEvents={attendedEvents} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex items-center justify-between border-t border-border p-4">
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            contact.blocked
              ? "text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-300"
              : "text-amber-300 hover:bg-amber-500/10 hover:text-amber-300",
          )}
          onClick={() =>
            onPatch(contact.id, { blocked: !contact.blocked })
          }
        >
          {contact.blocked ? (
            <>
              <ShieldCheck className="h-4 w-4" /> Unblock
            </>
          ) : (
            <>
              <ShieldBan className="h-4 w-4" /> Block
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => onDelete(contact)}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

// --- Overview: editable core fields ------------------------------------------
function OverviewTab({ contact, onPatch }) {
  const [draft, setDraft] = useState(contact);
  const [seed, setSeed] = useState(contact.id);
  if (contact.id !== seed) {
    setSeed(contact.id);
    setDraft(contact);
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const dirty = OVERVIEW_FIELDS.some((f) => (draft[f.key] || "") !== (contact[f.key] || ""));

  const save = () => {
    if (!String(draft.name || "").trim()) {
      toast.error("A contact needs a name.");
      return;
    }
    const patch = {};
    for (const f of OVERVIEW_FIELDS) {
      if ((draft[f.key] || "") !== (contact[f.key] || "")) patch[f.key] = draft[f.key];
    }
    onPatch(contact.id, patch);
  };

  return (
    <div className="space-y-4">
      <Field label="Status">
        <Select
          value={draft.status}
          onValueChange={(v) => {
            set("status")(v);
            onPatch(contact.id, { status: v });
          }}
        >
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
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {OVERVIEW_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            className={f.key === "name" ? "col-span-2" : undefined}
          >
            <Input
              value={draft[f.key] || ""}
              onChange={(e) => set(f.key)(e.target.value)}
              placeholder={f.placeholder}
            />
          </Field>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!dirty}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={save}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

// --- Tags & Notes ------------------------------------------------------------
function TagsNotesTab({ contact, userId, onPatch }) {
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if ((contact.tags || []).some((x) => x.toLowerCase() === t.toLowerCase())) {
      setTagInput("");
      return;
    }
    onPatch(contact.id, { tags: [...(contact.tags || []), t] });
    setTagInput("");
  };
  const removeTag = (t) =>
    onPatch(contact.id, {
      tags: (contact.tags || []).filter((x) => x !== t),
    });

  const addNote = () => {
    const body = noteInput.trim();
    if (!body) return;
    const note = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
      createdBy: userId || null,
    };
    const notes = [note, ...(contact.notes || [])];
    onPatch(contact.id, { metadata: { ...contact.metadata, notes } });
    setNoteInput("");
  };
  const removeNote = (id) => {
    const notes = (contact.notes || []).filter((n) => n.id !== id);
    onPatch(contact.id, { metadata: { ...contact.metadata, notes } });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          Tags
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(contact.tags || []).length ? (
            contact.tags.map((t) => (
              <Badge key={t} variant="neutral" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-text-tertiary hover:text-foreground"
                  aria-label={`Remove ${t}`}
                >
                  ×
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-text-tertiary">No tags yet.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add a tag…"
          />
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={addTag}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          Notes
        </p>
        <div className="mb-2 space-y-2">
          <Textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Add an internal note…"
            rows={2}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!noteInput.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={addNote}
            >
              Add note
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {(contact.notes || []).length ? (
            contact.notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-border bg-surface-card px-3 py-2"
              >
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {n.body}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-text-tertiary">
                    {formatDateTime(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNote(n.id)}
                    className="text-[11px] text-text-tertiary hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-tertiary">No notes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Activity (Communication History) ----------------------------------------
function ActivityTab({ contact, projectId, userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("Note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    listContactActivity(contact.id).then((rows) => {
      if (!alive) return;
      setItems(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [contact.id]);

  const log = async () => {
    if (!subject.trim() && !body.trim()) {
      toast.error("Add a subject or note first.");
      return;
    }
    setSaving(true);
    const optimistic = {
      id: crypto.randomUUID(),
      contactId: contact.id,
      channel,
      direction: channel === "Note" || channel === "System" ? "Internal" : "Outbound",
      subject: subject.trim(),
      body: body.trim(),
      occurredAt: new Date().toISOString(),
      createdBy: userId || null,
    };
    setItems((prev) => [optimistic, ...prev]);
    setSubject("");
    setBody("");
    const saved = await logContactActivity({ ...optimistic, projectId });
    setSaving(false);
    if (saved === null) return;
    if (!saved) {
      toast.error("Couldn't log the interaction.");
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
    } else {
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? saved : i)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border bg-surface-card p-3">
        <div className="flex gap-2">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_CHANNEL_VALUES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
          />
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened?"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={log}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Log interaction
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((it) => {
            const meta = ACTIVITY_CHANNEL_MAP[it.channel] || ACTIVITY_CHANNEL_MAP.Note;
            const Icon = meta.icon;
            return (
              <div
                key={it.id}
                className="flex gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tint)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {it.subject || meta.label}
                    </p>
                    <span className="shrink-0 text-[11px] text-text-tertiary">
                      {formatDateTime(it.occurredAt)}
                    </span>
                  </div>
                  {it.body ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-secondary">
                      {it.body}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-text-tertiary">
          No history yet. Log a call, email, or note above — automatic capture
          arrives with messaging.
        </p>
      )}
    </div>
  );
}

// --- Consent -----------------------------------------------------------------
function ConsentTab({ contact, onPatch }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Marketing email</p>
          <p className="text-xs text-text-secondary">
            Include in email campaigns and newsletters.
          </p>
        </div>
        <Switch
          checked={contact.consentEmail}
          onCheckedChange={(v) => onPatch(contact.id, { consentEmail: v })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">SMS messages</p>
          <p className="text-xs text-text-secondary">
            Allow transactional and marketing SMS.
          </p>
        </div>
        <Switch
          checked={contact.consentSms}
          onCheckedChange={(v) => onPatch(contact.id, { consentSms: v })}
        />
      </div>
      <p className="text-[11px] text-text-tertiary">
        {contact.consentUpdatedAt
          ? `Last updated ${formatDateTime(contact.consentUpdatedAt)}.`
          : "No consent recorded yet."}
      </p>
    </div>
  );
}

// --- Events attended ---------------------------------------------------------
function EventsTab({ attendedEvents }) {
  const sorted = useMemo(
    () =>
      [...attendedEvents].sort((a, b) =>
        (b.date || "").localeCompare(a.date || ""),
      ),
    [attendedEvents],
  );
  if (!sorted.length) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">
        Not registered for any events yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {sorted.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-text-tertiary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
            <p className="text-xs text-text-secondary">{formatDate(e.date)}</p>
          </div>
          {e.status ? (
            <StatusPill status={e.status} map={GUEST_STATUS_MAP} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default ContactDrawer;
