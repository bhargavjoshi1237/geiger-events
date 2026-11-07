"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Link2, MessageSquare, Plus } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, SegmentedTabs, StatsBar } from "@/components/internal/shared/screen_kit";
import { Button, LogoLoading } from "@geiger/ui";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { listFloorPlans } from "@/lib/supabase/floor_plans";
import {
  countShareViewsSince,
  createPlanComment,
  deletePlanComment,
  listProjectComments,
  listProjectShares,
  listProjectVersions,
  restorePlanVersion,
  updatePlanComment,
} from "@/lib/supabase/floor_plan_sharing";
import { shareState, threadsOf } from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { placeLabel, useDesignContext } from "./use_design_context";
import { getCollabStore } from "./sharing/collab_store";
import { useNow } from "./sharing/client_utils";
import { useShareActions } from "./sharing/share_links";
import { NewLinkDialog } from "./sharing/new_link_dialog";
import { LinksTab } from "./sharing/links_tab";
import { CommentsTab } from "./sharing/comments_tab";
import { ActivityTab } from "./sharing/activity_tab";
import { VersionNoteDialog, VersionPreviewDialog } from "./sharing/version_preview_dialog";

// Collaboration & Sharing: every share link, the comment feed and recent saves across the project's floor plans.

const TABS = [
  { value: "links", label: "Links", icon: Link2 },
  { value: "comments", label: "Comments", icon: MessageSquare },
  { value: "activity", label: "Activity", icon: History },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function CollaborationSharingScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const now = useNow();
  const [data, setData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("links");
  const [user, setUser] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [noteFor, setNoteFor] = useState(null);

  useEffect(() => {
    if (recordId) return undefined;
    let alive = true;
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    Promise.all([
      listFloorPlans(projectId, { kind: "all" }),
      listProjectShares(projectId),
      listProjectComments(projectId),
      listProjectVersions(projectId),
      countShareViewsSince(projectId, since),
      getUser(),
    ]).then(([plans, shares, comments, versions, weekViews, me]) => {
      if (!alive) return;
      setUser(me ? { id: me.id, name: me.name } : null);
      setData({
        plans: plans ?? [],
        shares: shares ?? [],
        comments: comments ?? [],
        versions: versions ?? [],
        weekViews,
      });
    });
    return () => {
      alive = false;
    };
  }, [projectId, recordId, reloadKey]);

  const patch = (fn) => setData((d) => (d ? { ...d, ...fn(d) } : d));
  const actions = useShareActions({
    onChanged: (share) =>
      patch((d) => ({
        shares: d.shares.some((s) => s.id === share.id) ? d.shares.map((s) => (s.id === share.id ? share : s)) : [share, ...d.shares],
      })),
    onRemoved: (id) => patch((d) => ({ shares: d.shares.filter((s) => s.id !== id) })),
  });

  const plansById = useMemo(() => new Map((data?.plans || []).map((p) => [p.id, p])), [data?.plans]);
  const placeOf = (plan) => (plan ? placeLabel(plan, ctx) : "");

  const stats = useMemo(() => {
    if (!data) return [];
    const at = now || undefined;
    const active = data.shares.filter((s) => shareState(s, at) === "active");
    const openThreads = threadsOf(data.comments).filter((t) => !t.resolvedAt);
    const totalViews = data.shares.reduce((n, s) => n + s.viewCount, 0);
    const sharedPlans = new Set(active.map((s) => s.planId));
    return [
      {
        label: "Active links",
        value: String(active.length),
        footer: `${active.filter((s) => s.permission === "comment").length} allow comments`,
      },
      {
        label: "Views this week",
        value: data.weekViews === null ? "—" : data.weekViews.toLocaleString(),
        footer: `${totalViews.toLocaleString()} all time`,
      },
      {
        label: "Open comments",
        value: String(openThreads.length),
        footer: `${openThreads.filter((t) => t.authorKind === "guest").length} from guests`,
      },
      {
        label: "Plans shared",
        value: String(sharedPlans.size),
        footer: `of ${data.plans.length} plan${data.plans.length === 1 ? "" : "s"}`,
      },
    ];
  }, [data, now]);

  const openPlan = (planId, thread) => {
    if (thread) {
      getCollabStore(planId).set({ activeId: thread.id, showResolved: Boolean(thread.resolvedAt), draft: null, pinMode: false });
    }
    openRecord(planId);
  };

  const replyTo = async (thread, body) => {
    const saved = await createPlanComment({ planId: thread.planId, parentId: thread.id, body, authorName: user?.name });
    if (!saved) {
      toast.error("Couldn't post the reply.");
      return false;
    }
    patch((d) => ({ comments: [...d.comments, saved] }));
    return true;
  };

  const resolve = async (thread, resolved) => {
    const saved = await updatePlanComment(thread.id, { resolved, userId: user?.id });
    if (!saved) {
      toast.error("Couldn't update the comment.");
      return;
    }
    patch((d) => ({ comments: d.comments.map((c) => (c.id === saved.id ? saved : c)) }));
    toast.success(resolved ? "Resolved." : "Reopened.");
  };

  const remove = async (comment) => {
    const ok = await deletePlanComment(comment.id);
    if (!ok) {
      toast.error("Couldn't delete the comment.");
      return;
    }
    patch((d) => ({ comments: d.comments.filter((c) => c.id !== comment.id && c.parentId !== comment.id) }));
  };

  const restore = async (version) => {
    const res = await restorePlanVersion(version.planId, version);
    if (res === "conflict") {
      toast.error("Someone saved this plan a moment ago — try again.");
      return;
    }
    if (!res) {
      toast.error("Couldn't restore that version.");
      return;
    }
    toast.success(`Restored version ${version.version} as version ${res.plan.version}.`);
    setPreview(null);
    setReloadKey((k) => k + 1);
  };

  if (recordId) {
    return (
      <FloorPlanEditor
        planId={recordId}
        onBack={closeRecord}
        backLabel="Collaboration & Sharing"
        onSaved={(saved) => patch((d) => ({ plans: d.plans.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)) }))}
      />
    );
  }

  const previewPlan = preview ? plansById.get(preview.planId) : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Collaboration & Sharing"
        description="Send floor plans to caterers, venues and clients as private links, gather their comments on the plan, and step back through every saved version."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New link
          </Button>
        }
      />

      {!data ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading collaboration" />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

          {tab === "links" ? (
            <LinksTab
              shares={data.shares}
              plansById={plansById}
              placeOf={placeOf}
              now={now}
              actions={actions}
              onNew={() => setNewOpen(true)}
              onOpenPlan={(id) => openPlan(id)}
            />
          ) : tab === "comments" ? (
            <CommentsTab
              comments={data.comments}
              plansById={plansById}
              placeOf={placeOf}
              now={now}
              youId={user?.id}
              onOpenPlan={openPlan}
              onReply={replyTo}
              onResolve={resolve}
              onDelete={remove}
            />
          ) : (
            <ActivityTab
              versions={data.versions}
              plansById={plansById}
              placeOf={placeOf}
              now={now}
              onPreview={setPreview}
              onOpenPlan={(id) => openPlan(id)}
              onEditNote={setNoteFor}
            />
          )}
        </>
      )}

      <NewLinkDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        plans={data?.plans || []}
        placeOf={placeOf}
        onCreate={(planId, input) => actions.create(planId, input)}
      />
      {actions.dialog}
      <VersionPreviewDialog
        version={preview}
        planName={previewPlan?.name}
        isCurrent={Boolean(previewPlan) && preview?.version === previewPlan.version}
        onOpenChange={(o) => !o && setPreview(null)}
        onRestore={restore}
      />
      <VersionNoteDialog
        key={noteFor?.id || "note-closed"}
        version={noteFor}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSaved={(saved) => patch((d) => ({ versions: d.versions.map((v) => (v.id === saved.id ? saved : v)) }))}
      />
    </MainScreenWrapper>
  );
}

export default CollaborationSharingScreen;
