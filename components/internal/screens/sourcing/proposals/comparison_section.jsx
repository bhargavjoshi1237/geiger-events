"use client";

import React, { useMemo, useState } from "react";
import {
  Ban,
  Eye,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Star,
  StarOff,
  Trophy,
} from "lucide-react";

import { EmptyState, SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { BidSummary } from "@/components/rfp/bid_form";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Slider } from "@geiger/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WEIGHTS,
  LINE_CATEGORIES,
  WEIGHT_KEYS,
  formatDay,
  formatMoney,
  formatPct,
} from "@/lib/sourcing/rfp_model";
import { WEIGHT_LABELS, compareBids } from "@/lib/sourcing/scoring";

import { BID_STATUS_MAP } from "./constants";

const VIEW_OPTIONS = [
  { value: "all", label: "All bids" },
  { value: "active", label: "Hide rejected" },
  { value: "shortlisted", label: "Shortlisted only" },
];

const WEIGHT_HINTS = {
  price: "Lowest total scores 100; others scale by how much more they cost.",
  capacity: "Best when the space holds the group with up to 50% headroom.",
  concessions: "Relative to the bid offering the most concessions.",
  terms: "Lower deposit and a higher attrition allowance score higher.",
};

function signedMoney(n, currency) {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) < 0.005) return formatMoney(0, currency);
  return `${n > 0 ? "+" : "-"}${formatMoney(Math.abs(n), currency)}`;
}

