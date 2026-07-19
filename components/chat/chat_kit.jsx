"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ThumbsUp,
  Heart,
  Laugh,
  PartyPopper,
  Lightbulb,
  Flame,
  Loader2,
  MoreHorizontal,
  Send,
  SmilePlus,
  Trash2,
  BarChart3,
  Plus,
  X,
  Check,
  Circle,
  CheckSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pollVoterCount } from "@/lib/chat/poll";
import { cn } from "@/lib/utils";

// Shared, prop-driven chat surface for the Community area. Adapted from
// geiger-chat's presentational components (same Tailwind semantic tokens), but
// self-contained and fed by geiger-events view-models. Used by both the event
// editor's Communication section and the members-portal Community section.

// Emoji reactions, stored by key (icon-only, consistent everywhere).
export const REACTIONS = [
  { key: "like", label: "Like", icon: ThumbsUp, colorClass: "text-blue-400" },
  { key: "love", label: "Love", icon: Heart, colorClass: "text-rose-400" },
  { key: "laugh", label: "Haha", icon: Laugh, colorClass: "text-amber-400" },
  { key: "celebrate", label: "Celebrate", icon: PartyPopper, colorClass: "text-fuchsia-400" },
  { key: "insightful", label: "Insightful", icon: Lightbulb, colorClass: "text-yellow-400" },
  { key: "fire", label: "Fire", icon: Flame, colorClass: "text-orange-400" },
];
const REACTION_MAP = Object.fromEntries(REACTIONS.map((r) => [r.key, r]));

function monogram(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function clockTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatAvatar({ name, className }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[11px] font-semibold text-foreground",
        className,
      )}
    >
      {monogram(name)}
    </div>
  );
}

// Reaction pills under a message + a hover picker.
function Reactions({ reactions, meKey, onReact }) {
  const entries = Object.entries(reactions || {}).filter(([, keys]) => keys?.length);
  if (!entries.length && !onReact) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {entries.map(([key, keys]) => {
        const r = REACTION_MAP[key];
        if (!r) return null;
        const mine = meKey && keys.includes(meKey);
        const Icon = r.icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onReact?.(key)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors",
              mine
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-surface-subtle text-text-secondary hover:bg-surface-hover",
            )}
          >
            <Icon className={cn("h-3 w-3", r.colorClass)} />
            {keys.length}
          </button>
        );
      })}
    </div>
  );
}

function ReactionPicker({ onPick }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface-subtle p-0.5 shadow-md">
      {REACTIONS.map((r) => {
        const Icon = r.icon;
        return (
          <button
            key={r.key}
            type="button"
            aria-label={r.label}
            onClick={() => onPick(r.key)}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-hover"
          >
            <Icon className={cn("h-3.5 w-3.5", r.colorClass)} />
          </button>
        );
      })}
    </div>
  );
}

