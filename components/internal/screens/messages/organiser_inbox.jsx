"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Megaphone,
  MessagesSquare,
  RotateCcw,
  Send,
} from "lucide-react";

import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProject } from "@/context/project-context";
import {
  listThreads,
  getThread,
  replyToThread,
  setThreadStatus,
  broadcastToAudience,
} from "@/lib/supabase/messages";
import { AudienceField } from "@/components/internal/shared/audience/audience_field";
import { normalizeSpec, isEmptyFilters } from "@/lib/audience/resolve";
import {
  THREAD_STATUS_MAP,
  STATUS_FILTER_OPTIONS,
  formatDateTime,
} from "./constants";

// Avatar-ish monogram from the buyer's name/email.
function monogram(name, email) {
  const src = (name || "").trim() || (email || "").trim();
  return (src ? src[0] : "?").toUpperCase();
}

function ThreadRow({ t, onOpen }) {
  const who = t.memberName || t.memberEmail || "Attendee";
  const context = [t.eventName, t.orderId ? "order" : null].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold text-foreground">
        {monogram(t.memberName, t.memberEmail)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
          <p
            className={`truncate text-sm ${
              t.unread ? "font-semibold text-foreground" : "font-medium text-foreground"
            }`}
          >
            {t.subject}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          <span className="text-text-tertiary">{who}</span>
          {t.preview ? ` — ${t.preview}` : ""}
        </p>
        {context ? (
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">{context}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill status={t.status} map={THREAD_STATUS_MAP} />
        <span className="text-[11px] text-text-tertiary">{formatDateTime(t.lastMessageAt)}</span>
      </div>
    </button>
  );
}

function ThreadDetail({ threadId, onBack, onChanged }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getThread(threadId).then((t) => {
      if (!alive) return;
      setThread(t);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    const text = body.trim();
    setBusy(true);
    // Optimistic append.
    const optimistic = {
      id: crypto.randomUUID(),
      sender: "organiser",
      body: text,
      createdAt: new Date().toISOString(),
    };
    setThread((t) => (t ? { ...t, messages: [...t.messages, optimistic] } : t));
    setBody("");
    const saved = await replyToThread(threadId, text);
    setBusy(false);
    if (!saved) {
      setThread((t) =>
        t ? { ...t, messages: t.messages.filter((m) => m.id !== optimistic.id) } : t,
      );
      setBody(text);
      toast.error("Couldn't send your reply.");
      return;
    }
    setThread((t) =>
      t
        ? { ...t, messages: t.messages.map((m) => (m.id === optimistic.id ? saved : m)) }
        : t,
    );
    onChanged?.();
  };

  const toggleStatus = async () => {
    if (!thread || statusBusy) return;
    const next = thread.status === "closed" ? "open" : "closed";
    setStatusBusy(true);
    setThread((t) => (t ? { ...t, status: next } : t));
    const ok = await setThreadStatus(threadId, next);
    setStatusBusy(false);
    if (!ok) {
      setThread((t) => (t ? { ...t, status: thread.status } : t));
      toast.error("Couldn't update the thread.");
      return;
    }
    toast.success(next === "closed" ? "Thread closed." : "Thread reopened.");
    onChanged?.();
  };

  if (loading) {
    return (
      <MainScreenWrapper>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </MainScreenWrapper>
    );
  }

  if (!thread) {
    return (
      <MainScreenWrapper>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Messages
        </button>
        <EmptyState
          icon={MessagesSquare}
          title="Thread not found"
          description="This conversation may have been removed."
        />
      </MainScreenWrapper>
    );
  }

  const who = thread.memberName || thread.memberEmail || "Attendee";
  const closed = thread.status === "closed";

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Messages
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {thread.subject}
            </h1>
            <StatusPill status={thread.status} map={THREAD_STATUS_MAP} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {who}
            {thread.memberName && thread.memberEmail ? ` · ${thread.memberEmail}` : ""}
            {thread.eventName ? ` · ${thread.eventName}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={statusBusy}
          onClick={toggleStatus}
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {closed ? (
            <>
              <RotateCcw className="h-4 w-4" /> Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Mark resolved
            </>
          )}
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
          {thread.messages.map((m) => {
            const mine = m.sender === "organiser";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-text-tertiary"
                    }`}
                  >
                    {mine ? "You" : who} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={closed ? "Reply to reopen the conversation…" : "Reply to the attendee…"}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={busy || !body.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </MainScreenWrapper>
  );
}

// Compose a targeted broadcast to buyers — pick an audience (ticket / offering /
// add-on / tag / segment / individual) and a message; each recipient gets it as a
// thread in their members portal.
function BroadcastDialog({ open, onOpenChange, projectId, onSent }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [spec, setSpec] = useState(() => normalizeSpec({ scope: "project", mode: "all" }));
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setSubject("");
    setBody("");
    setSpec(normalizeSpec({ scope: "project", mode: "all" }));
  };

  const submit = async () => {
    if (!body.trim()) {
      toast.error("Write a message to send.");
      return;
    }
    if (spec.mode === "filtered" && isEmptyFilters(spec.filters) && !spec.include.length) {
      toast.error("Choose who to send to, or switch to All.");
      return;
    }
    setBusy(true);
    const count = await broadcastToAudience({ projectId, spec, subject, body });
    setBusy(false);
    if (count > 0) {
      toast.success(`Sent to ${count} ${count === 1 ? "buyer" : "buyers"}.`);
      reset();
      onOpenChange(false);
      onSent?.();
    } else {
      toast.error("No one received this — matched buyers may not have a portal account yet.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New broadcast</DialogTitle>
          <DialogDescription>
            Message a targeted set of buyers. Each person receives it as a thread in their
            members portal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Subject" hint="Optional — shown as the thread title.">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. An update about your tickets"
            />
          </Field>
          <Field
            label="Audience"
            hint="Everyone, or a subset by ticket type, offering, add-on, tag, segment, or specific people."
          >
            <AudienceField projectId={projectId} value={spec} onChange={setSpec} />
          </Field>
          <Field label="Message">
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
            />
          </Field>
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
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrganiserInboxScreen() {
  const { projectId } = useProject();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Background refresh for event handlers (no loading flip — the list is already
  // shown). Only sets state in the async continuation.
  const refresh = () =>
    listThreads(projectId).then((rows) => {
      setThreads(rows ?? []);
      setLoading(false);
    });

  useEffect(() => {
    let alive = true;
    listThreads(projectId).then((rows) => {
      if (!alive) return;
      setThreads(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!q) return true;
      return (
        (t.subject || "").toLowerCase().includes(q) ||
        (t.memberEmail || "").toLowerCase().includes(q) ||
        (t.memberName || "").toLowerCase().includes(q) ||
        (t.eventName || "").toLowerCase().includes(q) ||
        (t.preview || "").toLowerCase().includes(q)
      );
    });
  }, [threads, search, status]);

  const unreadCount = useMemo(() => threads.filter((t) => t.unread).length, [threads]);

  if (openId) {
    return (
      <ThreadDetail
        threadId={openId}
        onBack={() => {
          setOpenId(null);
          refresh();
        }}
        onChanged={refresh}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Messages"
        description="Conversations your attendees started from their tickets and orders. Reply directly — they'll see it in their members portal."
        actions={
          <Button
            onClick={() => setBroadcastOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Megaphone className="h-4 w-4" /> New broadcast
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterDropdown value={status} options={STATUS_FILTER_OPTIONS} onValueChange={setStatus} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search messages…"
          className="sm:max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !threads.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title="No messages yet"
            description="When an attendee messages you from their portal about a ticket or order, the conversation shows up here."
          />
        </div>
      ) : filtered.length ? (
        <div className="space-y-2">
          {unreadCount ? (
            <p className="text-xs text-text-tertiary">
              {unreadCount} unread {unreadCount === 1 ? "thread" : "threads"}
            </p>
          ) : null}
          {filtered.map((t) => (
            <ThreadRow key={t.id} t={t} onOpen={(x) => setOpenId(x.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title="No matching messages"
            description="Try a different search or clear the status filter."
          />
        </div>
      )}

      <BroadcastDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        projectId={projectId}
        onSent={refresh}
      />
    </MainScreenWrapper>
  );
}

export default OrganiserInboxScreen;
