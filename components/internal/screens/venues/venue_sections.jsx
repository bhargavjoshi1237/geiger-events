"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SquarePen,
  MapPin,
  Gauge,
  Contact,
  ImageIcon,
  LocateFixed,
  UploadCloud,
  Trash2,
  Loader2,
  Star,
  Check,
  Accessibility,
} from "lucide-react";

import {
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { GuidelineListEditor } from "@/components/internal/shared/guideline_editor";
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
import { mergeVenueMeta } from "@/lib/supabase/venues";
import {
  LocationPicker,
  LocationModeTabs,
} from "@/components/internal/screens/events/location_picker";
import {
  EventMap,
  NearbyList,
  nearbyGroups,
  hasNearby,
  flattenPlaces,
  GETTING_THERE_GROUPS,
  AROUND_VENUE_GROUPS,
} from "@/components/internal/screens/events/event_map";
import { resolveEventLocation } from "@/lib/map/geo";
import {
  AMENITIES,
  VENUE_STATUS_OPTIONS,
  VENUE_TYPE_OPTIONS,
  VENUE_TIMEZONES,
  venueFullAddress,
} from "./constants";

// Right-hand editor navigation. `key` must match a SECTIONS entry below.
export const VENUE_NAV = [
  { key: "details", label: "Details", icon: SquarePen, desc: "Name, type, status, and a short description." },
  { key: "location", label: "Location", icon: MapPin, desc: "Address, region, timezone, and how to get there." },
  { key: "capacity", label: "Capacity & amenities", icon: Gauge, desc: "How many it holds and what it offers." },
  { key: "contact", label: "Contact", icon: Contact, desc: "Who to reach and where to find them online." },
  { key: "guidelines", label: "Dietary & Accessibility", icon: Accessibility, desc: "Guidelines shown on every event held here." },
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

// The nearby-place buckets stored in the venue's `nearby` metadata. Same keys
// the event's `map` config uses, so the shared map helpers work on it directly.
const EMPTY_NEARBY = {
  nearbyParking: [],
  nearbyTransit: [],
  nearbyBike: [],
  nearbyTaxi: [],
  nearbyCharging: [],
  nearbyHotels: [],
  nearbyFood: [],
};

function LocationSection({ venue, patch, commit }) {
  const [locMode, setLocMode] = useState("search");
  const [detecting, setDetecting] = useState(false);
  const isVirtual = venue.type === "Virtual";

  // Coords live on the venue's latitude/longitude columns; the shared picker &
  // map speak `{ lat, lng }`, so we adapt at the boundary.
  const coords =
    venue.latitude != null &&
    venue.longitude != null &&
    venue.latitude !== "" &&
    venue.longitude !== ""
      ? { lat: Number(venue.latitude), lng: Number(venue.longitude) }
      : null;

  // Address is a column (live via patch); coords go to the lat/lng columns.
  const handleLocation = ({ address, coords: c }) => {
    if (address !== undefined) patch({ address });
    if (c !== undefined) patch({ latitude: c.lat, longitude: c.lng });
  };

  // Nearby buckets read straight off the view model (metadata is spread onto it).
  const nearby = venue.nearby || EMPTY_NEARBY;
  const places = useMemo(() => flattenPlaces(nearby), [nearby]);
  const gettingThere = nearbyGroups(nearby, GETTING_THERE_GROUPS);
  const aroundVenue = nearbyGroups(nearby, AROUND_VENUE_GROUPS);
  const anyNearby = hasNearby(nearby, GETTING_THERE_GROUPS, AROUND_VENUE_GROUPS);

  const detect = async () => {
    const query = venueFullAddress(venue) || venue.address;
    if (!query) {
      toast.error("Add an address first.");
      return;
    }
    setDetecting(true);
    const res = await resolveEventLocation(query);
    setDetecting(false);
    if (!res?.coords) {
      toast.error("Couldn't locate that address on the map.");
      return;
    }
    const nextNearby = {
      nearbyParking: res.parking,
      nearbyTransit: res.transit,
      nearbyBike: res.bike,
      nearbyTaxi: res.taxi,
      nearbyCharging: res.charging,
      nearbyHotels: res.hotels,
      nearbyFood: res.food,
    };
    // Coords stick immediately via the columns; the buckets persist through the
    // shallow-merge RPC so they never clobber another metadata section.
    commit({
      latitude: res.coords.lat,
      longitude: res.coords.lng,
      nearby: nextNearby,
    });
    mergeVenueMeta(venue.id, { nearby: nextNearby });
    const found =
      res.transit.length +
      res.parking.length +
      res.bike.length +
      res.taxi.length +
      res.charging.length +
      res.hotels.length +
      res.food.length;
    toast.success(`Found ${found} nearby ${found === 1 ? "place" : "places"}.`);
  };

  return (
    <div className="space-y-6">
      {/* Picker header — mode tabs pinned to the far right. */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Search an address, drop a pin on the map, or enter coordinates.
        </p>
        {!isVirtual ? (
          <LocationModeTabs
            mode={locMode}
            onModeChange={setLocMode}
            className="shrink-0"
          />
        ) : null}
      </div>

      {isVirtual ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-8 text-center text-sm text-text-secondary">
          This is a virtual venue — there&apos;s no physical location to pin.
          Timezone and contact details still apply.
        </div>
      ) : (
        <LocationPicker
          mode={locMode}
          address={venue.address || ""}
          coords={coords}
          onChange={handleLocation}
        />
      )}

      <SectionCard title="Address">
        <div className="grid gap-4">
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

      {!isVirtual ? (
        <SectionCard
          title="Map & directions"
          description="A pinned map and auto-detected nearby transport, parking and food — reused on every event held here."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={detecting}
              onClick={detect}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              {detecting ? "Detecting…" : "Nearby amenities"}
            </Button>
          }
        >
          <EventMap
            coords={coords}
            places={places}
            label={venue.name || "Venue"}
            address={venueFullAddress(venue)}
            className="mb-5 aspect-[21/9] w-full"
          />
          {anyNearby ? (
            <div className="mb-5 space-y-5">
              <NearbyList groups={gettingThere} />
              <NearbyList groups={aroundVenue} />
            </div>
          ) : (
            <div className="mb-5 rounded-lg border border-dashed border-border bg-surface-card px-4 py-6 text-center text-sm text-text-secondary">
              Run <span className="text-foreground">Nearby amenities</span> to
              list nearby transport, parking, cycling, hotels and food.
            </div>
          )}
          <div className="grid gap-4">
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
      ) : null}
    </div>
  );
}

// --- Capacity & amenities ----------------------------------------------------

function CapacitySection({ venue, patch, commit }) {
  const selected = Array.isArray(venue.amenities) ? venue.amenities : [];
  // Toggle updates the UI instantly (patch) but buffers the DB write 2s so
  // spam-clicking coalesces into a single persist. One shared timer + a ref to
  // the latest commit so an unmount flush never uses a stale closure.
  const saveTimer = useRef(null);
  const pending = useRef(null);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  const toggle = (key) => {
    const amenities = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    patch({ amenities });
    pending.current = amenities;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      commitRef.current({ amenities });
      pending.current = null;
    }, 2000);
  };
  // Flush any pending write on unmount so a quick toggle-then-leave still saves.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (pending.current !== null) commitRef.current({ amenities: pending.current });
    },
    [],
  );

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
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:bg-surface-card",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    on ? "text-background" : "text-text-secondary",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                {on ? <Check className="h-4 w-4 shrink-0 text-background" /> : null}
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

