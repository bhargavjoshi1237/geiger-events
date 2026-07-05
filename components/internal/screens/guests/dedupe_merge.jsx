"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Merge, Sparkles } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listContacts, mergeContacts } from "@/lib/supabase/contacts";
import { CONTACT_STATUS_MAP, formatDateTime, initials } from "./constants";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const completeness = (c) =>
  ["name", "email", "phone", "company", "title", "location"].filter(
    (k) => c[k],
  ).length + (c.tags?.length ? 1 : 0);

// Group contacts into duplicate clusters: exact email first, then identical
// normalized name for those not already matched by email.
function findGroups(contacts) {
  const byEmail = new Map();
  for (const c of contacts) {
    const key = norm(c.email);
    if (!key) continue;
    (byEmail.get(key) || byEmail.set(key, []).get(key)).push(c);
  }
  const groups = [];
  const claimed = new Set();
  for (const [key, members] of byEmail) {
    if (members.length > 1) {
      members.forEach((m) => claimed.add(m.id));
      groups.push({ id: `email:${key}`, reason: `Same email · ${key}`, members });
    }
  }
  const byName = new Map();
  for (const c of contacts) {
    if (claimed.has(c.id)) continue;
    const key = norm(c.name);
    if (!key) continue;
    (byName.get(key) || byName.set(key, []).get(key)).push(c);
  }
  for (const [key, members] of byName) {
    if (members.length > 1) {
      groups.push({ id: `name:${key}`, reason: `Same name · ${key}`, members });
    }
  }
  return groups;
}

// Rendered standalone or as a Contact Book sub-view (`onBack` shows a return
// affordance). Merges persist to the same `contacts` table either way.
export function DedupeMergeScreen({ onBack } = {}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [survivors, setSurvivors] = useState({});
  const [merging, setMerging] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listContacts(projectId).then((cs) => {
      if (!alive) return;
      setContacts(cs ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const groups = useMemo(() => findGroups(contacts), [contacts]);

  const stats = useMemo(() => {
    const affected = groups.reduce((n, g) => n + g.members.length, 0);
    const removable = groups.reduce((n, g) => n + g.members.length - 1, 0);
    return [
      { label: "Duplicate groups", value: groups.length.toLocaleString() },
      { label: "Contacts affected", value: affected.toLocaleString() },
      { label: "Removable", value: removable.toLocaleString() },
    ];
  }, [groups]);

  const survivorFor = (group) =>
    survivors[group.id] ||
    [...group.members].sort((a, b) => completeness(b) - completeness(a))[0].id;

  const handleMerge = async (group) => {
    const survivorId = survivorFor(group);
    const loserIds = group.members
      .map((m) => m.id)
      .filter((id) => id !== survivorId);
    if (!loserIds.length) return;
    setMerging(group.id);
    const saved = await mergeContacts(survivorId, loserIds);
    setMerging(null);
    if (saved === null) {
      toast.error("No database connected.");
      return;
    }
    if (!saved) {
      toast.error("Couldn't merge these contacts.");
      return;
    }
    // Drop losers, replace the survivor with the merged row.
    setContacts((prev) =>
      prev
        .filter((c) => !loserIds.includes(c.id))
        .map((c) => (c.id === saved.id ? saved : c)),
    );
    toast.success(`Merged ${loserIds.length + 1} contacts into one.`);
  };

  return (
    <MainScreenWrapper>
      {onBack ? (
        <Button
          variant="ghost"
          className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> Back to contacts
        </Button>
      ) : null}
      <ScreenHeader
        title="Find duplicates"
        description="Find duplicate contacts and fold them into a single record — tags, notes, consent, and history are preserved."
      />

      <StatsBar stats={stats} columns={3} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning for duplicates…
        </div>
      ) : groups.length ? (
        <div className="space-y-4">
          {groups.map((group) => {
            const survivorId = survivorFor(group);
            return (
              <div
                key={group.id}
                className="rounded-xl border border-border bg-surface-subtle p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge variant="warning">{group.reason}</Badge>
                  <Button
                    size="sm"
                    disabled={merging === group.id}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleMerge(group)}
                  >
                    {merging === group.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Merge className="h-4 w-4" />
                    )}
                    Merge {group.members.length}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {group.members.map((c) => {
                    const isSurvivor = c.id === survivorId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setSurvivors((s) => ({ ...s, [group.id]: c.id }))
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          isSurvivor
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-border bg-surface-card hover:bg-surface-hover",
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-xs font-semibold text-foreground">
                          {initials(c.name, c.email) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {c.name || "Unnamed"}
                          </p>
                          <p className="truncate text-xs text-text-secondary">
                            {c.email || "No email"} · added {formatDateTime(c.createdAt)}
                          </p>
                        </div>
                        <StatusPill status={c.status} map={CONTACT_STATUS_MAP} />
                        {isSurvivor ? (
                          <Badge variant="success">Keep</Badge>
                        ) : (
                          <span className="text-xs text-text-tertiary">Merge in</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-text-tertiary">
                  Click a record to choose which one to keep.
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Sparkles}
            title="No duplicates found"
            description="Every contact looks unique. Re-run after an import to catch new duplicates."
          />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default DedupeMergeScreen;
