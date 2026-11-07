"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Ban, Clock, Eye, Link2Off, MessageSquare, MessageSquarePlus, X } from "lucide-react";

import { Badge, Button, Input, Logo, SegmentedTabs } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { portalGetJson, portalPostJson } from "@/lib/portal/portal_fetch";
import {
  GUEST_NAME_MAX_CHARS,
  formatDimensions,
  formatExpiry,
  itemLabel,
  objectAtPoint,
  pinNumbers,
  pinPoint,
  planContent,
  planSummary,
  setupStyleLabel,
  threadsOf,
} from "@/lib/event_design";
import { PlanRenderer } from "@/components/internal/screens/event_design/plan_renderer";
import { Plan3DViewer } from "@/components/internal/screens/event_design/walkthrough/plan_3d_viewer";
import { useNow } from "@/components/internal/screens/event_design/sharing/client_utils";
import {
  CommentComposer,
  CommentThread,
  FloatingCard,
  PinMarker,
} from "@/components/internal/screens/event_design/sharing/comment_ui";

// The public side of a floor plan share link: the plan in 2D (pan/zoom) or 3D, and — on comment links — pins and threads.

const POLL_MS = 30_000;
const NAME_KEY = "geiger.planGuestName";
const NAME_EVENT = "geiger-plan-guest-name";
let memoryName = "";

function subscribeName(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(NAME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(NAME_EVENT, callback);
  };
}
function readName() {
  try {
    return window.localStorage.getItem(NAME_KEY) || memoryName;
  } catch {
    return memoryName;
  }
}
function saveName(name) {
  memoryName = name;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Kept in memory for this visit.
  }
  window.dispatchEvent(new Event(NAME_EVENT));
}
const serverName = () => "";

const DESKTOP_QUERY = "(min-width: 1024px)";
function subscribeDesktop(callback) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
const assumeDesktop = () => true;

// Plan metres under a pointer event on the plan's <svg> (its viewBox is in metres).
function svgPoint(e) {
  const svg = e.currentTarget?.ownerSVGElement || e.currentTarget;
  const matrix = svg?.getScreenCTM?.();
  if (!matrix) return null;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  return [pt.x, pt.y];
}

const UNAVAILABLE = {
  not_found: {
    icon: Link2Off,
    title: "This link isn't active",
    body: "It may have been deleted, or the address is incomplete. Ask whoever shared it for a fresh link.",
  },
  revoked: {
    icon: Ban,
    title: "This link was turned off",
    body: "The organiser has stopped sharing this plan through this link. Ask them for a new one if you still need it.",
  },
  expired: {
    icon: Clock,
    title: "This link has expired",
    body: "Shared plans can be time-limited. Ask the organiser for a fresh link.",
  },
  unavailable: {
    icon: Link2Off,
    title: "We couldn't load this plan",
    body: "Something went wrong on our side. Try again in a minute.",
  },
};

const ERROR_MESSAGES = {
  forbidden: "This link is view-only.",
  rate_limited: "That's a lot of comments in a short time — try again in a few minutes.",
  revoked: "This link was turned off.",
  expired: "This link has expired.",
};

