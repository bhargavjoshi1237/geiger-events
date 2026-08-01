"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pause, Play, Plus, Trash2, Users } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useProject } from "@/context/project-context";
import {
  createAffiliate,
  listAffiliates,
  listAffiliateTotals,
  softDeleteAffiliate,
  updateAffiliate,
} from "../lib/affiliates";
import {
  AFFILIATE_STATUS_FILTER_OPTIONS,
  AFFILIATE_STATUS_MAP,
  currency,
  formatDate,
  slugify,
} from "../lib/constants";

// The project-wide affiliate roster. One row per PERSON — their per-event
// participation lives in each program's enrolment list, not here.
//
// Recruitment is invite-only: creating an affiliate sends them into the
// `invited` state; they become `active` when they claim the invite in the
// members portal.

const EMPTY_DRAFT = { name: "", email: "", slug: "", notes: "" };

export function AffiliatesRosterScreen() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    // State is only touched in the async continuation — a synchronous setState
    // in an effect body cascades renders (and the lint rule rejects it).
    Promise.all([listAffiliates(projectId), listAffiliateTotals(projectId)]).then(
      ([affiliates, rollups]) => {
        if (!alive) return;
        setRows(affiliates ?? []);
        setTotals(rollups ?? {});
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const lifetime = Object.values(totals).reduce((s, t) => s + t.earned, 0);
    const pending = Object.values(totals).reduce((s, t) => s + t.pending, 0);
    return [
      { label: "Affiliates", value: String(rows.length) },
      { label: "Active", value: String(active) },
      { label: "Lifetime earned", value: currency(lifetime) },
      { label: "Awaiting approval", value: currency(pending) },
    ];
  }, [rows, totals]);

  const handleInvite = async () => {
    const name = draft.name.trim();
    const email = draft.email.trim();
    if (!name) return toast.error("Give the affiliate a name.");
    if (!email || !email.includes("@")) {
      return toast.error("A valid email is required to send the invite.");
    }
    if (rows.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      return toast.error("That email is already an affiliate on this project.");
    }

    const optimistic = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      slug: draft.slug.trim() || slugify(name),
      notes: draft.notes.trim(),
      status: "invited",
      invitedAt: new Date().toISOString(),
      payoutDetails: {},
    };

    setSaving(true);
    setRows((prev) => [optimistic, ...prev]);
    const created = await createAffiliate(projectId, optimistic);
    setSaving(false);

    if (created) {
      setRows((prev) => prev.map((r) => (r.id === created.id ? created : r)));
      setDraft(EMPTY_DRAFT);
      setInviteOpen(false);
      toast.success(`Invited ${created.name}`);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== optimistic.id));
      toast.error("Couldn't invite that affiliate.");
    }
  };

  const handleStatus = async (row, status) => {
    const previous = row.status;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status } : r)),
    );
    const saved = await updateAffiliate(row.id, { status });
    if (saved) {
      toast.success(status === "suspended" ? "Affiliate paused" : "Affiliate active");
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r)),
      );
      toast.error("Couldn't update that affiliate.");
    }
  };

  const handleDelete = async (row) => {
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const ok = await softDeleteAffiliate(row.id);
    if (ok) toast.success(`Removed ${row.name}`);
    else {
      setRows(snapshot);
      toast.error("Couldn't remove that affiliate.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Affiliate",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-text-secondary">{row.email}</p>
        </div>
      ),
    },
    {
      key: "slug",
      header: "Link token",
      render: (row) => (
        <code className="rounded bg-surface-card px-1.5 py-0.5 text-xs text-text-secondary">
          ?ref={row.slug}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusPill status={row.status} map={AFFILIATE_STATUS_MAP} />
      ),
    },
    {
      key: "earned",
      header: "Lifetime earned",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-foreground">
          {currency(totals[row.id]?.earned || 0)}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Pending",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {currency(totals[row.id]?.pending || 0)}
        </span>
      ),
    },
    {
      key: "invited",
      header: "Invited",
      render: (row) => (
        <span className="text-text-secondary">{formatDate(row.invitedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Actions for ${row.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-surface-subtle"
            >
              {row.status === "suspended" ? (
                <DropdownMenuItem onClick={() => handleStatus(row, "active")}>
                  <Play className="mr-2 h-4 w-4" />
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleStatus(row, "suspended")}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause affiliate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => handleDelete(row)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const inviteButton = (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => setInviteOpen(true)}
    >
      <Plus className="mr-2 h-4 w-4" />
      Invite affiliate
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Affiliates"
        description="Everyone who can earn commission on this project's ticket sales. Invite-only — an affiliate becomes active once they claim their invite in the members portal."
        actions={inviteButton}
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={AFFILIATE_STATUS_FILTER_OPTIONS}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search affiliates"
          className="sm:w-72"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.id}
          empty={
            rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No affiliates yet"
                description="Invite someone to start earning commission on your ticket sales."
                action={inviteButton}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No matching affiliates"
                description="No affiliate matches the current search and filter."
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite an affiliate</DialogTitle>
            <DialogDescription>
              They&apos;ll sign in through the members portal to see their links
              and earnings. Enrol them in an event&apos;s program afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Jamie Rivers"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="jamie@example.com"
              />
            </Field>
            <Field
              label="Link token"
              hint="Used in their tracked links. Left blank, it's built from their name."
            >
              <Input
                value={draft.slug}
                onChange={(e) => set("slug")(slugify(e.target.value))}
                placeholder={slugify(draft.name) || "jamie-rivers"}
              />
            </Field>
            <Field label="Notes" hint="Internal only — the affiliate never sees this.">
              <Textarea
                value={draft.notes}
                onChange={(e) => set("notes")(e.target.value)}
                rows={3}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={handleInvite}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default AffiliatesRosterScreen;
