"use client";

import React, { useState } from "react";
import { Check, Loader2, Lock, MapPin, RotateCcw, Send, Trash2 } from "lucide-react";

import { Badge, Button, Textarea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_CHARS, formatAgo } from "@/lib/event_design";
import { stopWheel } from "./client_utils";

// Comment building blocks shared by the editor, the Collaboration screen and the public share page.

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

export function AuthorAvatar({ name, guest, className }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
        guest ? "border-border bg-surface-card text-text-secondary" : "border-transparent bg-foreground text-background",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

function CommentItem({ comment, now, you, onDelete }) {
  const name = comment.authorName || (comment.authorKind === "guest" ? "Guest" : "Teammate");
  return (
    <div className="group/comment flex gap-2.5">
      <AuthorAvatar name={name} guest={comment.authorKind === "guest"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">{you ? "You" : name}</span>
          {comment.authorKind === "guest" ? <Badge variant="neutral">Guest</Badge> : null}
          <span className="text-xs text-text-tertiary" suppressHydrationWarning>
            {formatAgo(comment.createdAt, now || undefined)}
          </span>
          {onDelete ? (
            <button
              type="button"
              aria-label="Delete comment"
              title="Delete comment"
              onClick={() => onDelete(comment)}
              className="ml-auto rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover/comment:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-secondary">{comment.body}</p>
      </div>
    </div>
  );
}

export function CommentComposer({
  placeholder = "Write a comment…",
  submitLabel = "Comment",
  onSubmit,
  onCancel,
  autoFocus,
  children,
  disabled,
  maxLength = COMMENT_MAX_CHARS,
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const text = body.trim();

  const submit = async () => {
    if (!text || busy || disabled) return;
    setBusy(true);
    const ok = await onSubmit(text);
    setBusy(false);
    if (ok) setBody("");
  };

  return (
    <div className="space-y-2">
      {children}
      <Textarea
        autoFocus={autoFocus}
        value={body}
        maxLength={maxLength}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="min-h-[72px] resize-none text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!text || busy || disabled}
          onClick={submit}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// One thread: the root, its replies, a reply box and (for the team) resolve / reopen.
export function CommentThread({
  thread,
  number,
  itemText,
  now,
  youId,
  canResolve,
  canDelete,
  onReply,
  onResolve,
  onDelete,
  replyChildren,
  replyDisabled,
}) {
  const [replying, setReplying] = useState(false);
  const resolved = Boolean(thread.resolvedAt);
  const mine = (c) => Boolean(youId) && c.authorId === youId;

  return (
    <div className="space-y-3">
      {number || itemText || thread.internal || resolved ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {number ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">
              {number}
            </span>
          ) : null}
          {itemText ? (
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <MapPin className="h-3 w-3" /> {itemText}
            </span>
          ) : null}
          {thread.internal ? (
            <Badge variant="neutral">
              <Lock /> Team only
            </Badge>
          ) : null}
          {resolved ? <Badge variant="success">Resolved</Badge> : null}
        </div>
      ) : null}

      <CommentItem
        comment={thread}
        now={now}
        you={mine(thread)}
        onDelete={canDelete?.(thread) && onDelete ? onDelete : null}
      />
      {thread.replies?.length ? (
        <div className="space-y-3 border-l border-border pl-3">
          {thread.replies.map((r) => (
            <CommentItem key={r.id} comment={r} now={now} you={mine(r)} onDelete={canDelete?.(r) && onDelete ? onDelete : null} />
          ))}
        </div>
      ) : null}

      {replying ? (
        <CommentComposer
          autoFocus
          placeholder="Reply…"
          submitLabel="Reply"
          disabled={replyDisabled}
          onCancel={() => setReplying(false)}
          onSubmit={async (body) => {
            const ok = await onReply(body);
            if (ok) setReplying(false);
            return ok;
          }}
        >
          {replyChildren}
        </CommentComposer>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {onReply ? (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReplying(true)}>
              Reply
            </Button>
          ) : null}
          {canResolve && onResolve ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onResolve(thread, !resolved)}
            >
              {resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {resolved ? "Reopen" : "Resolve"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Map pin anchored at its bottom-left corner (the point it marks).
export function PinMarker({ number, tone = "open", active, onClick, x, y, label }) {
  return (
    <button
      type="button"
      aria-label={label || (number ? `Comment ${number}` : "Comment")}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      style={{ left: x, top: y - 28 }}
      className={cn(
        "absolute flex h-7 min-w-7 items-center justify-center rounded-full rounded-bl-[3px] border px-1.5 text-xs font-semibold transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        tone === "resolved" && "border-border bg-surface-card text-text-tertiary",
        tone === "open" && "border-transparent bg-foreground text-background",
        tone === "draft" && "border-dashed border-primary bg-surface-card text-primary",
        active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {number || "+"}
    </button>
  );
}

// A card floating beside a pin inside the canvas, kept on screen.
export function FloatingCard({ anchor, size, width = 300, children, className }) {
  if (!anchor) return null;
  const fitsRight = anchor.x + 20 + width <= (size?.width || Infinity) - 8;
  const left = fitsRight ? anchor.x + 20 : Math.max(8, anchor.x - 20 - width);
  const top = Math.max(8, Math.min(anchor.y - 36, (size?.height || 600) - 280));
  return (
    <div
      ref={stopWheel}
      role="dialog"
      aria-label="Comment thread"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left, top, width: Math.min(width, (size?.width || width) - 16) }}
      className={cn(
        "scrollbar-subtle absolute z-10 max-h-[min(420px,calc(100%-16px))] touch-pan-y select-text overflow-y-auto rounded-xl border border-border bg-surface-card p-3 shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}
