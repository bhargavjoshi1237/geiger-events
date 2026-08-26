"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { useEventConfig } from "@/lib/events/use-event-config";
import { currency } from "@/components/internal/screens/tickets/constants";
import { buildPriceBands } from "@/lib/seating/price_tiers";
import { listHallMaps } from "@/lib/supabase/hall_maps";
import {
  blockBooths,
  getEventExpo,
  listBoothAssignments,
  unblockBooths,
} from "@/lib/supabase/expo";

import { HallMapView } from "./hall_map_view";

const DEFAULT_EXPO = {
  hallMapId: "",
  pricing: "tier",
  boothTiers: {},
  exhibitorTicketId: "",
  holdMinutes: 15,
};

const NONE = "__none__";

export function EventExpoSection({ event, headerItem }) {
  const [expo, setExpo, saveExpo] = useEventConfig(event, "expo", DEFAULT_EXPO);

  const [maps, setMaps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [liveRaw, setLive] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reload = () => {
    setRefreshing(true);
    setReloadToken((t) => t + 1);
  };

  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];
  const pricing = expo.pricing === "direct" ? "direct" : "tier";

  useEffect(() => {
    if (!event?.venueId) return undefined;
    let alive = true;
    listHallMaps(event.venueId).then((rows) => {
      if (!alive) return;
      setMaps(rows ?? []);
      setLoadingMaps(false);
    });
    return () => {
      alive = false;
    };
  }, [event?.venueId]);

  useEffect(() => {
    if (!event?.id || !expo.hallMapId) return undefined;
    const mapId = expo.hallMapId;
    let alive = true;
    Promise.all([
      getEventExpo(event.id),
      listBoothAssignments(event.id),
    ]).then(([data, rows]) => {
      if (!alive) return;
      setLive(data ? { ...data, forMapId: mapId } : null);
      setAssignments(rows ?? []);
      setRefreshing(false);
    });
    return () => {
      alive = false;
    };
  }, [event?.id, expo.hallMapId, reloadToken]);

  const live = liveRaw?.forMapId === expo.hallMapId ? liveRaw : null;

  const blockedIds = useMemo(
    () => new Set(assignments.filter((a) => a.status === "blocked").map((a) => a.boothId)),
    [assignments],
  );
  const soldIds = useMemo(
    () => new Set(assignments.filter((a) => a.status !== "blocked").map((a) => a.boothId)),
    [assignments],
  );

  const patch = (partial) => {
    const next = { ...expo, ...partial };
    setExpo(next);
    saveExpo(next);
  };

  const setBoothTier = (boothId, ticketId) => {
    const nextTiers = { ...(expo.boothTiers || {}) };
    if (ticketId === NONE) delete nextTiers[boothId];
    else nextTiers[boothId] = ticketId;
    patch({ boothTiers: nextTiers });
    const ticket = ticketById.get(ticketId);
    toast.success(
      ticket
        ? `Mapped to ${ticket.name || "ticket"}.`
        : "Booth removed from sale.",
    );
  };

  const sellableBooths = useMemo(
    () => (live?.booths ?? []).filter((b) => b.kind === "booth"),
    [live],
  );

  const ticketById = useMemo(() => {
    const map = new Map();
    for (const ticket of Array.isArray(event?.tickets) ? event.tickets : []) {
      map.set(ticket.id, ticket);
    }
    return map;
  }, [event]);

  const priceForBooth = (booth) => {
    if (!booth) return null;
    if (pricing === "direct") return Number(booth.price) || 0;
    const ticket = ticketById.get(expo.boothTiers?.[booth.id]);
    return ticket ? Number(ticket.price) || 0 : null;
  };

  const bands = useMemo(
    () => buildPriceBands(sellableBooths, priceForBooth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sellableBooths, pricing, expo.boothTiers, ticketById],
  );

  const toggleBlock = async (booth) => {
    if (soldIds.has(booth.id)) return;
    const isBlocked = blockedIds.has(booth.id);
    const ok = isBlocked
      ? await unblockBooths(event.id, [booth.id])
      : await blockBooths(event.id, [booth.id], "Organiser hold");
    if (!ok) {
      toast.error(isBlocked ? "Couldn't release the booth." : "Couldn't reserve the booth.");
      return;
    }
    toast.success(isBlocked ? "Booth released." : "Booth held off sale.");
    reload();
  };

  const boothState = (booth) => {
    if (soldIds.has(booth.id)) return "sold";
    if (blockedIds.has(booth.id)) return "blocked";
    return "available";
  };

  const boothMeta = (booth) => {
    const price = priceForBooth(booth);
    return { price: price === null ? null : currency(price) };
  };

  if (!event?.venueId) {
    return (
      <>
        {headerItem ? (
          <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
        ) : null}
        <EmptyState
          icon={Store}
          title="Pick a venue first"
          description="Exhibitor halls belong to a venue. Set this event's venue on the Location tab, then build or choose a hall here."
        />
      </>
    );
  }

  if (loadingMaps) {
    return (
      <div className="flex h-40 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <>
        {headerItem ? (
          <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
        ) : null}
        <EmptyState
          icon={Store}
          title="This venue has no exhibitor halls"
          description="Open the venue and lay out a hall — booths, zones and aisles — then come back to attach it to this event."
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {headerItem ? (
        <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
      ) : null}

      <SectionCard
        title="Configuration"
        description="Which floor this event sells, and how its booths are priced."
      >
        <div className="grid gap-4">
          <Field label="Exhibitor hall" hint="Built on the venue, reusable across events.">
            <Select
              value={expo.hallMapId || NONE}
              onValueChange={(v) => patch({ hallMapId: v === NONE ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not selling booths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not selling booths</SelectItem>
                {maps.map((map) => (
                  <SelectItem key={map.id} value={map.id}>
                    {map.name || "Untitled hall"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {expo.hallMapId ? (
            <>
              <Field
                label="Pricing"
                hint="Map booths to a ticket, or price each stall on the hall itself."
              >
                <Select value={pricing} onValueChange={(v) => patch({ pricing: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier">Map each booth to a ticket</SelectItem>
                    <SelectItem value="direct">Use each booth&apos;s own price</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {pricing === "direct" ? (
                <Field
                  label="Order line"
                  hint="The ticket the exhibitor's order is recorded against. The price comes from the booth."
                >
                  <Select
                    value={expo.exhibitorTicketId || NONE}
                    onValueChange={(v) => patch({ exhibitorTicketId: v === NONE ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a ticket" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {tickets.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          {ticket.name || "Untitled ticket"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <Field
                label="Hold booths for"
                hint="Minutes a stall stays reserved while an exhibitor pays."
              >
                <Input
                  type="number"
                  min={1}
                  max={120}
                  inputMode="numeric"
                  value={expo.holdMinutes ?? 15}
                  onChange={(e) => setExpo({ ...expo, holdMinutes: Number(e.target.value) || 15 })}
                  onBlur={() => saveExpo(expo)}
                  className="tabular-nums"
                />
              </Field>
            </>
          ) : null}
        </div>
      </SectionCard>

      {expo.hallMapId && pricing === "tier" && sellableBooths.length > 0 ? (
        <SectionCard
          title="Booth pricing"
          description="Map each booth to one of this event's tickets. Unmapped booths aren't sellable."
        >
          {tickets.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Add tickets on the Tickets tab first, then map them to booths here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {sellableBooths.map((booth) => (
                <li key={booth.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {booth.code || booth.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {[booth.hall, booth.sizeClass].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="w-56 shrink-0">
                    <Select
                      value={expo.boothTiers?.[booth.id] || NONE}
                      onValueChange={(v) => setBoothTier(booth.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not sellable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not sellable</SelectItem>
                        {tickets.map((ticket) => (
                          <SelectItem key={ticket.id} value={ticket.id}>
                            {ticket.name || "Untitled ticket"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {expo.hallMapId ? (
        <SectionCard
          title="Box office"
          description="Live floor state. Click an open booth to hold it off sale, or a held booth to release it."
          action={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={reload}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          }
        >
          {live ? (
            <div className="space-y-4">
              <HallMapView
                booths={live.booths}
                field={live.field}
                background={live.background}
                aspect={live.aspect}
                boothState={boothState}
                onBoothClick={toggleBlock}
                boothMeta={boothMeta}
                colorByBoothId={bands.colorById}
                legend={bands.legend}
                formatPrice={currency}
              />
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-text-secondary">
                <span>{soldIds.size} sold</span>
                <span>{blockedIds.size} held off sale</span>
                <span>{sellableBooths.length} booths total</span>
              </p>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}

export default EventExpoSection;
