"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, Copy, Eye, FileText, Lock, LockOpen, Plus, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LoadingArea } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
import { conferenceApi } from "@/lib/supabase/conference";
import { listVenues } from "@/lib/supabase/venues";
import {
  addRecipients,
  createRfp,
  createRfpPreset,
  listProjectCurrentBids,
  listProjectRecipients,
  listRfpPresets,
  listRfps,
  softDeleteRfp,
  updateRfp,
} from "@/lib/supabase/rfps";
import { BUILT_IN_PRESETS, defaultDecisionDate, defaultDeadline } from "@/lib/sourcing/drafting";
import { formatMoney, formatPct } from "@/lib/sourcing/rfp_model";
import { budgetReference } from "@/lib/sourcing/scoring";
import { pipelineRecipients } from "@/lib/sourcing/suggest";

import { CreateRfpDialog } from "./proposals/create_rfp_dialog";
import { DeadlineChip } from "./proposals/deadline_chip";
import { RfpDetail } from "./proposals/rfp_detail";
import { RFP_STATUS_FILTER_OPTIONS, RFP_STATUS_MAP, useNow } from "./proposals/constants";

const COPY_KEYS = [
  "eventId", "summary", "startDate", "endDate", "datesFlexible", "alternateDates", "attendees", "location",
  "roomRequirements", "sleepingRooms", "fnbRequirements", "fnbMinimum", "avNeeds", "budgetMin", "budgetMax",
  "currency", "shareBudget", "decisionDate", "contactName", "contactEmail", "notes", "scoringWeights",
];

