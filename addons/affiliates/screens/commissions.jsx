"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Percent, Undo2 } from "lucide-react";

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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useProject } from "@/context/project-context";
import {
  approveCommissions,
  listCommissions,
  reverseCommissions,
} from "../lib/commissions";
import {
  COMMISSION_STATE_FILTER_OPTIONS,
  COMMISSION_STATE_MAP,
  currency,
  formatDate,
  formatRate,
} from "../lib/constants";

// The commission ledger. Clearance is MANUAL by design: attribution files every
// row as `pending` and nothing leaves that state without someone approving it
// here. Refunds reverse rows through the clawback RPC, not this screen.

export function CommissionsScreen() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  // Reload the ledger. State is only touched in the promise continuation, so
  // this is safe to call from an effect body as well as from a handler.
  const load = React.useCallback(
    () =>
      projectId
        ? listCommissions(projectId).then((result) => {
            setRows(result ?? []);
            setSelected(new Set());
            setLoading(false);
          })
        : Promise.resolve(),
    [projectId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (stateFilter !== "all" && row.state !== stateFilter) return false;
      if (!q) return true;
      return (
        (row.affiliate?.name || "").toLowerCase().includes(q) ||
        (row.order?.buyerEmail || "").toLowerCase().includes(q) ||
        (row.order?.ticketName || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, stateFilter]);

  const stats = useMemo(() => {
    const sum = (state) =>
      rows.filter((r) => r.state === state).reduce((s, r) => s + r.amount, 0);
    return [
      { label: "Pending", value: currency(sum("pending")) },
      { label: "Approved", value: currency(sum("approved")) },
      { label: "Paid", value: currency(sum("paid")) },
      { label: "Reversed", value: currency(sum("reversed")) },
    ];
  }, [rows]);

  // Only pending rows can be approved, and only pending/approved reversed — so
  // the bulk bar reflects what the action will actually touch.
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.id)),
    [filtered, selected],
  );
  const approvable = selectedRows.filter((r) => r.state === "pending");
  const reversible = selectedRows.filter((r) =>
    ["pending", "approved"].includes(r.state),
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)),
    );

  const handleApprove = async () => {
    if (!approvable.length) return;
    setBusy(true);
    const ok = await approveCommissions(approvable.map((r) => r.id));
    setBusy(false);
    if (ok) {
      toast.success(`Approved ${approvable.length} commission${approvable.length === 1 ? "" : "s"}`);
      load();
    } else {
      toast.error("Couldn't approve those commissions.");
    }
  };

  const handleReverse = async () => {
    if (!reversible.length) return;
    setBusy(true);
    const ok = await reverseCommissions(reversible.map((r) => r.id), "manual");
    setBusy(false);
    if (ok) {
      toast.success(`Reversed ${reversible.length} commission${reversible.length === 1 ? "" : "s"}`);
      load();
    } else {
      toast.error("Couldn't reverse those commissions.");
    }
  };

  const columns = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={filtered.length > 0 && selected.size === filtered.length}
          onCheckedChange={toggleAll}
          aria-label="Select all commissions"
        />
      ),
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected.has(row.id)}
            onCheckedChange={() => toggle(row.id)}
            aria-label={`Select commission for ${row.affiliate?.name || "affiliate"}`}
          />
        </div>
      ),
    },
    {
      key: "affiliate",
      header: "Affiliate",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.affiliate?.name || "Unknown"}
          </p>
          <p className="truncate text-xs text-text-secondary">
            via {row.source === "code" ? "code" : "tracked link"}
          </p>
        </div>
      ),
    },
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">
            {row.order?.ticketName || "Ticket"} × {row.order?.quantity || 0}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {row.order?.buyerEmail || ""}
          </p>
        </div>
      ),
    },
    {
      key: "base",
      header: "Base",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {currency(row.baseAmount)}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (row) => (
        <span className="text-text-secondary">
          {formatRate(row.rateModel, row.rateValue)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Commission",
      align: "right",
      render: (row) => (
        <span className="tabular-nums font-medium text-foreground">
          {currency(row.amount)}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (row) => (
        <StatusPill status={row.state} map={COMMISSION_STATE_MAP} />
      ),
    },
    {
      key: "created",
      header: "Earned",
      render: (row) => (
        <span className="text-text-secondary">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Commissions"
        description="Every attributed sale. Nothing clears automatically — approve rows here when you're satisfied the order will stick, then settle them into a payout."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={stateFilter}
            onValueChange={setStateFilter}
            options={COMMISSION_STATE_FILTER_OPTIONS}
          />
          {selectedRows.length > 0 ? (
            <>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={busy || approvable.length === 0}
                onClick={handleApprove}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve {approvable.length || ""}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:bg-red-500/10"
                disabled={busy || reversible.length === 0}
                onClick={handleReverse}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Reverse {reversible.length || ""}
              </Button>
            </>
          ) : null}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by affiliate, buyer or ticket"
          className="sm:w-80"
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
                icon={Percent}
                title="No commissions yet"
                description="Commissions appear here once an affiliate's link or code converts a ticket sale."
              />
            ) : (
              <EmptyState
                icon={Percent}
                title="No matching commissions"
                description="No commission matches the current search and filter."
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStateFilter("all");
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
    </MainScreenWrapper>
  );
}

export default CommissionsScreen;
