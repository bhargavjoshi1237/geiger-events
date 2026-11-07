"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, History, MessageSquare, MessageSquarePlus, PencilLine, Share2, X } from "lucide-react";

import { ActionMenu, Badge, Button, LogoLoading, Switch } from "@geiger/ui";
import { cn } from "@/lib/utils";
import {
  createPlanComment,
  deletePlanComment,
  markVersionRestored,
  restorePlanVersion,
  updatePlanComment,
} from "@/lib/supabase/floor_plan_sharing";
import {
  formatAgo,
  itemLabel,
  objectAtPoint,
  pinNumbers,
  pinPoint,
  planContent,
  shareState,
  threadsOf,
} from "@/lib/event_design";
import { usePlanCollab } from "./collab_store";
import { useNow } from "./client_utils";
import { CommentComposer, CommentThread, FloatingCard, PinMarker } from "./comment_ui";
import { ShareDialog } from "./share_links";
import { VersionNoteDialog, VersionPreviewDialog } from "./version_preview_dialog";

// Floor plan editor extensions: Share (header), comment pins + threads (canvas), Comments & Version history (inspector), open count (status dock).

const OUTLINE_BUTTON = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function useThreads(state, objectById) {
  const threads = useMemo(() => threadsOf(state?.comments || []), [state?.comments]);
  const numbers = useMemo(() => pinNumbers(threads, objectById), [threads, objectById]);
  return { threads, numbers };
}

// Team comment actions bound to one plan's store.
function useCommentActions(plan, store, state) {
  const reply = async (thread, body) => {
    const saved = await createPlanComment({ planId: plan.id, parentId: thread.id, body, authorName: state?.user?.name });
    if (!saved) {
      toast.error("Couldn't post the reply.");
      return false;
    }
    store.upsertComment(saved);
    return true;
  };
  const resolve = async (thread, resolved) => {
    const saved = await updatePlanComment(thread.id, { resolved, userId: state?.user?.id });
    if (!saved) {
      toast.error("Couldn't update the comment.");
      return;
    }
    store.upsertComment(saved);
    if (resolved && state?.activeId === thread.id) store.set({ activeId: null });
  };
  const remove = async (comment) => {
    const ok = await deletePlanComment(comment.id);
    if (!ok) {
      toast.error("Couldn't delete the comment.");
      return;
    }
    store.removeComment(comment.id);
    if (state?.activeId === comment.id) store.set({ activeId: null });
  };
  return { reply, resolve, remove };
}

function TeamOnlySwitch({ checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-text-secondary">
      <span>Team only — hidden from share links</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function DraftComposer({ plan, store, state, draft, onPosted }) {
  const [internal, setInternal] = useState(false);
  return (
    <CommentComposer
      autoFocus
      placeholder="Add a comment for the team or your guests…"
      onCancel={() => store.set({ draft: null })}
      onSubmit={async (body) => {
        const saved = await createPlanComment({
          planId: plan.id,
          xM: draft?.xM,
          yM: draft?.yM,
          itemId: draft?.itemId,
          body,
          internal,
          authorName: state?.user?.name,
          planVersion: plan.version,
        });
        if (!saved) {
          toast.error("Couldn't post the comment.");
          return false;
        }
        store.upsertComment(saved);
        onPosted?.(saved);
        return true;
      }}
    >
      <TeamOnlySwitch checked={internal} onChange={setInternal} />
    </CommentComposer>
  );
}

// --- header -------------------------------------------------------------------

export function ShareHeaderAction({ plan, doc, dirty }) {
  const [state, store] = usePlanCollab(plan?.id);
  const [open, setOpen] = useState(false);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  });

  // This slot is always mounted, so it owns loading and a light poll for guest comments.
  useEffect(() => {
    store.loadUser();
    store.refreshComments();
    store.refreshShares();
    const timer = setInterval(() => store.refreshComments(), 60_000);
    return () => clearInterval(timer);
  }, [store]);

  // Each save adds a version; a save of an untouched restore gets labelled "Restored from version N".
  const planId = plan?.id;
  const version = plan?.version;
  useEffect(() => {
    let alive = true;
    (async () => {
      await store.refreshVersions();
      const pending = store.getState()?.pendingRestore;
      if (!alive || !pending || !planId || pending.atVersion === version) return;
      store.set({ pendingRestore: null });
      if (JSON.stringify(planContent(docRef.current)) !== pending.signature) return;
      const marked = await markVersionRestored(planId, version, pending.from);
      if (marked) store.set((s) => ({ versions: (s.versions || []).map((v) => (v.id === marked.id ? marked : v)) }));
    })();
    return () => {
      alive = false;
    };
  }, [store, planId, version]);

  const active = (state?.shares || []).filter((s) => shareState(s) === "active").length;
  if (!plan) return null;

  return (
    <>
      <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Share
        {active ? <span className="tabular-nums text-text-tertiary">{active}</span> : null}
      </Button>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        plan={plan}
        dirty={dirty}
        shares={state?.shares ?? null}
        onSharesChange={(fn) => store.set((s) => ({ shares: fn(s.shares) }))}
      />
    </>
  );
}