// --- Dietary & Accessibility guidelines --------------------------------------

function GuidelinesSection({ venue, patch }) {
  const [items, setItems] = useState(
    Array.isArray(venue.guidelines) ? venue.guidelines : [],
  );
  const [saving, setSaving] = useState(false);

  // Guidelines live in the metadata bag (no column), so persist through the
  // shallow-merge RPC — commit()/updateVenue would drop the unmapped key.
  const save = async () => {
    setSaving(true);
    patch({ guidelines: items });
    const res = await mergeVenueMeta(venue.id, { guidelines: items });
    setSaving(false);
    if (res === false) toast.error("Couldn't save the guidelines.");
    else toast.success("Guidelines saved.");
  };

  return (
    <SectionCard
      title="Dietary & Accessibility guidelines"
      description="Informational notes shown on the public page of every event at this venue — e.g. step-free access, allergen policy. Events can add their own on top."
      action={
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save guidelines"}
        </Button>
      }
    >
      <GuidelineListEditor items={items} onChange={setItems} />
    </SectionCard>
  );
}

// section key → component. Unmapped keys fall back to Details.
export const SECTIONS = {
  details: DetailsSection,
  location: LocationSection,
  capacity: CapacitySection,
  contact: ContactSection,
  guidelines: GuidelinesSection,
  media: MediaSection,
};
