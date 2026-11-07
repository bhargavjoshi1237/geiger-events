"use client";

import React, { useMemo, useState } from "react";
import { Ban, CheckCircle2, EyeOff, Flag, MessagesSquare, ShieldCheck, UserCheck, XCircle } from "lucide-react";

import { EmptyState, SectionCard, SegmentedTabs, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { REPORT_REASONS, excerpt, relTime } from "@/lib/boards/constants";
import { REPORT_STATUS_MAP, formatDateTime } from "./shared";

const reasonLabel = (r) => REPORT_REASONS.find((x) => x.value === r)?.label || "Other";

function QueueRow({ kind, title, body, meta, actions, onOpen }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-start">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={kind === "Topic" ? "info" : "neutral"}>{kind}</Badge>
          <span className="truncate text-sm font-medium text-foreground hover:underline">{title}</span>
        </span>
        {body ? <span className="mt-1 line-clamp-2 block text-xs text-text-secondary">{body}</span> : null}
        <span className="mt-1 block text-[11px] text-text-tertiary">{meta}</span>
      </button>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}

const outline = "border-border bg-surface-card text-foreground hover:bg-surface-hover";

export function ModerationTab({
  topics,
  pendingPosts,
  reports,
  bans,
  boards,
  onOpenTopic,
  onTopicStatus,
  onPostStatus,
  onResolve,
  onLift,
}) {
  const [reportView, setReportView] = useState("open");
  const boardName = useMemo(() => Object.fromEntries((boards || []).map((b) => [b.id, b.name])), [boards]);

  const pendingTopics = (topics || []).filter((t) => t.status === "pending");
  const queueCount = pendingTopics.length + (pendingPosts || []).length;

  // One row per reported piece of content, however many members reported it.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of reports || []) {
      const open = r.status === "open";
      if ((reportView === "open") !== open) continue;
      const key = r.postId || r.topicId;
      if (!map.has(key)) map.set(key, { key, reports: [], topic: r.topic, post: r.post, postId: r.postId, topicId: r.topicId });
      map.get(key).reports.push(r);
    }
    return [...map.values()];
  }, [reports, reportView]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Awaiting approval"
        description="New topics on approval boards, plus posts held by your banned-words filter."
      >
        {queueCount ? (
          <div>
            {pendingTopics.map((t) => (
              <QueueRow
                key={t.id}
                kind="Topic"
                title={t.title}
                body={excerpt(t.body, 220)}
                meta={`${t.authorName} · ${boardName[t.boardId] || "Board"} · ${relTime(t.createdAt)} ago`}
                onOpen={() => onOpenTopic(t)}
                actions={
                  <>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onTopicStatus(t, "published")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className={outline} onClick={() => onTopicStatus(t, "hidden")}>
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </Button>
                  </>
                }
              />
            ))}
            {(pendingPosts || []).map((p) => (
              <QueueRow
                key={p.id}
                kind="Reply"
                title={`Reply in “${p.topic?.title || "a topic"}”`}
                body={excerpt(p.body, 220)}
                meta={`${p.authorName} · ${boardName[p.topic?.boardId] || "Board"} · ${relTime(p.createdAt)} ago`}
                onOpen={() => p.topic && onOpenTopic(p.topic)}
                actions={
                  <>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onPostStatus(p, "published")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className={outline} onClick={() => onPostStatus(p, "hidden")}>
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="Nothing waiting" description="New topics and held posts that need a decision show up here." className="py-8" />
        )}
      </SectionCard>

      <SectionCard
        title="Reports"
        description="Content members flagged. Hiding removes it from the portal; dismissing keeps it up."
        action={
          <SegmentedTabs
            className="w-fit sm:w-fit"
            value={reportView}
            onChange={setReportView}
            tabs={[
              { value: "open", label: "Open" },
              { value: "resolved", label: "Resolved" },
            ]}
          />
        }
      >
        {groups.length ? (
          <div>
            {groups.map((g) => {
              const target = g.post || g.topic;
              const author = target?.authorName || "Member";
              const reasons = [...new Set(g.reports.map((r) => reasonLabel(r.reason)))];
              const details = g.reports.map((r) => r.details).filter(Boolean);
              const latest = g.reports[0];
              return (
                <QueueRow
                  key={g.key}
                  kind={g.postId ? "Reply" : "Topic"}
                  title={g.postId ? `Reply in “${g.topic?.title || "a topic"}”` : g.topic?.title || "Topic"}
                  body={
                    <>
                      {excerpt(target?.body, 200)}
                      {details.length ? <span className="mt-1 block italic text-text-tertiary">“{details[0]}”</span> : null}
                    </>
                  }
                  meta={`By ${author} · ${g.reports.length} ${g.reports.length === 1 ? "report" : "reports"} (${reasons.join(", ")}) · ${formatDateTime(latest.createdAt)}`}
                  onOpen={() => g.topic && onOpenTopic(g.topic)}
                  actions={
                    reportView === "open" ? (
                      <>
                        <Button size="sm" variant="outline" className={outline} onClick={() => onResolve(g, "hide")}>
                          <EyeOff className="h-3.5 w-3.5" /> Hide
                        </Button>
                        <Button size="sm" variant="outline" className={outline} onClick={() => onResolve(g, "dismiss")}>
                          <XCircle className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                        {target?.authorMemberId ? (
                          <Button size="sm" variant="outline" className={outline} onClick={() => onResolve(g, "ban")}>
                            <Ban className="h-3.5 w-3.5" /> Ban author
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <StatusPill status={latest.status} map={REPORT_STATUS_MAP} />
                    )
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Flag}
            title={reportView === "open" ? "No open reports" : "No resolved reports"}
            description={reportView === "open" ? "When members report a topic or reply, it lands here." : "Reports you act on or dismiss are kept here."}
            className="py-8"
          />
        )}
      </SectionCard>

      <SectionCard title="Banned members" description="Banned members can read boards but can't post, react or report.">
        {bans?.length ? (
          <div>
            {bans.map((b) => (
              <div key={b.id} className="flex items-center gap-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{b.memberName}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {[b.memberEmail, b.reason].filter(Boolean).join(" · ") || "No reason given"}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {b.expiresAt
                      ? new Date(b.expiresAt) < new Date()
                        ? `Expired ${formatDateTime(b.expiresAt)}`
                        : `Until ${formatDateTime(b.expiresAt)}`
                      : "Until lifted"}
                  </p>
                </div>
                <Button size="sm" variant="outline" className={outline} onClick={() => onLift(b)}>
                  <UserCheck className="h-3.5 w-3.5" /> Lift ban
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={MessagesSquare} title="No banned members" description="Ban someone from a report or a thread's menu." className="py-8" />
        )}
      </SectionCard>
    </div>
  );
}

export default ModerationTab;
