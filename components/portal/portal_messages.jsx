"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquarePlus, Send, MessagesSquare } from "lucide-react";

import { EmptyState, Field, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, fmtDateTime } from "./portal_kit";

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function Composer({ initial, onCancel, onCreated }) {
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return toast.error("Write a message first.");
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/threads", {
      subject,
      body,
      orderId: initial?.orderId || null,
    });
    setBusy(false);
    if (!ok || !data.thread) return toast.error(data.error || "Couldn't send.");
    toast.success("Message sent to the organiser.");
    onCreated(data.thread.id);
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-text-secondary hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">New message</p>
      </div>
      {initial?.contextLabel ? (
        <p className="mb-3 rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
          About: {initial.contextLabel}
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Subject">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
          />
        </Field>
        <Field label="Message">
          <Textarea
            rows={5}
            value={body}
            autoFocus
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message to the organiser…"
          />
        </Field>
        <Button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send message
        </Button>
      </form>
    </Card>
  );
}

function ThreadView({ threadId, onBack, onChanged }) {
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = () =>
    fetch(`/api/portal/threads/${threadId}`)
      .then((r) => r.json())
      .then((d) => setThread(d.thread || null))
      .catch(() => setThread(null));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const { ok, data } = await postJson(`/api/portal/threads/${threadId}/messages`, { body });
    setBusy(false);
    if (!ok || !data.message) return toast.error(data.error || "Couldn't send.");
    setBody("");
    setThread((t) => (t ? { ...t, messages: [...t.messages, data.message] } : t));
    onChanged?.();
  };

  if (!thread) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-text-secondary hover:text-foreground"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{thread.subject}</p>
          <p className="text-xs text-text-tertiary">
            {thread.status === "closed" ? "Closed" : "Open"} · started {fmtDateTime(thread.createdAt)}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface-card p-4">
        {thread.messages.map((m) => {
          const mine = m.sender === "member";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-hover text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    mine ? "text-primary-foreground/70" : "text-text-tertiary"
                  }`}
                >
                  {mine ? "You" : "Organiser"} · {fmtDateTime(m.createdAt)}
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
          placeholder="Reply…"
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
  );
}

export function PortalMessages({ threads = [], loading, initialCompose, onRefresh, onConsumeCompose }) {
  const [openId, setOpenId] = useState(null);
  const [composing, setComposing] = useState(Boolean(initialCompose));
  const [lastCompose, setLastCompose] = useState(initialCompose);

  // React-sanctioned "adjust state when a prop changes" (during render, no effect):
  // a "Message organiser" action from a ticket/order opens the composer prefilled.
  if (initialCompose !== lastCompose) {
    setLastCompose(initialCompose);
    if (initialCompose) {
      setComposing(true);
      setOpenId(null);
    }
  }

  const composeInitial = useMemo(() => initialCompose || null, [initialCompose]);

  const closeCompose = () => {
    setComposing(false);
    onConsumeCompose?.();
  };

  if (composing) {
    return (
      <MainScreenWrapper>
        <div className="mx-auto w-full max-w-2xl">
          <Composer
            initial={composeInitial}
            onCancel={closeCompose}
            onCreated={(id) => {
              closeCompose();
              onRefresh?.();
              setOpenId(id);
            }}
          />
        </div>
      </MainScreenWrapper>
    );
  }

  if (openId) {
    return (
      <MainScreenWrapper>
        <div className="mx-auto w-full max-w-2xl">
          <ThreadView
            threadId={openId}
            onBack={() => {
              setOpenId(null);
              onRefresh?.();
            }}
            onChanged={onRefresh}
          />
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Messages"
        description="Questions about an event or order? Chat directly with the organiser."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => setComposing(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <MessageSquarePlus className="h-4 w-4" /> New message
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : threads.length ? (
        <div className="space-y-3">
          {threads.map((t) => (
            <Card key={t.id} onClick={() => setOpenId(t.id)} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                  {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                  {t.subject}
                </p>
                <p className="mt-0.5 truncate text-xs text-text-secondary">{t.preview}</p>
              </div>
              <span className="shrink-0 text-xs text-text-tertiary">{fmtDateTime(t.lastMessageAt)}</span>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No messages yet"
          description="Have a question about an event or your order? Start a conversation with the organiser."
          action={
            <Button
              type="button"
              onClick={() => setComposing(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <MessageSquarePlus className="h-4 w-4" /> New message
            </Button>
          }
        />
      )}
    </MainScreenWrapper>
  );
}

export default PortalMessages;
