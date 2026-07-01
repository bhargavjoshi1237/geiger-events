"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SquarePen,
  MapPin,
  Gauge,
  Contact,
  ImageIcon,
  Map as MapIcon,
  UploadCloud,
  Trash2,
  Loader2,
  Star,
  Check,
} from "lucide-react";

import {
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/supabase/user";
import {
  uploadVenueImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import {
  AMENITIES,
  VENUE_STATUS_OPTIONS,
  VENUE_TYPE_OPTIONS,
  VENUE_TIMEZONES,
} from "./constants";

// Right-hand editor navigation. `key` must match a SECTIONS entry below.
export const VENUE_NAV = [
  { key: "details", label: "Details", icon: SquarePen, desc: "Name, type, status, and a short description." },
  { key: "location", label: "Location", icon: MapPin, desc: "Address, region, timezone, and how to get there." },
  { key: "capacity", label: "Capacity & amenities", icon: Gauge, desc: "How many it holds and what it offers." },
  { key: "contact", label: "Contact", icon: Contact, desc: "Who to reach and where to find them online." },
  { key: "media", label: "Media", icon: ImageIcon, desc: "The cover image and photo gallery for this venue." },
];

// --- Details -----------------------------------------------------------------

function DetailsSection({ venue, patch }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Venue details">
        <div className="grid gap-4">
          <Field label="Venue name">
            <Input
              value={venue.name || ""}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. The Glasshouse"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={venue.type || "Indoor"} onValueChange={(v) => patch({ type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={venue.status || "Active"} onValueChange={(v) => patch({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" hint="A short summary shown to event organizers.">
            <Textarea
              rows={4}
              value={venue.description || ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What's this space like? Style, standout features, typical use…"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Location ----------------------------------------------------------------

function LocationSection({ venue, patch }) {
  const mapQuery = [venue.address, venue.city, venue.postcode, venue.country]
    .filter(Boolean)
    .join(", ");
  const mapHref =
    venue.latitude != null && venue.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
      : mapQuery
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
        : null;

  return (
    <div className="space-y-6">
      <SectionCard title="Address">
        <div className="grid gap-4">
          <Field label="Street address">
            <Input
              value={venue.address || ""}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="61 Southwark Street"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <Input
                value={venue.city || ""}
                onChange={(e) => patch({ city: e.target.value })}
                placeholder="London"
              />
            </Field>
            <Field label="Region / state">
              <Input
                value={venue.region || ""}
                onChange={(e) => patch({ region: e.target.value })}
                placeholder="Greater London"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Postcode">
              <Input
                value={venue.postcode || ""}
                onChange={(e) => patch({ postcode: e.target.value })}
                placeholder="SE1 0HL"
              />
            </Field>
            <Field label="Country">
              <Input
                value={venue.country || ""}
                onChange={(e) => patch({ country: e.target.value })}
                placeholder="United Kingdom"
              />
            </Field>
            <Field label="Timezone">
              <Select
                value={venue.timezone || "Europe/London"}
                onValueChange={(v) => patch({ timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TIMEZONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Map & directions"
        description="Optional coordinates pin the venue precisely; notes help attendees arrive."
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude">
              <Input
                type="number"
                step="any"
                value={venue.latitude ?? ""}
                onChange={(e) => patch({ latitude: e.target.value })}
                placeholder="51.5045"
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                value={venue.longitude ?? ""}
                onChange={(e) => patch({ longitude: e.target.value })}
                placeholder="-0.0865"
              />
            </Field>
          </div>
          {mapHref ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-fit border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <a href={mapHref} target="_blank" rel="noopener noreferrer">
                <MapIcon className="h-4 w-4" /> View on Google Maps
              </a>
            </Button>
          ) : null}
          <Field label="Parking notes" hint="Permits, validation, accessibility.">
            <Textarea
              rows={2}
              value={venue.parkingNotes || ""}
              onChange={(e) => patch({ parkingNotes: e.target.value })}
              placeholder="e.g. Blue-badge bays on Level 1; NCP 3 min walk…"
            />
          </Field>
          <Field label="Transit notes" hint="Nearest stations, bus routes, step-free access.">
            <Textarea
              rows={2}
              value={venue.transitNotes || ""}
              onChange={(e) => patch({ transitNotes: e.target.value })}
              placeholder="e.g. 5 min from London Bridge (Jubilee, Northern)…"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Capacity & amenities ----------------------------------------------------

function CapacitySection({ venue, patch }) {
  const selected = Array.isArray(venue.amenities) ? venue.amenities : [];
  const toggle = (key) =>
    patch({
      amenities: selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    });

  return (
    <div className="space-y-6">
      <SectionCard title="Capacity">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Seated capacity">
            <Input
              type="number"
              min={0}
              value={venue.seatedCapacity ?? ""}
              onChange={(e) => patch({ seatedCapacity: e.target.value })}
              placeholder="e.g. 200"
            />
          </Field>
          <Field label="Standing capacity">
            <Input
              type="number"
              min={0}
              value={venue.standingCapacity ?? ""}
              onChange={(e) => patch({ standingCapacity: e.target.value })}
              placeholder="e.g. 400"
            />
          </Field>
          <Field label="Spaces / rooms">
            <Input
              type="number"
              min={0}
              value={venue.spaces ?? ""}
              onChange={(e) => patch({ spaces: e.target.value })}
              placeholder="e.g. 3"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Amenities"
        description="What this venue offers. Shown to attendees on the event page."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITIES.map((a) => {
            const Icon = a.icon;
            const on = selected.includes(a.key);
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => toggle(a.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  on
                    ? "border-border-strong bg-surface-card text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:bg-surface-card",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                {on ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : null}
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// --- Contact -----------------------------------------------------------------

function ContactSection({ venue, patch }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Contact">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name">
              <Input
                value={venue.contactName || ""}
                onChange={(e) => patch({ contactName: e.target.value })}
                placeholder="e.g. Sam Rivera"
              />
            </Field>
            <Field label="Website">
              <Input
                value={venue.website || ""}
                onChange={(e) => patch({ website: e.target.value })}
                placeholder="https://venue.example.com"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input
                type="email"
                value={venue.contactEmail || ""}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                placeholder="bookings@venue.example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={venue.contactPhone || ""}
                onChange={(e) => patch({ contactPhone: e.target.value })}
                placeholder="+44 20 7946 0000"
              />
            </Field>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Media -------------------------------------------------------------------

function MediaSection({ venue, commit }) {
  const cover = venue.coverUrl || "";
  const gallery = Array.isArray(venue.gallery) ? venue.gallery : [];

  const [me, setMe] = useState(null);
  const [meResolved, setMeResolved] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const coverInput = useRef(null);
  const galleryInput = useRef(null);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => {
      if (!alive) return;
      setMe(u?.id || null);
      setMeResolved(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Only the creator may upload (storage RLS). A venue with no owner yet
  // (local-only / just created) is treated as editable.
  const isOwner = !meResolved || !venue.createdBy || me === venue.createdBy;

  const onCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setCoverBusy(true);
    const res = await uploadVenueImage(venue.id, file);
    setCoverBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the venue's creator can add images.");
      return;
    }
    const old = cover;
    commit({ coverUrl: res.url });
    toast.success("Cover image updated.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removeCover = () => {
    const path = pathFromPublicUrl(cover);
    commit({ coverUrl: "" });
    toast.success("Cover image removed.");
    if (path) removeEventImage(path);
  };

  const onGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setGalleryBusy(true);
    const urls = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const res = await uploadVenueImage(venue.id, file);
      if (res?.url) urls.push(res.url);
    }
    setGalleryBusy(false);
    if (!urls.length) {
      toast.error("Upload failed — only the venue's creator can add images.");
      return;
    }
    commit({ gallery: [...gallery, ...urls] });
    toast.success(`Added ${urls.length} photo${urls.length === 1 ? "" : "s"}.`);
  };

  const removeGalleryImage = (url) => {
    const path = pathFromPublicUrl(url);
    commit({ gallery: gallery.filter((g) => g !== url) });
    if (path) removeEventImage(path);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Cover image" description="The hero image shown for this venue.">
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onCoverFile}
        />
        {cover ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="Venue cover" className="aspect-[16/9] w-full object-cover" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={coverBusy || !isOwner}
                onClick={() => coverInput.current?.click()}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                {coverBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={removeCover}
                className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={coverBusy || !isOwner}
            onClick={() => coverInput.current?.click()}
            className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {coverBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
            Upload a cover image
          </button>
        )}
      </SectionCard>

      <SectionCard title="Gallery" description="Extra photos of the space.">
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onGalleryFiles}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((url) => (
            <div key={url} className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                onClick={() => removeGalleryImage(url)}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-red-300 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={galleryBusy || !isOwner}
            onClick={() => galleryInput.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-card text-xs text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {galleryBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            Add photos
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// section key → component. Unmapped keys fall back to Details.
export const SECTIONS = {
  details: DetailsSection,
  location: LocationSection,
  capacity: CapacitySection,
  contact: ContactSection,
  media: MediaSection,
};