function WeightsCard({ weights, onChange, disabled }) {
  const sum = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0) || 1;
  return (
    <SectionCard
      title="Scoring weights"
      description="How much each factor counts. Shares always add up to 100%."
      action={
        <Button size="sm" variant="ghost" className="text-text-secondary" disabled={disabled} onClick={() => onChange({ ...DEFAULT_WEIGHTS })}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {WEIGHT_KEYS.map((k) => (
          <div key={k} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{WEIGHT_LABELS[k]}</span>
              <span className="tabular-nums text-text-secondary">{Math.round((weights[k] / sum) * 100)}%</span>
            </div>
            <Slider
              value={[weights[k]]}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
              onValueChange={([v]) => onChange({ ...weights, [k]: v })}
              aria-label={`${WEIGHT_LABELS[k]} weight`}
            />
            <p className="text-xs text-text-tertiary">{WEIGHT_HINTS[k]}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RecommendationCard({ recommendation, canAward, onAward, onView }) {
  if (!recommendation) return null;
  return (
    <SectionCard bodyPadding={false}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-card text-emerald-600 dark:text-emerald-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-medium text-text-secondary">Recommended</p>
            <p className="text-base font-semibold text-foreground">{recommendation.headline}</p>
          </div>
          <ul className="space-y-1 text-sm text-text-secondary">
            {recommendation.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={onView}>
            <Eye className="h-4 w-4" /> View bid
          </Button>
          {canAward ? (
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAward}>
              <Trophy className="h-4 w-4" /> Award
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function BidDetailDialog({ target, bids, rfp, onOpenChange, onStatus, onAward, canAct, canAward }) {
  const revisions = useMemo(
    () => (target ? bids.filter((b) => b.recipientId === target.recipient.id).sort((a, b) => b.revision - a.revision) : []),
    [target, bids],
  );
  const [picked, setPicked] = useState(null);
  const bid = revisions.find((b) => b.id === picked) || revisions[0] || null;
  const current = bid?.isCurrent;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) setPicked(null); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {target?.recipient.name}
            {bid ? <StatusPill status={bid.status} map={BID_STATUS_MAP} /> : null}
          </DialogTitle>
          <DialogDescription>
            {bid
              ? `Revision ${bid.revision}${current ? " (current)" : ""} · sent ${formatDay(bid.submittedAt)}${bid.submittedByName ? ` by ${bid.submittedByName}` : ""}`
              : "No bid"}
          </DialogDescription>
        </DialogHeader>
        {revisions.length > 1 ? (
          <Select value={bid?.id} onValueChange={setPicked}>
            <SelectTrigger className="w-full bg-surface-card sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {revisions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  Revision {b.revision} · {formatMoney(b.total, b.currency)}
                  {b.isCurrent ? " · current" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <BidSummary bid={bid} currency={rfp.currency} attendees={rfp.attendees} />
        </div>
        {current && canAct ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {bid.status === "shortlisted" ? (
                <Button variant="outline" onClick={() => onStatus(bid, "submitted")}>
                  <StarOff className="h-4 w-4" /> Unshortlist
                </Button>
              ) : bid.status !== "rejected" ? (
                <Button variant="outline" onClick={() => onStatus(bid, "shortlisted")}>
                  <Star className="h-4 w-4" /> Shortlist
                </Button>
              ) : null}
              {bid.status === "rejected" ? (
                <Button variant="outline" onClick={() => onStatus(bid, "submitted")}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              ) : (
                <Button variant="outline" onClick={() => onStatus(bid, "rejected")}>
                  <Ban className="h-4 w-4" /> Reject
                </Button>
              )}
            </div>
            {canAward && bid.status !== "rejected" ? (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAward(bid)}>
                <Trophy className="h-4 w-4" /> Award
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ComparisonSection({ form, recipients, bids, weightsLocked, canAct, canAward, onWeights, onBidStatus, onAward }) {
  const [view, setView] = useState("all");
  const [detail, setDetail] = useState(null);

  const entries = useMemo(() => {
    const current = new Map(bids.filter((b) => b.isCurrent).map((b) => [b.recipientId, b]));
    return recipients.filter((r) => current.has(r.id)).map((r) => ({ recipient: r, bid: current.get(r.id) }));
  }, [recipients, bids]);
  const cmp = useMemo(() => compareBids(form, entries), [form, entries]);
  const currency = form.currency || "USD";

  const columns = cmp.rows.filter((r) =>
    view === "shortlisted" ? r.status === "shortlisted" || r.status === "awarded" : view === "active" ? r.status !== "rejected" : true,
  );
  const entryFor = (row) => entries.find((e) => e.recipient.id === row.recipientId);
  const declinedWithBids = recipients.filter((r) => r.status === "declined" && bids.some((b) => b.recipientId === r.id && b.isCurrent));
  const recommendedId = cmp.recommendation?.recipientId;
  const usedCategories = LINE_CATEGORIES.filter((c) => columns.some((r) => r.categories[c.value] > 0));

  if (!entries.length || !cmp.rows.length) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Scale}
            title="No bids yet"
            description={
              form.status === "draft"
                ? "Send the RFP and bids land here as venues respond through their links."
                : "Bids land here as venues respond through their links."
            }
          />
        </div>
        <WeightsCard weights={form.scoringWeights} onChange={onWeights} disabled={weightsLocked} />
      </div>
    );
  }

  const cell = (row, content, extra) => (
    <td
      key={row.recipientId}
      className={cn(
        "border-l border-border px-4 py-2.5 text-right align-top text-sm tabular-nums",
        row.recipientId === recommendedId && "bg-emerald-500/[0.06]",
        row.status === "rejected" && "opacity-60",
        extra,
      )}
    >
      {content}
    </td>
  );
  const labelCell = (label, sub) => (
    <th className="sticky left-0 z-10 min-w-[170px] bg-surface-subtle px-4 py-2.5 text-left align-top text-sm font-normal text-text-secondary">
      {label}
      {sub ? <span className="block text-[11px] text-text-tertiary">{sub}</span> : null}
    </th>
  );
  const groupRow = (label) => (
    <tr className="border-t border-border bg-surface-card">
      <th
        colSpan={columns.length + 1}
        className="sticky left-0 px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-secondary"
      >
        {label}
      </th>
    </tr>
  );

  return (
    <div className="space-y-6">
      <RecommendationCard
        recommendation={cmp.recommendation}
        canAward={canAward}
        onView={() => {
          const row = cmp.rows.find((r) => r.recipientId === recommendedId);
          if (row) setDetail(entryFor(row));
        }}
        onAward={() => {
          const e = entries.find((x) => x.recipient.id === recommendedId);
          if (e) onAward(e.bid);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterDropdown value={view} onValueChange={setView} options={VIEW_OPTIONS} height="h-9" />
        <p className="text-xs text-text-secondary">
          {cmp.rows.length} bid{cmp.rows.length === 1 ? "" : "s"} in {currency}
          {cmp.budget ? ` · budget ${formatMoney(cmp.budget, currency)}` : ""}
          {form.attendees ? ` · ${form.attendees.toLocaleString("en-US")} attendees` : ""}
        </p>
      </div>

      {columns.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[170px] bg-surface-subtle px-4 py-3 text-left align-bottom text-xs font-medium text-text-secondary">
                  Ranked by weighted score
                </th>
                {columns.map((row) => (
                  <th
                    key={row.recipientId}
                    className={cn(
                      "min-w-[190px] border-l border-border px-4 py-3 text-right align-top",
                      row.recipientId === recommendedId && "bg-emerald-500/[0.06]",
                    )}
                  >
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {row.rank ? <span className="text-xs tabular-nums text-text-tertiary">#{row.rank}</span> : null}
                        <span className="text-sm font-semibold text-foreground">{row.name}</span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.recipientId === recommendedId ? <Badge variant="success">Best value</Badge> : null}
                        <StatusPill status={row.status} map={BID_STATUS_MAP} />
                      </div>
                      <span className="text-[11px] font-normal text-text-tertiary">Revision {row.revision}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupRow("Cost")}
              {usedCategories.map((c) => (
                <tr key={c.value} className="border-t border-border">
                  {labelCell(c.label)}
                  {columns.map((row) =>
                    cell(
                      row,
                      row.categories[c.value] > 0 ? formatMoney(row.categories[c.value], currency) : <span className="text-text-tertiary">—</span>,
                      cmp.bestByCategory[c.value] === row.recipientId && "font-medium text-emerald-700 dark:text-emerald-400",
                    ),
                  )}
                </tr>
              ))}
              <tr className="border-t border-border">
                {labelCell("Taxes & fees")}
                {columns.map((row) => cell(row, formatMoney(row.taxesFees, currency)))}
              </tr>
              <tr className="border-t border-border">
                {labelCell(<span className="font-semibold text-foreground">Total</span>)}
                {columns.map((row) =>
                  cell(
                    row,
                    formatMoney(row.total, currency),
                    cn("font-semibold text-foreground", row.total === cmp.lowest && "text-emerald-700 dark:text-emerald-400"),
                  ),
                )}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Per attendee")}
                {columns.map((row) => cell(row, row.perAttendee !== null ? formatMoney(row.perAttendee, currency, { cents: true }) : "—"))}
              </tr>
              <tr className="border-t border-border">
                {labelCell("vs budget", cmp.budget ? formatMoney(cmp.budget, currency) : "No budget set")}
                {columns.map((row) =>
                  cell(
                    row,
                    row.vsBudget === null ? (
                      "—"
                    ) : (
                      <>
                        {signedMoney(row.vsBudget, currency)}
                        <span className="block text-[11px]">{formatPct(row.vsBudgetPct, { signed: true })}</span>
                      </>
                    ),
                    row.vsBudget !== null && (row.vsBudget > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-400"),
                  ),
                )}
              </tr>
              <tr className="border-t border-border">
                {labelCell("vs lowest")}
                {columns.map((row) =>
                  cell(
                    row,
                    row.vsLowest === null ? (
                      "—"
                    ) : Math.abs(row.vsLowest) < 0.005 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Lowest</span>
                    ) : (
                      <>
                        {signedMoney(row.vsLowest, currency)}
                        <span className="block text-[11px] text-text-tertiary">{formatPct(row.vsLowestPct, { signed: true })}</span>
                      </>
                    ),
                  ),
                )}
              </tr>

              {groupRow("Fit & terms")}
              <tr className="border-t border-border">
                {labelCell("Capacity", form.attendees ? `For ${form.attendees.toLocaleString("en-US")}` : undefined)}
                {columns.map((row) => {
                  const e = entryFor(row);
                  return cell(row, row.capacity ? row.capacity.toLocaleString("en-US") : "—", e && row.scores.capacity < 60 && row.capacity ? "text-amber-700 dark:text-amber-400" : undefined);
                })}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Concessions")}
                {columns.map((row) =>
                  cell(
                    row,
                    row.concessions.length ? (
                      <span title={row.concessions.join("\n")} className="cursor-help underline decoration-dotted underline-offset-4">
                        {row.concessions.length}
                      </span>
                    ) : (
                      "None"
                    ),
                  ),
                )}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Deposit")}
                {columns.map((row) => {
                  const b = entryFor(row)?.bid;
                  return cell(row, b?.depositPct != null ? `${b.depositPct}%` : "—");
                })}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Attrition allowance")}
                {columns.map((row) => {
                  const b = entryFor(row)?.bid;
                  return cell(row, b?.attritionPct != null ? `${b.attritionPct}%` : "—");
                })}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Valid until", form.decisionDate ? `Decision ${formatDay(form.decisionDate)}` : undefined)}
                {columns.map((row) => {
                  const b = entryFor(row)?.bid;
                  return cell(row, b?.validUntil ? formatDay(b.validUntil) : "—", row.lapses && "text-amber-700 dark:text-amber-400");
                })}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Cancellation")}
                {columns.map((row) => {
                  const b = entryFor(row)?.bid;
                  return cell(
                    row,
                    b?.cancellationPolicy ? (
                      <span className="line-clamp-2 text-left text-xs text-text-secondary" title={b.cancellationPolicy}>
                        {b.cancellationPolicy}
                      </span>
                    ) : (
                      "—"
                    ),
                  );
                })}
              </tr>

              {groupRow(`Score · price ${Math.round(cmp.weights.price)} / capacity ${Math.round(cmp.weights.capacity)} / concessions ${Math.round(cmp.weights.concessions)} / terms ${Math.round(cmp.weights.terms)}`)}
              {WEIGHT_KEYS.map((k) => (
                <tr key={k} className="border-t border-border">
                  {labelCell(WEIGHT_LABELS[k])}
                  {columns.map((row) => cell(row, row.scores[k]))}
                </tr>
              ))}
              <tr className="border-t border-border">
                {labelCell(<span className="font-semibold text-foreground">Weighted score</span>)}
                {columns.map((row) =>
                  cell(
                    row,
                    row.weighted === null ? "—" : `${row.weighted}/100`,
                    cn("font-semibold text-foreground", row.recipientId === recommendedId && "text-emerald-700 dark:text-emerald-400"),
                  ),
                )}
              </tr>
              <tr className="border-t border-border">
                {labelCell("Why")}
                {columns.map((row) =>
                  cell(
                    row,
                    <ul className="space-y-0.5 text-left text-xs text-text-secondary">
                      {row.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>,
                  ),
                )}
              </tr>
              <tr className="border-t border-border">
                {labelCell("")}
                {columns.map((row) => {
                  const e = entryFor(row);
                  const b = e?.bid;
                  return cell(
                    row,
                    <div className="flex flex-col items-end gap-1.5">
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setDetail(e)}>
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                      {canAct && b ? (
                        b.status === "rejected" ? (
                          <Button size="sm" variant="ghost" className="w-full" onClick={() => onBidStatus(b, "submitted")}>
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        ) : (
                          <div className="flex w-full gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-1"
                              onClick={() => onBidStatus(b, b.status === "shortlisted" ? "submitted" : "shortlisted")}
                            >
                              {b.status === "shortlisted" ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                              {b.status === "shortlisted" ? "Unlist" : "Shortlist"}
                            </Button>
                            <Button size="sm" variant="ghost" className="flex-1" onClick={() => onBidStatus(b, "rejected")}>
                              <Ban className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        )
                      ) : null}
                      {canAward && b && b.status !== "rejected" ? (
                        <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAward(b)}>
                          <Trophy className="h-3.5 w-3.5" /> Award
                        </Button>
                      ) : null}
                    </div>,
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={SlidersHorizontal} title="No bids match this view" description="Switch the view to see every bid." />
        </div>
      )}

      {declinedWithBids.length ? (
        <p className="text-xs text-text-secondary">
          Left out: {declinedWithBids.map((r) => r.name).join(", ")} — declined after bidding.
        </p>
      ) : null}

      <WeightsCard weights={form.scoringWeights} onChange={onWeights} disabled={weightsLocked} />

      <BidDetailDialog
        target={detail}
        bids={bids}
        rfp={form}
        canAct={canAct}
        canAward={canAward}
        onOpenChange={(o) => !o && setDetail(null)}
        onStatus={async (b, s) => {
          await onBidStatus(b, s);
          setDetail(null);
        }}
        onAward={(b) => {
          setDetail(null);
          onAward(b);
        }}
      />
    </div>
  );
}

export default ComparisonSection;
