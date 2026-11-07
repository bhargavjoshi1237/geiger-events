"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpRight, MessagesSquare } from "lucide-react";

import { Button } from "@geiger/ui";
import { EmptyState, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { itemLabel, pinNumbers, threadsOf } from "@/lib/event_design";
import { CommentThread } from "./comment_ui";

// The comment feed across every plan: open threads first, filterable by plan; open a thread on its plan.

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All comments" },
];

export function CommentsTab({ comments, plansById, placeOf, now, youId, onOpenPlan, onReply, onResolve, onDelete }) {
  const [status, setStatus] = useState("open");
  const [planFilter, setPlanFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Threads per plan (pin numbers are per plan, matching what the editor shows).
  const threads = useMemo(() => {
    const byPlan = new Map();
    for (const c of comments) {
      if (!byPlan.has(c.planId)) byPlan.set(c.planId, []);
      byPlan.get(c.planId).push(c);
    }
    const out = [];
    for (const [planId, list] of byPlan) {
      const plan = plansById.get(planId);
      const objectById = new Map((plan?.objects || []).map((o) => [o.id, o]));
      const planThreads = threadsOf(list);
      const numbers = pinNumbers(planThreads, objectById);
      for (const t of planThreads) {
        out.push({ ...t, plan, number: numbers.get(t.id), itemText: itemLabel(objectById, t.itemId) });
      }
    }
    const last = (t) => Math.max(Date.parse(t.createdAt) || 0, ...t.replies.map((r) => Date.parse(r.createdAt) || 0));
    return out.sort((a, b) => Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt)) || last(b) - last(a));
  }, [comments, plansById]);

  const planOptions = useMemo(() => {
    const used = [...new Set(threads.map((t) => t.planId))].filter((id) => plansById.has(id));
    return [
      { value: "all", label: "All plans" },
      ...used.map((id) => ({ value: id, label: plansById.get(id).name || "Untitled plan" })),
    ];
  }, [threads, plansById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (status === "open" && t.resolvedAt) return false;
      if (status === "resolved" && !t.resolvedAt) return false;
      if (planFilter !== "all" && t.planId !== planFilter) return false;
      if (q) {
        const hay = [t.body, t.authorName, t.plan?.name, ...t.replies.map((r) => `${r.body} ${r.authorName}`)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threads, status, planFilter, search]);

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={status} onValueChange={setStatus} options={STATUS_OPTIONS} height="h-9" />
          <FilterDropdown value={planFilter} onValueChange={setPlanFilter} options={planOptions} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search comments…" />
      </Toolbar>

      {filtered.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4">
              <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.plan?.name || "Deleted plan"}</p>
                  <p className="truncate text-xs text-text-secondary">{placeOf(t.plan) || "No venue"}</p>
                </div>
                {t.plan ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => onOpenPlan(t.plan.id, t)}
                  >
                    Open on plan <ArrowUpRight className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <CommentThread
                thread={t}
                number={t.number}
                itemText={t.itemText}
                now={now}
                youId={youId}
                canResolve
                canDelete={() => true}
                onReply={(body) => onReply(t, body)}
                onResolve={onResolve}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title={threads.length ? "No comments match your filters" : "No comments yet"}
            description={
              threads.length
                ? "Try a different status, plan or search."
                : "Pins dropped on a plan — by your team in the editor or by guests through a comment link — collect here."
            }
          />
        </div>
      )}
    </div>
  );
}

export default CommentsTab;
