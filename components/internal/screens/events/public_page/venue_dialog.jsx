"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  SquareParking,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getVenue } from "@/lib/supabase/venues";
import {
  AMENITY_LABEL,
  venueCapacity,
  venueLocation,
  VENUE_TYPE_MAP,
} from "@/components/internal/screens/venues/constants";

import { AMENITY_ICON } from "./constants";

function CapacityTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <Users className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

export function VenueDetailsDialog({ open, onClose, venueId, fallback, accent }) {
  const [venue, setVenue] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    getVenue(venueId).then((v) => {
      if (!alive) return;
      setVenue(v);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [open, venueId]);

  const v = venue || fallback;
  const cap = venueCapacity(v);
  const fullAddress = [v?.address, v?.city, v?.postcode, v?.country]
    .filter(Boolean)
    .join(", ");
  const mapHref =
    v?.latitude != null && v?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`
      : fullAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        : null;
  const amenities = Array.isArray(v?.amenities) ? v.amenities : [];
  const seated = Number(v?.seatedCapacity) || 0;
  const standing = Number(v?.standingCapacity) || 0;
  const location = venueLocation(v);
  const contacts = [
    v?.contactPhone ? { icon: Phone, label: v.contactPhone, href: `tel:${v.contactPhone}` } : null,
    v?.contactEmail ? { icon: Mail, label: v.contactEmail, href: `mailto:${v.contactEmail}` } : null,
    v?.website ? { icon: Globe, label: v.website.replace(/^https?:\/\//, ""), href: v.website } : null,
  ].filter(Boolean);
  const notes = [
    v?.transitNotes ? { icon: Navigation, label: "Getting there", text: v.transitNotes } : null,
    v?.parkingNotes ? { icon: SquareParking, label: "Parking", text: v.parkingNotes } : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{v?.name || "Venue"}</DialogTitle>
            {v?.type ? (
              <Badge variant={VENUE_TYPE_MAP[v.type]?.variant || "neutral"}>
                {v.type}
              </Badge>
            ) : null}
          </div>
          <DialogDescription>{location || "Venue details"}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!loaded && !venue ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading venue…
            </div>
          ) : (
            <>
              {v?.coverUrl ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.coverUrl}
                    alt={`${v.name} cover`}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
              ) : null}

              {v?.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {v.description}
                </p>
              ) : null}

              {fullAddress ? (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Address
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {fullAddress}
                    </p>
                  </div>
                </div>
              ) : null}

              {cap ? (
                <div className="grid grid-cols-2 gap-3">
                  {seated && standing ? (
                    <>
                      <CapacityTile label="Seated" value={seated} />
                      <CapacityTile label="Standing" value={standing} />
                    </>
                  ) : (
                    <div className="col-span-2">
                      <CapacityTile label="Capacity" value={cap} />
                    </div>
                  )}
                </div>
              ) : null}

              {amenities.length ? (
                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Amenities
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {amenities.map((a) => {
                      const Icon = AMENITY_ICON[a] || Check;
                      return (
                        <div
                          key={a}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-muted-foreground"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                          <span className="min-w-0 truncate">
                            {AMENITY_LABEL[a] || a}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {notes.length ? (
                <div className="space-y-3">
                  {notes.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div key={n.label} className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                            {n.label}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {n.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {contacts.length ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
                  {contacts.map((c) => {
                    const Icon = c.icon;
                    return (
                      <a
                        key={c.label}
                        href={c.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                        <span className="min-w-0 truncate">{c.label}</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>

        {mapHref ? (
          <div className="shrink-0 pt-2">
            <Button
              asChild
              className="w-full hover:opacity-90"
              style={{ backgroundColor: accent.color, color: accent.text }}
            >
              <a href={mapHref} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" /> Get directions
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
