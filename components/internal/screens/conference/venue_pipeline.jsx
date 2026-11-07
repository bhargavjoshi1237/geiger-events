"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, Building2, FileText, Loader2, MapPin } from "lucide-react";

import { EmptyState, SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { LoadingArea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { useOptionalProject } from "@/context/project-context";
import { conferenceApi } from "@/lib/supabase/conference";
import { isSupabaseConfigured } from "@/lib/supabase/events";
import { createVenue, getVenue, listVenues } from "@/lib/supabase/venues";
import { getUser } from "@/lib/supabase/user";
import { isEmail } from "@/lib/sourcing/rfp_model";
import { leadToVenue, matchVenueForLead } from "@/lib/venues/discovery";
import { tabToSlug } from "@/lib/workspace/tabs";
import { MODULES } from "./modules";
import { VENUE_LEAD_STATUS_MAP } from "./constants";

// Pipeline-only extras on top of the Venue lead module: convert a lead into the Venues book and
// hand leads to Smart Custom Proposals. The link lives in config.venueId, the same key rfp_award writes.

const BASE = MODULES.venue_lead;

const venuePath = (projectId, venueId) => `/project/${projectId}/venues?venue=${encodeURIComponent(venueId)}`;

// Smart Custom Proposals reads ?leads= and opens a new RFP with these leads as recipients.
const proposalsPath = (projectId, leadIds) =>
  `/project/${projectId}/${tabToSlug("Smart Custom Proposals")}?leads=${leadIds.map(encodeURIComponent).join(",")}`;

const outlineClass =
  "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function InVenuesCell({ record }) {
  const projectId = useOptionalProject()?.projectId;
  const venueId = record.config?.venueId;
  if (!venueId) return <span className="text-text-tertiary">—</span>;
  if (!projectId) return <span className="text-sm text-text-secondary">In Venues</span>;
  return (
    <Link
      href={venuePath(projectId, venueId)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground"
    >
      <Building2 className="h-3.5 w-3.5" /> In Venues
    </Link>
  );
}

function InVenuesBadge({ record }) {
  return record?.config?.venueId ? <Badge variant="neutral">In Venues</Badge> : null;
}

// Detail section: convert to a venue (idempotent) and request a proposal for this lead.
function LeadVenuePanel({ record, commit }) {
  const router = useRouter();
  const projectId = useOptionalProject()?.projectId ?? record.projectId ?? null;
  const venueId = record.config?.venueId || null;
  const [lookup, setLookup] = useState({ id: null, venue: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!venueId || !isSupabaseConfigured()) return undefined;
    let alive = true;
    getVenue(venueId).then((venue) => alive && setLookup({ id: venueId, venue }));
    return () => {
      alive = false;
    };
  }, [venueId]);

  const venue = lookup.id === venueId ? lookup.venue : null;
  // A soft-deleted venue reads back as null, which frees the lead to be converted again.
  const missing = Boolean(venueId) && isSupabaseConfigured() && lookup.id === venueId && !venue;
  const linked = Boolean(venueId) && !missing;
  const email = (linked && venue?.contactEmail) || record.config?.contactEmail || "";

  const convert = async () => {
    if (!projectId) {
      toast.error("Open a project first.");
      return;
    }
    setBusy(true);
    try {
      // An RFP award may have linked this lead since the list loaded; adopt that instead of duplicating.
      const fresh = await conferenceApi.get(record.id);
      const freshVenueId = fresh?.config?.venueId;
      if (freshVenueId && freshVenueId !== venueId) {
        commit({ status: fresh.status, config: { ...record.config, venueId: freshVenueId } });
        toast.success("Already in your Venues book.");
        return;
      }
      const existing = matchVenueForLead(await listVenues(projectId), record);
      let target = existing;
      if (!target) {
        const user = await getUser();
        target = await createVenue({
          id: crypto.randomUUID(),
          ...leadToVenue(record),
          projectId,
          createdBy: user?.id || null,
        });
      }
      if (!target) {
        toast.error("Couldn't add the venue.");
        return;
      }
      commit({ config: { ...record.config, venueId: target.id } });
      toast.success(
        existing ? `Linked to "${target.name}" in your Venues book.` : `"${target.name}" added to your Venues book.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Venues book"
        description="Turn this lead into a reusable venue — name, address, location, capacity and contact are copied across."
      >
        {linked ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{venue?.name || record.name || "Venue"}</p>
                <p className="truncate text-xs text-text-secondary">
                  {["In your Venues book", venue?.city].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {projectId ? (
              <Button asChild variant="outline" className={outlineClass}>
                <Link href={venuePath(projectId, venueId)}>
                  <ArrowUpRight className="h-4 w-4" /> Open venue
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              {missing ? "The venue this lead was linked to has been deleted." : "Not in your Venues book yet."}
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy}
              onClick={convert}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Convert to venue
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Proposals"
        description="Send this venue a structured RFP from Smart Custom Proposals and compare its bid side by side with others."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn("text-sm", isEmail(email) ? "text-text-secondary" : "text-amber-700 dark:text-amber-400")}>
            {isEmail(email)
              ? `The RFP link goes to ${email}.`
              : "No contact email yet — add one under Contact & notes, or on the RFP before sending."}
          </p>
          <Button
            variant="outline"
            className={outlineClass}
            disabled={!projectId}
            onClick={() => router.push(proposalsPath(projectId, [record.id]))}
          >
            <FileText className="h-4 w-4" /> Request proposal
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// Header action: pick pipeline leads, then open a new RFP with them preselected as recipients.
function RequestProposalsAction({ api, projectId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState(null);
  const [picked, setPicked] = useState(() => new Set());

  const openDialog = () => {
    setLeads(null);
    setPicked(new Set());
    setOpen(true);
    api.list(projectId, BASE.key).then((rows) => setLeads((rows ?? []).filter((r) => r.status !== "Rejected")));
  };

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allPicked = Boolean(leads?.length) && picked.size === leads.length;

  const submit = () => {
    if (!picked.size || !projectId) return;
    setOpen(false);
    router.push(proposalsPath(projectId, [...picked]));
  };

  return (
    <>
      <Button variant="outline" className={outlineClass} onClick={openDialog}>
        <FileText className="h-4 w-4" /> Request proposals
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request proposals</DialogTitle>
            <DialogDescription>
              Pick the venues to invite. A new RFP opens in Smart Custom Proposals with them added as recipients.
            </DialogDescription>
          </DialogHeader>

          {leads === null ? (
            <LoadingArea size={40} label="Loading pipeline" className="py-10" />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No venues in your pipeline"
              description="Shortlist venues from Discover or add a venue lead first."
              className="py-10"
            />
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-text-secondary">
                  {picked.size} of {leads.length} selected
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setPicked(allPicked ? new Set() : new Set(leads.map((r) => r.id)))}
                >
                  {allPicked ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
                {leads.map((r) => {
                  const c = r.config || {};
                  const reachable = isEmail(c.contactEmail) || Boolean(c.venueId);
                  return (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-active"
                    >
                      <Checkbox
                        checked={picked.has(r.id)}
                        onCheckedChange={() => toggle(r.id)}
                        aria-label={`Invite ${r.name || "venue"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{r.name || "Untitled"}</span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            reachable ? "text-text-secondary" : "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {[
                            c.city,
                            c.venueId ? "In Venues" : "",
                            isEmail(c.contactEmail) ? c.contactEmail : c.venueId ? "" : "No email yet",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <StatusPill status={r.status} map={VENUE_LEAD_STATUS_MAP} />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!picked.size}
              onClick={submit}
            >
              <FileText className="h-4 w-4" />
              {picked.size ? `Create RFP for ${picked.size}` : "Create RFP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const venueCol = { key: "venue", header: "Venue", render: (r) => <InVenuesCell record={r} /> };

// The Venue lead module plus the pipeline actions; only Venue Sourcing renders it.
export const VENUE_PIPELINE_MODULE = {
  ...BASE,
  columns: [
    ...BASE.columns.filter((col) => col.key !== "status"),
    venueCol,
    ...BASE.columns.filter((col) => col.key === "status"),
  ],
  settingsAction: RequestProposalsAction,
  detail: {
    ...BASE.detail,
    titleBadges: InVenuesBadge,
    nav: [
      ...BASE.detail.nav,
      {
        key: "venue",
        label: "Venue & proposals",
        icon: Building2,
        desc: "Add this lead to your Venues book and request a proposal.",
        render: (props) => <LeadVenuePanel {...props} />,
      },
    ],
  },
};