// --- canvas -------------------------------------------------------------------

// While placing a comment, a transparent sheet over the plan catches the click (and works out which object it landed on).
export function CommentsOverlay({ plan, doc, view }) {
  const [state, store] = usePlanCollab(plan?.id);
  const pinMode = Boolean(state?.pinMode);

  useEffect(() => {
    if (!pinMode && !state?.draft) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") store.set({ pinMode: false, draft: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinMode, state?.draft, store]);

  if (!pinMode || !view?.view) return null;
  return (
    <rect
      x={view.view.x}
      y={view.view.y}
      width={view.view.w}
      height={view.view.h}
      fill="transparent"
      style={{ cursor: "crosshair" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
        if (!matrix) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
        const hit = objectAtPoint(doc?.objects, [pt.x, pt.y]);
        store.set({ pinMode: false, activeId: null, draft: { xM: pt.x, yM: pt.y, itemId: hit?.id || null } });
      }}
    />
  );
}

export function CommentsHud({ plan, view }) {
  const [state, store] = usePlanCollab(plan?.id);
  const now = useNow();
  const objectById = view?.objectById;
  const { threads, numbers } = useThreads(state, objectById);
  const actions = useCommentActions(plan, store, state);
  if (!state || !view) return null;

  const visible = threads.filter((t) => state.showResolved || !t.resolvedAt || t.id === state.activeId);
  const seen = new Map();
  const pins = [];
  for (const t of visible) {
    const point = pinPoint(t, objectById);
    if (!point) continue;
    const at = view.toScreen(point[0], point[1]);
    const key = `${Math.round(at.x / 6)}:${Math.round(at.y / 6)}`;
    const stack = seen.get(key) || 0;
    seen.set(key, stack + 1);
    pins.push({ thread: t, x: at.x + stack * 14, y: at.y - stack * 4 });
  }
  const activePin = pins.find((p) => p.thread.id === state.activeId) || null;
  const draftAt = state.draft ? view.toScreen(state.draft.xM, state.draft.yM) : null;

  return (
    <>
      {state.pinMode ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
          <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-2 text-xs text-text-secondary backdrop-blur">
            Click the plan to place your comment · Esc to cancel
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
          active={p.thread.id === state.activeId}
          onClick={() => store.set({ activeId: p.thread.id === state.activeId ? null : p.thread.id, draft: null })}
        />
      ))}

      {draftAt ? (
        <>
          <PinMarker x={draftAt.x} y={draftAt.y} tone="draft" label="New comment" />
          <FloatingCard anchor={draftAt} size={view.size}>
            <p className="mb-2 text-xs font-medium text-text-tertiary">
              New comment{state.draft.itemId ? ` on ${itemLabel(objectById, state.draft.itemId)}` : ""}
            </p>
            <DraftComposer
              plan={plan}
              store={store}
              state={state}
              draft={state.draft}
              onPosted={(saved) => store.set({ draft: null, activeId: saved.id })}
            />
          </FloatingCard>
        </>
      ) : null}

      {activePin && !draftAt ? (
        <FloatingCard anchor={{ x: activePin.x, y: activePin.y }} size={view.size}>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              aria-label="Close thread"
              onClick={() => store.set({ activeId: null })}
              className="rounded p-0.5 text-text-tertiary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <CommentThread
            thread={activePin.thread}
            number={numbers.get(activePin.thread.id)}
            itemText={itemLabel(objectById, activePin.thread.itemId)}
            now={now}
            youId={state.user?.id}
            canResolve
            canDelete={() => true}
            onReply={(body) => actions.reply(activePin.thread, body)}
            onResolve={actions.resolve}
            onDelete={actions.remove}
          />
        </FloatingCard>
      ) : null}
    </>
  );
}

// --- inspector ----------------------------------------------------------------

