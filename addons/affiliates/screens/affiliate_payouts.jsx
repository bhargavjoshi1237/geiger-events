"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Send } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useProject } from "@/context/project-context";
import { listAffiliates, listAffiliateTotals } from "../lib/affiliates";
import { createPayoutBatch, listPayouts, updatePayout } from "../lib/commissions";
import {
  currency,
  formatDate,
  PAYOUT_STATE_MAP,
} from "../lib/constants";

// Payout batches. Record-only: creating a batch collects an affiliate's APPROVED
// commissions, marks them paid and records what you sent. No money moves from
// here — `method` and `reference` are the hook a Stripe Connect transfer would
// slot into later, exactly like the Orders module's refund records.

export function AffiliatePayoutsScreen() {
  const { projectId } = useProject();
  const [payouts, setPayouts] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [draft, setDraft] = useState({ affiliateId: "", method: "manual", reference: "" });
  const [busy, setBusy] = useState(false);

  // Reload payouts + the owed rollups. State is only touched in the promise
  // continuation, so this is safe from an effect body as well as a handler.
  const load = useCallback(
    () =>
      projectId
        ? Promise.all([
            listPayouts(projectId),
            listAffiliates(projectId),
            listAffiliateTotals(projectId),
          ]).then(([p, a, t]) => {
            setPayouts(p ?? []);
            setAffiliates(a ?? []);
            setTotals(t ?? {});
            setLoading(false);
          })
        : Promise.resolve(),
    [projectId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Only affiliates with approved-but-unpaid commission can be settled.
  const payable = useMemo(
    () =>
      affiliates
        .map((a) => ({ ...a, owed: totals[a.id]?.approved || 0 }))
        .filter((a) => a.owed > 0)
        .sort((a, b) => b.owed - a.owed),
    [affiliates, totals],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payouts;
    return payouts.filter(
      (p) =>
        (p.affiliate?.name || "").toLowerCase().includes(q) ||
        (p.reference || "").toLowerCase().includes(q),
    );
  }, [payouts, search]);

  const stats = useMemo(() => {
    const owed = payable.reduce((s, a) => s + a.owed, 0);
    const sent = payouts
      .filter((p) => p.state === "sent")
      .reduce((s, p) => s + p.amount, 0);
    const drafts = payouts.filter((p) => p.state === "draft").length;
    return [
      { label: "Ready to pay", value: currency(owed) },
      { label: "Affiliates owed", value: String(payable.length) },
      { label: "Paid out", value: currency(sent) },
      { label: "Draft batches", value: String(drafts) },
    ];
  }, [payable, payouts]);

  const handleCreate = async () => {
    if (!draft.affiliateId) return toast.error("Pick who you're paying.");
    setBusy(true);
    const created = await createPayoutBatch(projectId, draft.affiliateId, {
      method: draft.method,
      reference: draft.reference.trim(),
    });
    setBusy(false);
    if (created) {
      setDraft({ affiliateId: "", method: "manual", reference: "" });
      setPayOpen(false);
      toast.success(`Payout batch created for ${currency(created.amount)}`);
      load();
    } else {
      toast.error("Couldn't create that payout — the affiliate may have nothing approved.");
    }
  };

  const handleMarkSent = async (payout) => {
    const previous = payout.state;
    setPayouts((prev) =>
      prev.map((p) => (p.id === payout.id ? { ...p, state: "sent" } : p)),
    );
    const saved = await updatePayout(payout.id, { state: "sent" });
    if (saved) toast.success("Marked as sent");
    else {
      setPayouts((prev) =>
        prev.map((p) => (p.id === payout.id ? { ...p, state: previous } : p)),
      );
      toast.error("Couldn't update that payout.");
    }
  };

  const columns = [
    {
      key: "affiliate",
      header: "Affiliate",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.affiliate?.name || "Unknown"}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {row.affiliate?.email || ""}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => (
        <span className="tabular-nums font-medium text-foreground">
          {currency(row.amount)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (row) => (
        <span className="capitalize text-text-secondary">{row.method}</span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => (
        <span className="text-text-secondary">{row.reference || "—"}</span>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (row) => <StatusPill status={row.state} map={PAYOUT_STATE_MAP} />,
    },
    {
      key: "created",
      header: "Created",
      render: (row) => (
        <span className="text-text-secondary">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        row.state === "draft" ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={() => handleMarkSent(row)}>
              <Send className="mr-2 h-4 w-4" />
              Mark sent
            </Button>
          </div>
        ) : null,
    },
  ];

  const payButton = (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => setPayOpen(true)}
      disabled={payable.length === 0}
    >
      <Banknote className="mr-2 h-4 w-4" />
      Create payout
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Affiliate payouts"
        description="Settle approved commission into a batch. This records what you paid — it doesn't move money."
        actions={payButton}
      />

      <StatsBar stats={stats} />

      {payable.length > 0 ? (
        <SectionCard
          title="Ready to pay"
          description="Affiliates with approved commission that hasn't been settled yet."
        >
          <div className="space-y-2">
            {payable.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {a.name}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{a.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium text-emerald-400">
                    {currency(a.owed)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft((d) => ({ ...d, affiliateId: a.id }));
                      setPayOpen(true);
                    }}
                  >
                    Pay
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <Toolbar>
        <span className="text-sm text-text-secondary">Payout history</span>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search payouts"
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
            <EmptyState
              icon={Banknote}
              title={payouts.length === 0 ? "No payouts yet" : "No matching payouts"}
              description={
                payouts.length === 0
                  ? "Approve commissions on the Commissions screen, then settle them into a batch here."
                  : "No payout matches that search."
              }
            />
          }
        />
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a payout</DialogTitle>
            <DialogDescription>
              Collects every approved commission for this affiliate, marks them
              paid, and records the batch. No money is transferred.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Affiliate">
              <select
                value={draft.affiliateId}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, affiliateId: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-border bg-surface-card px-3 text-sm text-foreground"
              >
                <option value="">Choose an affiliate</option>
                {payable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {currency(a.owed)} approved
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Method">
              <Input
                value={draft.method}
                onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value }))}
                placeholder="manual / bank / paypal"
              />
            </Field>
            <Field label="Reference" hint="Your transfer id or note, for reconciliation.">
              <Input
                value={draft.reference}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, reference: e.target.value }))
                }
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy}
              onClick={handleCreate}
            >
              Create payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default AffiliatePayoutsScreen;