function Unavailable({ reason }) {
  const copy = UNAVAILABLE[reason] || UNAVAILABLE.unavailable;
  const Icon = copy.icon;
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-4 text-sm font-semibold">
          <Logo size={18} />
          Shared floor plan
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-start px-4 py-10">
        <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{copy.title}</p>
            <p className="mx-auto max-w-sm text-sm text-text-secondary">{copy.body}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function NameField({ value, onChange }) {
  return (
    <Input
      value={value}
      maxLength={GUEST_NAME_MAX_CHARS}
      placeholder="Your name"
      aria-label="Your name"
      autoComplete="name"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CommentsPanel({
  threads,
  numbers,
  objectById,
  now,
  activeId,
  showResolved,
  onToggleResolved,
  onSelect,
  onReply,
  onAddPin,
  onGeneral,
  needsName,
  name,
  onName,
  storedName,
  onClose,
  expiresAt,
}) {
  const [writing, setWriting] = useState(false);
  const resolved = threads.filter((t) => t.resolvedAt).length;
  const shown = threads.filter((t) => showResolved || !t.resolvedAt);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          Comments{threads.length ? <span className="ml-1 font-normal text-text-tertiary">{threads.length - resolved} open</span> : null}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={onAddPin}>
            <MessageSquarePlus className="h-4 w-4" /> Pin a comment
          </Button>
          {onClose ? (
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Close comments" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {shown.length ? (
          shown.map((t) => {
            const active = t.id === activeId;
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  active ? "border-border-strong bg-surface-card" : "border-border bg-surface-subtle",
                )}
              >
                <button type="button" className="sr-only" onClick={() => onSelect(t.id)}>
                  Show on plan
                </button>
                <div role="presentation" onClick={(e) => !e.target.closest("button, textarea, input") && onSelect(t.id)}>
                  <CommentThread
                    thread={t}
                    number={numbers.get(t.id)}
                    itemText={itemLabel(objectById, t.itemId)}
                    now={now}
                    onReply={(body) => onReply(t, body)}
                    replyChildren={needsName ? <NameField value={name} onChange={onName} /> : null}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-2 py-10 text-center">
            <MessageSquare className="mx-auto h-5 w-5 text-text-tertiary" />
            <p className="mt-2 text-sm text-text-secondary">
              {threads.length ? "Every comment is resolved." : "No comments yet. Pin one to the plan to point at something specific."}
            </p>
          </div>
        )}
        {resolved ? (
          <button type="button" className="px-1 text-xs font-medium text-text-secondary hover:text-foreground" onClick={onToggleResolved}>
            {showResolved ? "Hide resolved" : `Show resolved (${resolved})`}
          </button>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {writing ? (
          <CommentComposer
            autoFocus
            placeholder="A comment about the whole plan…"
            onCancel={() => setWriting(false)}
            onSubmit={async (body) => {
              const ok = await onGeneral(body);
              if (ok) setWriting(false);
              return ok;
            }}
          >
            {needsName ? <NameField value={name} onChange={onName} /> : null}
          </CommentComposer>
        ) : (
          <Button type="button" variant="outline" className="w-full border-border bg-transparent" onClick={() => setWriting(true)}>
            Comment on the whole plan
          </Button>
        )}
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          {storedName ? `Commenting as ${storedName}. ` : ""}
          Your name and comments are seen by the organiser&apos;s team and anyone else with this link.
          {expiresAt ? ` This link works until ${formatExpiry(expiresAt)}.` : ""}
        </p>
      </div>
    </div>
  );
}

export function SharedPlanPage({ token, initial }) {
  const [data, setData] = useState(initial);
  const [mode, setMode] = useState("2d");
  const [panel, setPanel] = useState(null);
  const [pinMode, setPinMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [nameDraft, setNameDraft] = useState(null);
  const storedName = useSyncExternalStore(subscribeName, readName, serverName);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, assumeDesktop);
  const now = useNow();
  const viewed = useRef(false);

  const ok = data?.ok === true;
  const canComment = ok && data.share?.permission === "comment";
  const plan = useMemo(() => (ok ? { ...planContent(data.plan), name: data.plan?.name || "Floor plan" } : null), [ok, data]);
  const summary = useMemo(() => (plan ? planSummary(plan) : null), [plan]);
  const objectById = useMemo(() => new Map((plan?.objects || []).map((o) => [o.id, o])), [plan]);
  const threads = useMemo(() => (canComment ? threadsOf(data.comments || []) : []), [canComment, data]);
  const numbers = useMemo(() => pinNumbers(threads, objectById), [threads, objectById]);
  const name = nameDraft ?? storedName;
  const needsName = !storedName;
  // Desktop opens the comments panel by default; phones keep the plan full-screen until asked.
  const panelOpen = panel ?? (canComment && desktop);

  // Count the open once per browser session, and refresh comments / newer saves while the page is open.
  useEffect(() => {
    if (!ok || viewed.current) return;
    viewed.current = true;
    const key = `geiger.planShareViewed.${token.slice(0, 12)}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Count it anyway.
    }
    portalPostJson(`/api/plan-share/${token}`, { action: "view" });
  }, [ok, token]);

  useEffect(() => {
    if (!ok) return undefined;
    const timer = setInterval(async () => {
      const next = await portalGetJson(`/api/plan-share/${token}`);
      // Only swap when something changed, so the 2D/3D views keep their state.
      if (next?.ok) setData((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [ok, token]);

  const post = useCallback(
    async (input) => {
      const author = String(name || "").trim();
      if (!author) {
        toast.error("Add your name so the team knows who wrote it.");
        return null;
      }
      const res = await portalPostJson(`/api/plan-share/${token}`, { action: "comment", name: author, ...input });
      const body = res.data || {};
      if (!res.ok || !body.ok) {
        toast.error(body.message || ERROR_MESSAGES[body.reason] || "Couldn't post your comment. Try again.");
        if (["revoked", "expired", "not_found"].includes(body.reason)) setData({ ok: false, reason: body.reason });
        return null;
      }
      if (author !== storedName) saveName(author);
      setNameDraft(null);
      if (body.data?.ok) setData(body.data);
      return body.comment || null;
    },
    [name, storedName, token],
  );

  if (!ok || !plan) return <Unavailable reason={data?.reason} />;

  const place = [data.plan.venueName, data.plan.spaceName].filter(Boolean).join(" · ");
  const meta = [
    place,
    formatDimensions(plan.widthM, plan.lengthM, plan.unit),
    setupStyleLabel(plan.setupStyle),
    `${summary.seats.toLocaleString()} seat${summary.seats === 1 ? "" : "s"}`,
  ].filter(Boolean);

  const startPin = () => {
    setMode("2d");
    setActiveId(null);
    setDraft(null);
    setPinMode(true);
    if (!desktop) setPanel(false);
  };

  const placeDraft = (e, point, item) => {
    if (!pinMode || !point) return;
    e.preventDefault();
    setPinMode(false);
    setDraft({ xM: point[0], yM: point[1], itemId: item?.id || objectAtPoint(plan.objects, point)?.id || null });
  };

  const hud = (ctx) => {
    if (!canComment) return null;
    const seen = new Map();
    const pins = [];
    for (const t of threads) {
      if (t.resolvedAt && !showResolved && t.id !== activeId) continue;
      const p = pinPoint(t, objectById);
      if (!p) continue;
      const at = ctx.toScreen(p[0], p[1]);
      const key = `${Math.round(at.x / 6)}:${Math.round(at.y / 6)}`;
      const stack = seen.get(key) || 0;
      seen.set(key, stack + 1);
      pins.push({ thread: t, x: at.x + stack * 14, y: at.y - stack * 4 });
    }
    const active = pins.find((p) => p.thread.id === activeId);
    const draftAt = draft ? ctx.toScreen(draft.xM, draft.yM) : null;
    return (
      <>
        {pinMode ? (
          <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-4">
            <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-2 text-xs text-text-secondary backdrop-blur">
              Tap the plan where your comment belongs
            </p>
          </div>
        ) : null}
        {pins.map((p) => (
          <PinMarker
            key={p.thread.id}
            x={p.x}
            y={p.y}
            number={numbers.get(p.thread.id)}
            tone={p.thread.resolvedAt ? "resolved" : "open"}
            active={p.thread.id === activeId}
            onClick={() => {
              setDraft(null);
              setActiveId((id) => (id === p.thread.id ? null : p.thread.id));
            }}
          />
        ))}
        {draftAt ? (
          <>
            <PinMarker x={draftAt.x} y={draftAt.y} tone="draft" label="New comment" />
            <FloatingCard anchor={draftAt} size={ctx.size}>
              <p className="mb-2 text-xs font-medium text-text-tertiary">
                New comment{draft.itemId ? ` on ${itemLabel(objectById, draft.itemId)}` : ""}
              </p>
              <CommentComposer
                autoFocus
                onCancel={() => setDraft(null)}
                onSubmit={async (body) => {
                  const saved = await post({ body, xM: draft.xM, yM: draft.yM, itemId: draft.itemId });
                  if (!saved) return false;
                  setDraft(null);
                  setActiveId(saved.id);
                  return true;
                }}
              >
                {needsName ? <NameField value={name} onChange={setNameDraft} /> : null}
              </CommentComposer>
            </FloatingCard>
          </>
        ) : null}
        {active && !draftAt ? (
          <FloatingCard anchor={{ x: active.x, y: active.y }} size={ctx.size}>
            <div className="mb-1 flex justify-end">
              <button
                type="button"
                aria-label="Close thread"
                onClick={() => setActiveId(null)}
                className="rounded p-0.5 text-text-tertiary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CommentThread
              thread={active.thread}
              number={numbers.get(active.thread.id)}
              itemText={itemLabel(objectById, active.thread.itemId)}
              now={now}
              onReply={async (body) => Boolean(await post({ body, parentId: active.thread.id }))}
              replyChildren={needsName ? <NameField value={name} onChange={setNameDraft} /> : null}
            />
          </FloatingCard>
        ) : null}
      </>
    );
  };

  const panelProps = {
    threads,
    numbers,
    objectById,
    now,
    activeId,
    showResolved,
    onToggleResolved: () => setShowResolved((v) => !v),
    onSelect: (id) => {
      setMode("2d");
      setDraft(null);
      setActiveId((cur) => (cur === id ? null : id));
      // On phones the sheet covers the plan — get out of the way of the pin.
      const thread = threads.find((t) => t.id === id);
      if (!desktop && thread && pinPoint(thread, objectById)) setPanel(false);
    },
    onReply: async (thread, body) => Boolean(await post({ body, parentId: thread.id })),
    onAddPin: startPin,
    onGeneral: async (body) => Boolean(await post({ body })),
    needsName,
    name,
    onName: setNameDraft,
    storedName,
    expiresAt: data.share?.expiresAt,
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Logo size={20} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-foreground">{plan.name}</h1>
              {!canComment ? (
                <Badge variant="neutral" className="hidden sm:inline-flex">
                  <Eye /> View only
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs tabular-nums text-text-secondary">{meta.join(" · ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedTabs
            tabs={[
              { value: "2d", label: "2D" },
              { value: "3d", label: "3D" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setPinMode(false);
              setDraft(null);
            }}
            className="w-auto"
          />
          {canComment ? (
            <Button
              type="button"
              variant="outline"
              aria-pressed={panelOpen}
              className={cn("border-border bg-transparent", panelOpen && "bg-surface-active")}
              onClick={() => setPanel(!panelOpen)}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Comments</span>
              {threads.filter((t) => !t.resolvedAt).length ? (
                <span className="tabular-nums text-text-tertiary">{threads.filter((t) => !t.resolvedAt).length}</span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {mode === "3d" ? (
            <Plan3DViewer plan={plan} ceilingHeightM={data.plan.spaceHeightM} showLabels />
          ) : (
            <>
              <PlanRenderer
                plan={plan}
                interactive
                panMode="drag"
                showGrid={false}
                hud={hud}
                onObjectPointerDown={pinMode ? (e, item) => placeDraft(e, svgPoint(e), item) : undefined}
                onBackgroundPointerDown={pinMode ? (e, point) => placeDraft(e, point, null) : undefined}
                className={pinMode ? "cursor-crosshair [&_svg]:cursor-crosshair" : undefined}
                aria-label={`${plan.name} floor plan`}
              />
              {canComment ? (
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={pinMode}
                    className={cn(
                      "h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:bg-surface-active hover:text-foreground",
                      pinMode && "bg-surface-active text-foreground",
                    )}
                    onClick={() => (pinMode ? setPinMode(false) : startPin())}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    {pinMode ? "Cancel" : "Add comment"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </main>

        {canComment && panelOpen ? (
          desktop ? (
            <aside className="w-[340px] shrink-0 border-l border-border bg-surface-subtle">
              <CommentsPanel {...panelProps} />
            </aside>
          ) : (
            <div className="fixed inset-x-0 bottom-0 z-20 h-[70dvh] rounded-t-2xl border-t border-border bg-surface-subtle shadow-2xl">
              <CommentsPanel {...panelProps} onClose={() => setPanel(false)} />
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export default SharedPlanPage;