function Section({ title, action, children, className }) {
  return (
    <div className={cn("space-y-3 border-b border-border p-4 last:border-b-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-tertiary">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function ThreadRow({ thread, number, itemText, active, now, onClick }) {
  const name = thread.authorName || (thread.authorKind === "guest" ? "Guest" : "Teammate");
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
        active ? "border-border-strong bg-surface-active" : "border-transparent hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        {number ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
            {number}
          </span>
        ) : (
          <MessageSquare className="h-3.5 w-3.5 text-text-tertiary" />
        )}
        <span className="truncate font-medium text-foreground">{name}</span>
        {thread.authorKind === "guest" ? <Badge variant="neutral">Guest</Badge> : null}
        <span className="ml-auto shrink-0 text-text-tertiary" suppressHydrationWarning>
          {formatAgo(thread.createdAt, now || undefined)}
        </span>
      </div>
      <p className={cn("mt-1 line-clamp-2 text-xs", thread.resolvedAt ? "text-text-tertiary line-through" : "text-text-secondary")}>
        {thread.body}
      </p>
      {itemText || thread.replies.length ? (
        <p className="mt-1 text-[11px] text-text-tertiary">
          {[itemText, thread.replies.length ? `${thread.replies.length} repl${thread.replies.length === 1 ? "y" : "ies"}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </button>
  );
}

function CommentsSection({ plan, doc, state, store, now }) {
  const objectById = useMemo(() => new Map((doc?.objects || []).map((o) => [o.id, o])), [doc?.objects]);
  const { threads, numbers } = useThreads(state, objectById);
  const actions = useCommentActions(plan, store, state);
  const [writingGeneral, setWritingGeneral] = useState(false);
  const resolvedCount = threads.filter((t) => t.resolvedAt).length;
  const shown = threads.filter((t) => state.showResolved || !t.resolvedAt);

  return (
    <Section
      title={`Comments${threads.length ? ` (${threads.length - resolvedCount} open)` : ""}`}
      action={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={state.pinMode}
          className={cn("h-7 px-2 text-xs", state.pinMode && "bg-surface-active text-foreground")}
          onClick={() => store.set((s) => ({ pinMode: !s.pinMode, draft: null, activeId: null }))}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> {state.pinMode ? "Placing…" : "Add"}
        </Button>
      }
    >
      {state.pinMode ? (
        <p className="text-xs text-text-secondary">
          Click the plan to pin a comment, or{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => {
              store.set({ pinMode: false });
              setWritingGeneral(true);
            }}
          >
            write a general one
          </button>
          .
        </p>
      ) : null}
      {writingGeneral ? (
        <DraftComposer
          plan={plan}
          store={store}
          state={state}
          draft={null}
          onPosted={(saved) => {
            setWritingGeneral(false);
            store.set({ activeId: saved.id });
          }}
        />
      ) : null}

      {state.comments === null ? (
        <div className="flex justify-center py-4">
          <LogoLoading size={32} aria-label="Loading comments" />
        </div>
      ) : shown.length ? (
        <div className="space-y-1">
          {shown.map((t) => {
            const pinned = Boolean(pinPoint(t, objectById));
            const active = state.activeId === t.id;
            return (
              <div key={t.id}>
                <ThreadRow
                  thread={t}
                  number={numbers.get(t.id)}
                  itemText={itemLabel(objectById, t.itemId)}
                  active={active}
                  now={now}
                  onClick={() => store.set({ activeId: active ? null : t.id, draft: null })}
                />
                {active && !pinned ? (
                  <div className="mt-2 rounded-lg border border-border bg-surface-card p-3">
                    <CommentThread
                      thread={t}
                      now={now}
                      youId={state.user?.id}
                      canResolve
                      canDelete={() => true}
                      onReply={(body) => actions.reply(t, body)}
                      onResolve={actions.resolve}
                      onDelete={actions.remove}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-secondary">
          {threads.length ? "Every comment is resolved." : "No comments yet. Pin one to the plan, or share a link that allows comments."}
        </p>
      )}
      {resolvedCount ? (
        <button
          type="button"
          className="text-xs font-medium text-text-secondary hover:text-foreground"
          onClick={() => store.set((s) => ({ showResolved: !s.showResolved }))}
        >
          {state.showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
        </button>
      ) : null}
    </Section>
  );
}

const VERSIONS_SHOWN = 8;

function HistorySection({ plan, dirty, apply, state, store, now }) {
  const [all, setAll] = useState(false);
  const [preview, setPreview] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const versions = state.versions;
  const list = versions ? (all ? versions : versions.slice(0, VERSIONS_SHOWN)) : [];

  const restore = async (version, snapshot) => {
    // In the editor a restore is an undoable change; saving it records the new version.
    if (apply && snapshot) {
      const content = planContent(snapshot);
      apply((d) => ({ ...d, ...content }));
      store.set({ pendingRestore: { from: version.version, atVersion: plan.version, signature: JSON.stringify(content) } });
      setPreview(null);
      toast.success(`Version ${version.version} is back in the editor — save to keep it, or undo.`);
      return;
    }
    const res = await restorePlanVersion(plan.id, version);
    if (res === "conflict") {
      toast.error("Someone saved a newer version — reload the editor and try again.");
      return;
    }
    if (!res) {
      toast.error("Couldn't restore that version.");
      return;
    }
    toast.success(`Restored version ${version.version} as version ${res.plan.version} — reloading…`);
    setPreview(null);
    window.location.reload();
  };

  return (
    <Section title="Version history">
      {versions === null ? (
        <div className="flex justify-center py-4">
          <LogoLoading size={32} aria-label="Loading versions" />
        </div>
      ) : list.length ? (
        <div className="space-y-1">
          {list.map((v) => {
            const older = versions[versions.indexOf(v) + 1];
            const delta = older ? v.seatCount - older.seatCount : 0;
            const current = v.version === plan.version;
            return (
              <div key={v.id} className="flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-surface-hover">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreview(v)}>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold tabular-nums text-foreground">v{v.version}</span>
                    {current ? <Badge variant="success">Current</Badge> : null}
                    <span className="truncate text-text-secondary">{v.authorName || "Teammate"}</span>
                    <span className="ml-auto shrink-0 text-text-tertiary" suppressHydrationWarning>
                      {formatAgo(v.createdAt, now || undefined)}
                    </span>
                  </div>
                  {v.note ? <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{v.note}</p> : null}
                  <p className="mt-0.5 text-[11px] tabular-nums text-text-tertiary">
                    {v.objectCount} objects · {v.seatCount} seats
                    {delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
                  </p>
                </button>
                <ActionMenu
                  label={`Actions for version ${v.version}`}
                  items={[
                    { icon: Eye, label: "Preview", onSelect: () => setPreview(v) },
                    !current && { icon: History, label: "Restore…", onSelect: () => setPreview(v) },
                    { icon: PencilLine, label: v.note ? "Edit note" : "Add note", onSelect: () => setNoteFor(v) },
                  ]}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-secondary">Every save is kept here once the plan is saved.</p>
      )}
      {versions && versions.length > VERSIONS_SHOWN ? (
        <button
          type="button"
          className="text-xs font-medium text-text-secondary hover:text-foreground"
          onClick={() => setAll((a) => !a)}
        >
          {all ? "Show fewer" : `Show all ${versions.length}`}
        </button>
      ) : null}

      <VersionPreviewDialog
        version={preview}
        planName={plan.name}
        isCurrent={preview?.version === plan.version}
        restoreBlockedReason={!apply && dirty ? "Save or discard your changes before restoring." : null}
        onOpenChange={(o) => !o && setPreview(null)}
        onRestore={restore}
      />
      <VersionNoteDialog
        key={noteFor?.id || "note-closed"}
        version={noteFor}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSaved={(saved) => store.set((s) => ({ versions: (s.versions || []).map((x) => (x.id === saved.id ? saved : x)) }))}
      />
    </Section>
  );
}

export function CollaborationInspector({ plan, doc, dirty, apply }) {
  const [state, store] = usePlanCollab(plan?.id);
  const now = useNow();
  if (!plan || !state) return null;
  return (
    <div className="border-t border-border">
      <CommentsSection plan={plan} doc={doc} state={state} store={store} now={now} />
      <HistorySection plan={plan} dirty={dirty} apply={apply} state={state} store={store} now={now} />
    </div>
  );
}

// --- status dock --------------------------------------------------------------

export function CommentsStatusItem({ plan }) {
  const [state, store] = usePlanCollab(plan?.id);
  const open = useMemo(() => threadsOf(state?.comments || []).filter((t) => !t.resolvedAt), [state?.comments]);
  if (!open.length) return null;
  return (
    <button
      type="button"
      onClick={() => store.set({ activeId: open[0].id, draft: null })}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 text-text-secondary transition-colors hover:text-foreground"
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{open.length}</span> open comment{open.length === 1 ? "" : "s"}
    </button>
  );
}

export const SHARING_EXTENSION = {
  key: "sharing",
  HeaderAction: ShareHeaderAction,
  CanvasOverlay: CommentsOverlay,
  CanvasHud: CommentsHud,
  InspectorSection: CollaborationInspector,
  StatusItem: CommentsStatusItem,
};