// A poll rendered inside a chat message: question, options with vote bars, and
// tap-to-vote (highlighting the viewer's own choices).
export function PollCard({ poll, meKey, onVote }) {
  if (!poll) return null;
  const total = pollVoterCount(poll);
  const closed = poll.closed;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{poll.question}</p>
      </div>
      <div className="space-y-1.5">
        {(poll.options || []).map((o) => {
          const votes = (poll.votes && poll.votes[o.id]) || [];
          const mine = meKey && votes.includes(meKey);
          const pct = total ? Math.round((votes.length / total) * 100) : 0;
          return (
            <button
              key={o.id}
              type="button"
              disabled={closed || !onVote}
              onClick={() => onVote?.(o.id)}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
                mine ? "border-primary/50" : "border-border hover:bg-surface-hover",
                closed || !onVote ? "cursor-default" : "cursor-pointer",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-foreground">
                  {mine ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  {o.label}
                </span>
                <span className="tabular-nums text-xs text-text-secondary">
                  {votes.length} · {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-text-tertiary">
        {total} {total === 1 ? "vote" : "votes"}
        {poll.multi ? " · pick multiple" : ""}
        {closed ? " · closed" : ""}
      </p>
    </div>
  );
}

// Dialog for composing a poll (question + 2–6 options + single/multi).
export function PollComposerDialog({ open, onOpenChange, onCreate }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);

  const setOpt = (i, v) => setOptions((prev) => prev.map((o, j) => (j === i ? v : o)));
  const addOpt = () => setOptions((prev) => (prev.length >= 6 ? prev : [...prev, ""]));
  const removeOpt = (i) => setOptions((prev) => prev.filter((_, j) => j !== i));

  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMulti(false);
  };

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return;
    setBusy(true);
    const ok = await onCreate({ question: question.trim(), options: opts, multi });
    setBusy(false);
    if (ok !== false) {
      reset();
      onOpenChange(false);
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
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-left text-base">New poll</DialogTitle>
              <p className="mt-0.5 text-xs text-text-secondary">
                Ask attendees a question and let them vote right in the chat.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Question
            </label>
            <Input
              value={question}
              autoFocus
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which session should we run next?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                Options
              </label>
              <span className="text-[11px] tabular-nums text-text-tertiary">
                {options.filter((o) => o.trim()).length}/6
              </span>
            </div>
            <div className="space-y-2">
              {options.map((o, i) => {
                const Indicator = multi ? CheckSquare : Circle;
                return (
                  <div
                    key={i}
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-surface-card px-3 py-2 transition-colors focus-within:border-border-strong"
                  >
                    <Indicator className="h-4 w-4 shrink-0 text-text-tertiary" />
                    <input
                      value={o}
                      onChange={(e) => setOpt(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary"
                    />
                    {options.length > 2 ? (
                      <button
                        type="button"
                        aria-label="Remove option"
                        onClick={() => removeOpt(i)}
                        className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {options.length < 6 ? (
              <button
                type="button"
                onClick={addOpt}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add option
              </button>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-secondary">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Allow multiple choices</p>
              <p className="text-xs text-text-secondary">Voters can pick more than one option.</p>
            </div>
            <Switch checked={multi} onCheckedChange={setMulti} />
          </label>
        </div>

        <DialogFooter className="border-t border-border p-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !question.trim() || options.filter((o) => o.trim()).length < 2}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Post poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageRow({ msg, meKey, showAuthor, onReact, onDelete, onVote }) {
  const [picker, setPicker] = useState(false);
  const mine = meKey && msg.authorKey === meKey;
  const system = msg.senderKind === "system";

  if (system) {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] text-text-tertiary">
          {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("group/msg flex gap-2.5", mine ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">
        {showAuthor && !mine ? <ChatAvatar name={msg.authorName} /> : null}
      </div>
      <div className={cn("flex min-w-0 max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {showAuthor ? (
          <div className={cn("mb-0.5 flex items-center gap-2", mine ? "flex-row-reverse" : "")}>
            <span className="text-xs font-medium text-foreground">
              {mine ? "You" : msg.authorName}
            </span>
            {msg.senderKind === "organiser" ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Organiser
              </span>
            ) : null}
            <span className="text-[10px] text-text-tertiary">{clockTime(msg.createdAt)}</span>
          </div>
        ) : null}

        <div className={cn("flex items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
          {msg.type === "poll" && msg.poll && !msg.deleted ? (
            <PollCard
              poll={msg.poll}
              meKey={meKey}
              onVote={onVote ? (optionId) => onVote(optionId, msg) : null}
            />
          ) : (
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2 text-sm",
                msg.deleted
                  ? "bg-surface-subtle italic text-text-tertiary"
                  : mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-card text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap break-words">
                {msg.deleted ? "Message removed" : msg.text}
              </p>
            </div>
          )}

          {!msg.deleted ? (
            <div className="relative flex items-center opacity-0 transition-opacity group-hover/msg:opacity-100">
              {onReact ? (
                <>
                  <button
                    type="button"
                    aria-label="React"
                    onClick={() => setPicker((v) => !v)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-surface-hover hover:text-foreground"
                  >
                    <SmilePlus className="h-3.5 w-3.5" />
                  </button>
                  {picker ? (
                    <div className={cn("absolute bottom-7 z-10", mine ? "right-0" : "left-0")}>
                      <ReactionPicker
                        onPick={(k) => {
                          setPicker(false);
                          onReact(k);
                        }}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              {onDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Message actions"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-surface-hover hover:text-foreground"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={mine ? "end" : "start"} className="w-36">
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                      onClick={() => onDelete(msg)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ) : null}
        </div>

        {!msg.deleted ? (
          <Reactions
            reactions={msg.reactions}
            meKey={meKey}
            onReact={onReact ? (k) => onReact(k, msg) : null}
          />
        ) : null}
      </div>
    </div>
  );
}

export function MessageList({ messages = [], meKey, onReact, onDelete, onVote, emptyLabel }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  if (!messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-text-secondary">
        {emptyLabel || "No messages yet — say hello."}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showAuthor = !prev || prev.authorKey !== m.authorKey || prev.senderKind === "system";
        return (
          <MessageRow
            key={m.id}
            msg={m}
            meKey={meKey}
            showAuthor={showAuthor}
            onReact={onReact ? (k) => onReact(k, m) : null}
            onDelete={onDelete}
            onVote={onVote}
          />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export function Composer({ disabled, placeholder, onSend, borderless = false }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const border = borderless ? "" : "border-t border-border";

  const submit = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || busy || disabled) return;
    setBusy(true);
    setText("");
    const ok = await onSend(body);
    setBusy(false);
    if (ok === false) setText(body); // restore on failure
  };

  if (disabled) {
    return (
      <div className={cn("p-3 text-center text-xs text-text-tertiary", border)}>
        {placeholder || "Only the organiser can post here."}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex items-end gap-2 p-3", border)}>
      <Textarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
        placeholder={placeholder || "Write a message…"}
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none"
      />
      <Button
        type="submit"
        disabled={busy || !text.trim()}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}

// A full chat surface: header + message list + composer. Height-managed by the
// parent (give it a fixed/flex height container).
export function ChatThread({
  title,
  subtitle,
  headerLeft,
  headerRight,
  messages,
  meKey,
  canPost = true,
  composerPlaceholder,
  loading,
  emptyLabel,
  onSend,
  onReact,
  onDelete,
  onVote,
  onCreatePoll,
  bare = false,
}) {
  const [pollOpen, setPollOpen] = useState(false);
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        bare ? "" : "rounded-xl border border-border bg-surface-subtle",
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {headerLeft}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              {subtitle ? (
                <p className="truncate text-xs text-text-secondary">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {headerRight}
        </div>
      ) : null}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <MessageList
          messages={messages}
          meKey={meKey}
          onReact={onReact}
          onDelete={onDelete}
          onVote={onVote}
          emptyLabel={emptyLabel}
        />
      )}
      <div className="flex items-end gap-1.5 border-t border-border pr-3">
        {onCreatePoll && canPost ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Create a poll"
            onClick={() => setPollOpen(true)}
            className="mb-3 ml-3 shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <Composer disabled={!canPost} placeholder={composerPlaceholder} onSend={onSend} borderless />
        </div>
      </div>
      {onCreatePoll ? (
        <PollComposerDialog open={pollOpen} onOpenChange={setPollOpen} onCreate={onCreatePoll} />
      ) : null}
    </div>
  );
}

// Left-rail channel list for the portal Community section.
export function ChannelList({ channels = [], activeId, onSelect }) {
  const sorted = useMemo(() => channels, [channels]);
  return (
    <div className="space-y-1">
      {sorted.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
            activeId === c.id ? "bg-surface-active" : "hover:bg-surface-hover",
          )}
        >
          <ChatAvatar name={c.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {c.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
              <p
                className={cn(
                  "truncate text-sm",
                  c.unread ? "font-semibold text-foreground" : "font-medium text-foreground",
                )}
              >
                {c.name}
              </p>
            </div>
            {c.lastPreview ? (
              <p className="mt-0.5 truncate text-xs text-text-secondary">{c.lastPreview}</p>
            ) : (
              <p className="mt-0.5 truncate text-xs text-text-tertiary">No messages yet</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