// Drops the one-shot ?leads= handoff so Back or a reload doesn't reopen the dialog.
function clearLeadsParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("leads")) return;
  url.searchParams.delete("leads");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function SmartProposalsScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const now = useNow();

  const [rfps, setRfps] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [bids, setBids] = useState([]);
  const [events, setEvents] = useState([]);
  const [savedPresets, setSavedPresets] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  // Venue Sourcing hands pipeline leads over as ?leads=<id,…>; they become the new RFP's recipients.
  const leadParam = useSearchParams().get("leads") || "";
  const [handoff, setHandoff] = useState(null);

  useEffect(() => {
    const ids = new Set(leadParam.split(",").filter(Boolean));
    if (!ids.size || !projectId) return undefined;
    let alive = true;
    Promise.all([conferenceApi.list(projectId, "venue_lead"), listVenues(projectId)]).then(([leads, venues]) => {
      if (!alive) return;
      const list = pipelineRecipients((leads ?? []).filter((r) => ids.has(r.id)), venues ?? []);
      if (list.length) {
        setHandoff(list);
        setCreateOpen(true);
      } else {
        toast.error("Those pipeline venues couldn't be found.");
      }
      clearLeadsParam();
    });
    return () => {
      alive = false;
    };
  }, [leadParam, projectId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listRfps(projectId),
      listProjectRecipients(projectId),
      listProjectCurrentBids(projectId),
      listEvents(projectId),
      listRfpPresets(projectId),
      getUser(),
    ]).then(([r, rec, b, ev, presets, u]) => {
      if (!alive) return;
      setRfps(r ?? []);
      setRecipients(rec ?? []);
      setBids(b ?? []);
      setEvents(ev ?? []);
      setSavedPresets(presets ?? []);
      setUser(u ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const presets = useMemo(() => [...savedPresets, ...BUILT_IN_PRESETS], [savedPresets]);
  const eventNames = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e.name])), [events]);

  // Per RFP: invited count, responders with a live bid, and the best total.
  const summary = useMemo(() => {
    const out = {};
    const bidByRecipient = new Map(bids.map((b) => [b.recipientId, b]));
    for (const r of recipients) {
      const s = (out[r.rfpId] ||= { invited: 0, responded: 0, waiting: 0, best: null, bids: 0 });
      if (!r.invitedAt) continue;
      s.invited += 1;
      if (["invited", "viewed"].includes(r.status)) s.waiting += 1;
      const b = bidByRecipient.get(r.id);
      if (b && r.status !== "declined") {
        s.responded += 1;
        s.bids += 1;
        if (b.status !== "rejected" && (s.best === null || b.total < s.best)) s.best = b.total;
      }
    }
    return out;
  }, [recipients, bids]);

  const stats = useMemo(() => {
    const open = rfps.filter((r) => r.status === "sent");
    const drafts = rfps.filter((r) => r.status === "draft").length;
    const waiting = open.reduce((n, r) => n + (summary[r.id]?.waiting || 0), 0);
    const received = rfps.reduce((n, r) => n + (summary[r.id]?.bids || 0), 0);
    const deltas = [];
    const byRfp = Object.fromEntries(rfps.map((r) => [r.id, r]));
    const recipientRfp = new Map(recipients.map((r) => [r.id, r.rfpId]));
    for (const b of bids) {
      const rfp = byRfp[recipientRfp.get(b.recipientId)];
      const budget = rfp ? budgetReference(rfp) : null;
      if (budget && b.total > 0 && b.status !== "rejected") deltas.push(((b.total - budget) / budget) * 100);
    }
    const avg = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null;
    return [
      { label: "Open RFPs", value: String(open.length), footer: `${drafts} draft${drafts === 1 ? "" : "s"}` },
      { label: "Awaiting responses", value: String(waiting), footer: "Invited, no bid yet" },
      { label: "Bids received", value: String(received), footer: `Across ${rfps.length} RFP${rfps.length === 1 ? "" : "s"}` },
      {
        label: "Avg bid vs budget",
        value: avg === null ? "—" : formatPct(avg, { signed: true }),
        footer: avg === null ? "No budgets to compare" : avg > 0 ? "Over budget on average" : "Under budget on average",
      },
    ];
  }, [rfps, recipients, bids, summary]);

  const eventOptions = useMemo(
    () => [{ value: "all", label: "All Events" }, ...events.map((e) => ({ value: e.id, label: e.name || "Untitled event" }))],
    [events],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rfps.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
      if (q && !`${r.title} ${r.location} ${eventNames[r.eventId] || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rfps, search, status, eventFilter, eventNames]);

  const pager = usePagination(filtered, { resetKey: `${search}|${status}|${eventFilter}` });
  const selected = useMemo(() => (recordId ? rfps.find((r) => r.id === recordId) || null : null), [recordId, rfps]);

  const replaceRfp = (row) => setRfps((prev) => prev.map((r) => (r.id === row.id ? row : r)));

  const handleCreate = async (draft) => {
    const row = await createRfp({
      ...draft,
      projectId,
      createdBy: user?.id || null,
      contactName: user?.name || "",
      contactEmail: user?.email || "",
    });
    if (!row) {
      toast.error("Couldn't create the RFP.");
      return false;
    }
    setRfps((prev) => [row, ...prev]);
    if (handoff?.length) {
      const added = await addRecipients(row.id, projectId, handoff, user?.id || null);
      setHandoff(null);
      if (added) {
        setRecipients((prev) => [...prev, ...added]);
        toast.success(`"${row.title}" created with ${added.length} venue${added.length === 1 ? "" : "s"} from your pipeline.`);
      } else {
        toast.error(`"${row.title}" created, but the pipeline venues couldn't be added — add them in Recipients.`);
      }
    } else {
      toast.success(`"${row.title}" created.`);
    }
    openRecord(row.id);
    return true;
  };

  const duplicate = async (rfp) => {
    const responseDeadline = defaultDeadline(Date.now());
    const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, rfp[k]]));
    const row = await createRfp({
      ...copy,
      title: `${rfp.title || "Untitled RFP"} (copy)`,
      responseDeadline,
      decisionDate: defaultDecisionDate(responseDeadline),
      projectId,
      createdBy: user?.id || null,
    });
    if (!row) {
      toast.error("Couldn't duplicate the RFP.");
      return;
    }
    setRfps((prev) => [row, ...prev]);
    toast.success("Duplicated as a new draft — recipients and bids aren't copied.");
    openRecord(row.id);
  };

  const changeStatus = async (rfp, next, message) => {
    const row = await updateRfp(rfp.id, { status: next });
    if (!row) {
      toast.error("Couldn't update the RFP.");
      return;
    }
    replaceRfp(row);
    toast.success(message);
  };

  const remove = async (rfp) => {
    const ok = await softDeleteRfp(rfp.id);
    if (!ok) {
      toast.error("Couldn't delete the RFP.");
      return;
    }
    setRfps((prev) => prev.filter((r) => r.id !== rfp.id));
    toast.success(`Deleted "${rfp.title}".`);
  };

  const savePreset = async ({ name, description, requirements }) => {
    const row = await createRfpPreset({ projectId, name, description, requirements, createdBy: user?.id });
    if (!row) {
      toast.error("Couldn't save the preset.");
      return false;
    }
    setSavedPresets((prev) => [row, ...prev]);
    toast.success(`Saved "${row.name}".`);
    return true;
  };

  // Recipient and bid counts can change inside the detail; reload them when it closes.
  const backToList = () => {
    closeRecord();
    Promise.all([listProjectRecipients(projectId), listProjectCurrentBids(projectId)]).then(([rec, b]) => {
      if (rec) setRecipients(rec);
      if (b) setBids(b);
    });
  };

  if (selected) {
    return (
      <RfpDetail
        key={selected.id}
        rfp={selected}
        events={events}
        presets={presets}
        onBack={backToList}
        onChange={replaceRfp}
        onDuplicate={duplicate}
        onSavePreset={savePreset}
        onDeleted={(id) => {
          setRfps((prev) => prev.filter((r) => r.id !== id));
          closeRecord();
        }}
      />
    );
  }

  const columns = [
    {
      key: "rfp",
      header: "RFP",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-foreground">{r.title || "Untitled RFP"}</span>
            <span className="truncate text-xs text-text-secondary">
              {[eventNames[r.eventId], r.attendees ? `${r.attendees.toLocaleString("en-US")} pax` : "", r.location]
                .filter(Boolean)
                .join(" · ") || "No event linked"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={RFP_STATUS_MAP} />,
    },
    {
      key: "responses",
      header: "Responded",
      render: (r) => {
        const s = summary[r.id];
        return s?.invited ? (
          <span className="text-sm tabular-nums text-text-secondary">
            <span className="font-medium text-foreground">{s.responded}</span>/{s.invited}
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">Not sent</span>
        );
      },
    },
    {
      key: "best",
      header: "Best total",
      align: "right",
      className: "text-right font-semibold tabular-nums text-foreground dark:text-white",
      render: (r) => {
        const best = summary[r.id]?.best;
        return best === null || best === undefined ? (
          <span className="font-normal text-text-tertiary">—</span>
        ) : (
          formatMoney(best, r.currency)
        );
      },
    },
    {
      key: "deadline",
      header: "Deadline",
      align: "right",
      className: "text-right",
      render: (r) => <DeadlineChip rfp={r} now={now} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <ActionMenu
          label={`Actions for ${r.title}`}
          items={[
            { icon: Eye, label: "Open", onSelect: () => openRecord(r.id) },
            { icon: Copy, label: "Duplicate", onSelect: () => duplicate(r) },
            r.status === "sent" && { icon: Lock, label: "Close bidding", onSelect: () => changeStatus(r, "closed", "Bidding closed.") },
            r.status === "closed" && { icon: LockOpen, label: "Reopen bidding", onSelect: () => changeStatus(r, "sent", "Bidding reopened.") },
            { separator: true },
            !["awarded", "cancelled"].includes(r.status) && {
              icon: Ban,
              label: "Cancel RFP",
              destructive: true,
              onSelect: () => setConfirm({ kind: "cancel", rfp: r }),
            },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setConfirm({ kind: "delete", rfp: r }) },
          ]}
        />
      ),
    },
  ];

  const hasFilters = Boolean(search) || status !== "all" || eventFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Smart Custom Proposals"
        description="Send one structured RFP to many venues, collect priced bids through private links, compare them side by side and award the winner."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New RFP
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={status} onValueChange={setStatus} options={RFP_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={eventFilter} onValueChange={setEventFilter} options={eventOptions} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search RFPs, events, locations…" />
      </Toolbar>

      {loading ? (
        <LoadingArea size={48} panel label="Loading RFPs" />
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(r) => r.id}
            onRowClick={(r) => openRecord(r.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={FileText}
                  title={rfps.length ? "No RFPs match your filters" : "No RFPs yet"}
                  description={
                    rfps.length
                      ? "Try clearing the search or filters."
                      : "Create an RFP from an event or a preset, invite venues, and their bids arrive here ready to compare."
                  }
                  action={
                    hasFilters && rfps.length ? (
                      <Button
                        variant="outline"
                        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        onClick={() => {
                          setSearch("");
                          setStatus("all");
                          setEventFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4" /> New RFP
                      </Button>
                    )
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="RFPs" />
        </div>
      )}

      <CreateRfpDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setHandoff(null);
        }}
        events={events}
        presets={presets}
        recipients={handoff}
        onCreate={handleCreate}
      />

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "delete" ? "Delete RFP" : "Cancel RFP"}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "delete" ? (
                <>
                  Delete <span className="font-medium text-foreground">{confirm?.rfp.title}</span>? Every venue link stops
                  working. This can&apos;t be undone.
                </>
              ) : (
                <>
                  Cancel <span className="font-medium text-foreground">{confirm?.rfp.title}</span>? Venues can no longer bid
                  and their links show it as cancelled.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                const { kind, rfp } = confirm;
                setConfirm(null);
                if (kind === "delete") remove(rfp);
                else changeStatus(rfp, "cancelled", "RFP cancelled.");
              }}
            >
              {confirm?.kind === "delete" ? <Trash2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {confirm?.kind === "delete" ? "Delete" : "Cancel RFP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default SmartProposalsScreen;
