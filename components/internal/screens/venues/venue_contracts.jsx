"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, FileSignature } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/internal/shared/screen_kit";
import { BidSummary } from "@/components/rfp/bid_form";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import { listVenueContracts } from "@/lib/supabase/venues";
import { cn } from "@/lib/utils";
import { useOptionalProject } from "@/context/project-context";
import { tabToSlug } from "@/lib/workspace/tabs";
import {
  formatDateRange,
  formatDay,
  formatMoney,
  lineCategoryLabel,
  normalizeLineItems,
} from "@/lib/sourcing/rfp_model";

// Rates and terms agreed through Smart Custom Proposals; events.rfp_award appends one entry per awarded RFP.

const PROPOSALS_TAB = "Smart Custom Proposals";

const proposalsPath = (projectId, rfpId) =>
  `/project/${projectId}/${tabToSlug(PROPOSALS_TAB)}${rfpId ? `?record=${encodeURIComponent(rfpId)}` : ""}`;

function ContractRow({ contract, projectId, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const items = normalizeLineItems(contract.lineItems);
  const categories = [...new Set(items.map((l) => lineCategoryLabel(l.category)))];
  const meta = [
    contract.awardedAt ? `Awarded ${formatDay(contract.awardedAt)}` : "",
    formatDateRange(contract.startDate, contract.endDate),
    Number(contract.attendees) > 0 ? `${Number(contract.attendees).toLocaleString("en-US")} attendees` : "",
  ].filter(Boolean);
  const summary = items.length
    ? `${items.length} line item${items.length === 1 ? "" : "s"} · ${categories.join(", ")}`
    : "No line items";

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <FileSignature className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{contract.rfpTitle || "Untitled RFP"}</p>
            <p className="truncate text-xs text-text-secondary">{meta.join(" · ") || "No dates recorded"}</p>
            <p className="truncate text-xs text-text-tertiary">{summary}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
          <div className="mr-1 text-right">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(contract.total, contract.currency || "USD")}
            </p>
            <p className="text-xs text-text-tertiary">
              {contract.validUntil ? `Valid until ${formatDay(contract.validUntil)}` : contract.currency || "USD"}
            </p>
          </div>
          {projectId && contract.rfpId ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Link href={proposalsPath(projectId, contract.rfpId)}>
                <ArrowUpRight className="h-4 w-4" /> Open RFP
              </Link>
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={open ? "Hide terms" : "Show terms"}
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="mt-4 sm:pl-12">
          <BidSummary bid={contract} currency={contract.currency} attendees={contract.attendees} />
        </div>
      ) : null}
    </li>
  );
}

export function VenueContractsSection({ venue }) {
  const projectId = useOptionalProject()?.projectId ?? venue?.projectId ?? null;
  const venueId = venue?.id ?? null;
  // Contracts live in the member-only events.venue_contracts (newest first, one per RFP), not on the public venue row.
  const [loaded, setLoaded] = useState({ venueId: null, contracts: [] });
  useEffect(() => {
    if (!venueId) return undefined;
    let alive = true;
    listVenueContracts(venueId).then((rows) => {
      if (alive) setLoaded({ venueId, contracts: Array.isArray(rows) ? rows : [] });
    });
    return () => {
      alive = false;
    };
  }, [venueId]);
  const loading = Boolean(venueId) && loaded.venueId !== venueId;
  const contracts = loading ? [] : loaded.contracts;

  return (
    <SectionCard
      title="Contracts"
      description="Rates and terms agreed with this venue through Smart Custom Proposals. Awarding an RFP saves the winning bid here."
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <LogoLoading size={44} />
        </div>
      ) : contracts.length ? (
        <ul className="divide-y divide-border">
          {contracts.map((c, i) => (
            <ContractRow
              key={c.rfpId || c.bidId || i}
              contract={c}
              projectId={projectId}
              defaultOpen={i === 0}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileSignature}
          title="No contracts yet"
          description="Award an RFP to this venue in Smart Custom Proposals and the agreed line items, concessions and terms are saved here."
          action={
            projectId ? (
              <Button
                asChild
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <Link href={proposalsPath(projectId)}>Open Smart Custom Proposals</Link>
              </Button>
            ) : null
          }
        />
      )}
    </SectionCard>
  );
}

export default VenueContractsSection;
