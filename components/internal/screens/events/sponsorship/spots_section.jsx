"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  EyeOff,
  Handshake,
  Package,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Progress } from "@geiger/ui/progress";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { LoadingArea } from "@geiger/ui";
import { conferenceApi } from "@/lib/supabase/conference";
import {
  formatSpotPrice,
  newFill,
  newSpot,
  placeFill,
  removeFill,
  sponsorSnapshot,
  sponsorshipTotals,
  spotCounts,
  spotFromPackage,
} from "@/lib/events/sponsorship";
import { currency } from "@/components/internal/shared/records/builders";
import { FILL_STATUS_MAP } from "./constants";
import { useSponsorship } from "./use_sponsorship";
import { SponsorshipLoadError } from "./load_error";
import { SpotDialog } from "./spot_dialog";
import { FillDialog } from "./fill_dialog";

const OUTLINE_BTN =
  "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function SponsorMark({ sponsor }) {
  return (
    <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-subtle">
      {sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logoUrl} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <Building2 className="h-4 w-4 text-text-tertiary" />
      )}
    </div>
  );
}

function SpotCard({ spot, onEdit, onDelete, onFill, onEditFill, onRemoveFill }) {
  const { filled, left } = spotCounts(spot);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{spot.name || "Untitled spot"}</p>
            {spot.tier && spot.tier.toLowerCase() !== spot.name.trim().toLowerCase() ? (
              <Badge variant="neutral">{spot.tier}</Badge>
            ) : null}
            {!spot.open ? (
              <Badge variant="outline">
                <EyeOff className="h-3 w-3" /> Private
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-text-secondary">
            {formatSpotPrice(spot)} · {filled} of {spot.quantity} filled
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={!left} onClick={onFill} className={OUTLINE_BTN}>
            <UserPlus className="h-4 w-4" /> {left ? "Fill spot" : "Full"}
          </Button>
          <ActionMenu
            label={`Actions for ${spot.name || "spot"}`}
            items={[
              { icon: Pencil, label: "Edit spot", onSelect: onEdit },
              { separator: true },
              { icon: Trash2, label: "Delete spot", variant: "destructive", onSelect: onDelete },
            ]}
          />
        </div>
      </div>
      <Progress value={(filled / spot.quantity) * 100} className="h-1 rounded-none" />

      {spot.fills.length ? (
        <div className="divide-y divide-border">
          {spot.fills.map((fill) => (
            <div key={fill.id} className="flex items-center gap-3 px-4 py-3">
              <SponsorMark sponsor={fill.sponsor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{fill.sponsor.name || "Unnamed sponsor"}</p>
                <p className="truncate text-xs text-text-tertiary">
                  {[fill.amount ? currency(fill.amount) : null, fill.note || null].filter(Boolean).join(" · ") ||
                    "No amount recorded"}
                </p>
              </div>
              <StatusPill status={fill.status} map={FILL_STATUS_MAP} />
              <ActionMenu
                label={`Actions for ${fill.sponsor.name || "sponsor"}`}
                items={[
                  { icon: Pencil, label: "Edit", onSelect: () => onEditFill(fill) },
                  { separator: true },
                  { icon: Trash2, label: "Remove from spot", variant: "destructive", onSelect: () => onRemoveFill(fill) },
                ]}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Sponsors attached before spots existed; offered as a one-click spot rather than converted silently.
function LegacyBanner({ count, onAdopt }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-card px-4 py-3">
      <Handshake className="h-4 w-4 shrink-0 text-text-tertiary" />
      <p className="min-w-0 flex-1 text-sm text-text-secondary">
        {count} sponsor{count === 1 ? " was" : "s were"} attached to this event before spots existed.
      </p>
      <Button size="sm" variant="outline" onClick={onAdopt} className={OUTLINE_BTN}>
        Add as a &quot;Sponsors&quot; spot
      </Button>
    </div>
  );
}

export function EventSponsorSpotsSection({ event, headerItem, onPatch }) {
  const { spots, saveSpots, records, addRecord, projectId, loadError, reload } = useSponsorship(event, onPatch);
  const [packages, setPackages] = useState([]);
  const [spotEditor, setSpotEditor] = useState(null);
  const [filling, setFilling] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let alive = true;
    conferenceApi.list(projectId, "package").then((rows) => {
      if (alive) setPackages(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const totals = sponsorshipTotals(spots);
  const attachedIds = Array.isArray(event?.sponsorIds) ? event.sponsorIds : [];
  const legacyIds = spots.length ? [] : attachedIds.filter((id) => (records || []).some((r) => r.id === id));

  const saveSpot = (spot) => {
    const exists = spots.some((s) => s.id === spot.id);
    saveSpots(exists ? spots.map((s) => (s.id === spot.id ? spot : s)) : [...spots, spot], exists ? "Spot saved." : "Spot added.");
  };

  const addFromPackage = (record) => saveSpots([...spots, spotFromPackage(record)], `Added ${record.name}.`);

  const adoptLegacy = () => {
    const fills = legacyIds.map((id) => {
      const record = records.find((r) => r.id === id);
      return newFill({ sponsorId: id, amount: Number(record.config?.amount) || 0, sponsor: sponsorSnapshot(record) });
    });
    saveSpots([newSpot({ name: "Sponsors", quantity: fills.length, open: false, fills })], "Sponsors moved into a spot.");
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= spots.length) return;
    const next = [...spots];
    [next[i], next[j]] = [next[j], next[i]];
    saveSpots(next);
  };

  const packageMenu = packages.length ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={OUTLINE_BTN}>
          <Package className="h-4 w-4" /> From package <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Copy a Sponsorship Package</DropdownMenuLabel>
        {packages.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => addFromPackage(p)}>
            <span className="truncate">{p.name}</span>
            {p.config?.tier ? <span className="ml-auto text-xs text-text-tertiary">{p.config.tier}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const addButton = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSpotEditor({})}>
      <Plus className="h-4 w-4" /> Add spot
    </Button>
  );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Sponsor Spots"}
        description={
          headerItem?.desc ||
          "The sponsorship spots this event offers, and who has taken them."
        }
        action={
          <>
            {packageMenu}
            {addButton}
          </>
        }
      />

      {loadError ? <SponsorshipLoadError onRetry={reload} /> : records === null ? (
        <LoadingArea panel label="Loading sponsorship" />
      ) : (
        <>
          {legacyIds.length ? <LegacyBanner count={legacyIds.length} onAdopt={adoptLegacy} /> : null}

          {spots.length ? (
            <>
              <StatsBar
                columns={3}
                stats={[
                  { label: "Spots filled", value: `${totals.filled} / ${totals.slots}` },
                  { label: "Still open", value: String(totals.left) },
                  { label: "Committed", value: currency(totals.committed) },
                ]}
              />
              <div className="space-y-3">
                {spots.map((spot, i) => (
                  <div key={spot.id} className="flex items-start gap-2">
                    <div className="mt-4 flex flex-col text-text-tertiary">
                      <button
                        type="button"
                        aria-label="Move spot up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="rounded p-0.5 transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move spot down"
                        disabled={i === spots.length - 1}
                        onClick={() => move(i, 1)}
                        className="rounded p-0.5 transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <SpotCard
                        spot={spot}
                        onEdit={() => setSpotEditor({ spot })}
                        onDelete={() => setDeleting(spot)}
                        onFill={() => setFilling({ spotId: spot.id })}
                        onEditFill={(fill) => setFilling({ spotId: spot.id, fill })}
                        onRemoveFill={(fill) => saveSpots(removeFill(spots, fill.id), "Removed from spot.")}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-tertiary">
                Order is prominence — the top spot leads the sponsor strip on your event page.
              </p>
            </>
          ) : (
            <EmptyState
              icon={Handshake}
              title="No sponsorship spots yet"
              description="Add the spots you're selling — a title sponsor, a lanyard sponsor, a few Gold slots — then fill them as deals close."
              action={addButton}
            />
          )}
        </>
      )}

      <SpotDialog
        open={!!spotEditor}
        onOpenChange={(o) => !o && setSpotEditor(null)}
        initial={spotEditor?.spot}
        minQuantity={spotEditor?.spot?.fills.length || 1}
        onSave={saveSpot}
      />

      <FillDialog
        open={!!filling}
        onOpenChange={(o) => !o && setFilling(null)}
        spots={spots}
        spotId={filling?.spotId}
        initial={filling?.fill}
        records={records}
        projectId={projectId}
        onRecordCreated={addRecord}
        onSave={({ spotId, fill }) =>
          saveSpots(placeFill(spots, spotId, fill), filling?.fill ? "Sponsor updated." : "Spot filled.")
        }
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete spot</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleting?.name || "this spot"}</span>
              {deleting?.fills.length
                ? ` and its ${deleting.fills.length} sponsor${deleting.fills.length === 1 ? "" : "s"}? They stay in your Sponsors list.`
                : "?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                saveSpots(spots.filter((s) => s.id !== deleting.id), "Spot deleted.");
                setDeleting(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EventSponsorSpotsSection;
