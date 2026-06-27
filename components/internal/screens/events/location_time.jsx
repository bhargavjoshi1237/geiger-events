"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Map as MapIcon,
  Globe,
  Navigation,
  Train,
  Clock,
  Loader2,
  LucideCircleParking,
} from "lucide-react";

import {
  DataTable,
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENTS } from "./sample_data";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  EventMap,
  NearbyList,
  WeatherCard,
  nearbyGroups,
  hasNearby,
  flattenPlaces,
  GETTING_THERE_GROUPS,
  AROUND_VENUE_GROUPS,
} from "./event_map";
import { LocationPicker, LocationModeTabs } from "./location_picker";
import { resolveEventLocation, geocodeAddress } from "@/lib/map/geo";

function eventAddress(event) {
  return (
    event?.address || [event?.venue, event?.city].filter(Boolean).join(", ")
  );
}

// The nearby-place buckets stored on the shared `map` config. Kept in one place
// so the picker (which clears them on a pin move) and the detector stay in sync.
const EMPTY_NEARBY = {
  nearbyParking: [],
  nearbyTransit: [],
  nearbyBike: [],
  nearbyTaxi: [],
  nearbyCharging: [],
  nearbyHotels: [],
  nearbyFood: [],
};

const TIMEZONES = [
  { value: "Europe/London", label: "London (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-7)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+2)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
];

// --- Location & Time ---------------------------------------------------------

export function LocationTimeSection({ event, headerItem, onPatch, onCommit }) {
  const patch = onPatch || (() => {});
  const commit = onCommit || (() => {});
  const startLocal = `${event?.date || "2026-01-01"}T${event?.time || "18:00"}`;
  const isRemote = event?.city === "Remote";
  const [locMode, setLocMode] = useState("search");

  // Venue/address/timezone are columns (live via patch); the finer schedule
  // fields live in the metadata bag.
  const [loc, setLoc, saveLoc, saving] = useEventConfig(event, "location", {
    room: "",
    doorsOpen: event?.time || "18:00",
    starts: startLocal,
    ends: `${event?.date || "2026-01-01"}T22:00`,
  });
  const setLocField = (key) => (value) => setLoc({ ...loc, [key]: value });

  // Coordinates live on the shared `map` config (so the Map & Directions tab and
  // the public page read the same pin). The picker writes here.
  const [mapCfg, setMapCfg, saveMapCfg, savingMap] = useEventConfig(event, "map", {
    transport: "",
    parking: "",
    coords: null,
    ...EMPTY_NEARBY,
  });

  // Address is an event column (live via patch); coords go to the map config.
  // Moving the pin invalidates any previously detected nearby places.
  const handleLocation = ({ address, coords }) => {
    if (address !== undefined) patch({ address });
    if (coords !== undefined) {
      setMapCfg({ ...mapCfg, coords, ...EMPTY_NEARBY });
    }
  };

  const save = async () => {
    commit({
      venue: event?.venue,
      address: event?.address,
      timezone: event?.timezone,
    });
    await Promise.all([
      saveLoc(loc, { successMsg: "Location & time saved." }),
      saveMapCfg(mapCfg),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Own header — title on the left, location-mode tabs pinned to the far
          right (this section opts out of the editor's default header). */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold capitalize text-white">
            {headerItem?.label || "Location & Time"}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {headerItem?.desc ||
              "Search an address, drop a pin on the map, or enter coordinates."}
          </p>
        </div>
        {!isRemote ? (
          <LocationModeTabs
            mode={locMode}
            onModeChange={setLocMode}
            className="shrink-0"
          />
        ) : null}
      </div>

      {isRemote ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-8 text-center text-sm text-text-secondary">
          This is a remote event — an access link is sent on registration, so
          there&apos;s no physical location to pin.
        </div>
      ) : (
        <LocationPicker
          mode={locMode}
          address={event?.address || ""}
          coords={mapCfg.coords}
          onChange={handleLocation}
        />
      )}

      <SectionCard title="Venue details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Venue name">
            <Input
              value={event?.venue || ""}
              onChange={(e) => patch({ venue: e.target.value })}
              placeholder="Where is it held?"
            />
          </Field>
          <Field label="Room / floor">
            <Input
              value={loc.room || ""}
              onChange={(e) => setLocField("room")(e.target.value)}
              placeholder="e.g. Mezzanine"
            />
          </Field>
          <Field label="Timezone">
            <Select
              value={event?.timezone || "Europe/London"}
              onValueChange={(v) => patch({ timezone: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Date & time">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Doors open">
            <Input
              type="time"
              value={loc.doorsOpen || ""}
              onChange={(e) => setLocField("doorsOpen")(e.target.value)}
            />
          </Field>
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={loc.starts || ""}
              onChange={(e) => setLocField("starts")(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="datetime-local"
              value={loc.ends || ""}
              onChange={(e) => setLocField("ends")(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving || savingMap}
            onClick={save}
          >
            {saving || savingMap ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Map & Directions --------------------------------------------------------

function directionProviders(address, coords) {
  const q = encodeURIComponent(address || "");
  return [
    {
      name: "Google Maps",
      icon: MapIcon,
      href: `https://www.google.com/maps/search/?api=1&query=${q}`,
    },
    {
      name: "Apple Maps",
      icon: Navigation,
      href: `https://maps.apple.com/?q=${q}`,
    },
    {
      name: "Citymapper",
      icon: Train,
      href: coords
        ? `https://citymapper.com/directions?endcoord=${coords.lat},${coords.lng}`
        : `https://citymapper.com/search?q=${q}`,
    },
  ];
}

export function MapDirectionsSection({ event, headerItem }) {
  const [map, setMap, saveMap, saving] = useEventConfig(event, "map", {
    transport: "",
    parking: "",
    coords: null,
    ...EMPTY_NEARBY,
  });
  const setMapField = (key) => (value) => setMap({ ...map, [key]: value });
  const [detecting, setDetecting] = useState(false);

  const address = eventAddress(event);
  const coords = map.coords;
  const providers = directionProviders(address, coords);
  const gettingThere = nearbyGroups(map, GETTING_THERE_GROUPS);
  const aroundVenue = nearbyGroups(map, AROUND_VENUE_GROUPS);
  const anyNearby = hasNearby(map, GETTING_THERE_GROUPS, AROUND_VENUE_GROUPS);
  const mapPlaces = useMemo(() => flattenPlaces(map), [map]);

  // Lightweight geocode of the address so the map can centre on the venue's
  // area before the (heavier) Auto-detect is run. Centre-only — it never
  // persists or drops a pin; that stays the job of Auto-detect.
  const [autoCenter, setAutoCenter] = useState(null);
  const geocodedFor = useRef("");
  useEffect(() => {
    if (coords || !address || geocodedFor.current === address) return undefined;
    geocodedFor.current = address;
    let alive = true;
    geocodeAddress(address).then((g) => {
      if (alive && g) setAutoCenter({ lat: g.lat, lng: g.lng });
    });
    return () => {
      alive = false;
    };
  }, [address, coords]);

  const detect = async () => {
    if (!address) {
      toast.error("Add a venue address first.");
      return;
    }
    setDetecting(true);
    const res = await resolveEventLocation(address);
    setDetecting(false);
    if (!res) {
      toast.error("Couldn't locate that address on the map.");
      return;
    }
    const next = {
      ...map,
      coords: res.coords,
      nearbyParking: res.parking,
      nearbyTransit: res.transit,
      nearbyBike: res.bike,
      nearbyTaxi: res.taxi,
      nearbyCharging: res.charging,
      nearbyHotels: res.hotels,
      nearbyFood: res.food,
    };
    setMap(next);
    const found =
      res.transit.length +
      res.parking.length +
      res.bike.length +
      res.taxi.length +
      res.charging.length +
      res.hotels.length +
      res.food.length;
    saveMap(next, {
      successMsg: `Found ${found} nearby ${found === 1 ? "place" : "places"}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Own header — title on the left, the detect action pinned to the far
          right (this section opts out of the editor's default header). */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold capitalize text-white">
            {headerItem?.label || "Map & Directions"}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {headerItem?.desc ||
              "Help attendees arrive — a pinned map, getting-there notes, and directions."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={detecting}
          onClick={detect}
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {detecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LucideCircleParking className="h-4 w-4" />
          )}
          {detecting ? "Detecting…" : coords ? "Nearby Amenities" : "Nearby Amenities"}
        </Button>
      </div>

      {/* Map popped out of any card — full-bleed, with the address and the
          "open in" provider buttons sitting directly beneath it. */}
      <div>
        <EventMap
          coords={coords}
          places={mapPlaces}
          fallbackCenter={autoCenter}
          label={event?.venue || event?.name || "Venue"}
          address={address}
          className="aspect-[21/9] w-full"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="w-[50%] text-sm text-text-secondary">
            {address || "Set a venue address to place it on the map."}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-sm text-text-secondary">Open in:</span>
            {providers.map((p) => {
              const Icon = p.icon;
              return (
                <Button
                  key={p.name}
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <a href={p.href} target="_blank" rel="noopener noreferrer">
                    <Icon className="h-4 w-4" /> {p.name}
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <SectionCard
        title="Getting there"
        description="Auto-detected from the map, plus any notes you add. Shown on your event page."
      >
        <WeatherCard
          coords={coords || autoCenter}
          date={event?.date}
          className="mb-5"
        />
        {anyNearby ? (
          <div className="mb-5 space-y-5">
            <NearbyList groups={gettingThere} />
            <NearbyList groups={aroundVenue} />
          </div>
        ) : (
          <div className="mb-5 rounded-lg border border-dashed border-border bg-surface-card px-4 py-6 text-center text-sm text-text-secondary">
            Run <span className="text-foreground">Auto-detect</span> to list
            nearby transport, parking, cycling, hotels and food.
          </div>
        )}
        <div className="grid gap-4">
          <Field label="Extra transport notes" hint="Anything the map misses.">
            <Textarea
              rows={2}
              value={map.transport || ""}
              onChange={(e) => setMapField("transport")(e.target.value)}
              placeholder="e.g. Step-free access from the south entrance…"
            />
          </Field>
          <Field label="Parking notes" hint="Permits, validation, accessibility.">
            <Textarea
              rows={2}
              value={map.parking || ""}
              onChange={(e) => setMapField("parking")(e.target.value)}
              placeholder="e.g. Blue-badge bays on Level 1…"
            />
          </Field>
          <div className="flex justify-end">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={() => saveMap(map, { successMsg: "Directions saved." })}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Time-zone Support -------------------------------------------------------

export function TimezoneSupportSection({ event, headerItem }) {
  const [tz, , saveTz] = useEventConfig(event, "timezoneSettings", {
    default: event?.timezone || "Europe/London",
    format: "12h",
    localTz: true,
    showLabel: true,
  });
  const setTzField = (key) => (value) => saveTz({ ...tz, [key]: value });

  const columns = [
    {
      key: "name",
      header: "Event",
      render: (e) => (
        <span className="font-medium text-foreground">{e.name}</span>
      ),
    },
    {
      key: "city",
      header: "Location",
      render: (e) => <span className="text-sm text-muted-foreground">{e.city}</span>,
    },
    {
      key: "tz",
      header: "Timezone",
      render: (e) => (
        <Badge variant="neutral">
          <Globe className="h-3 w-3" />
          {e.city === "Remote" ? "Attendee local" : "Europe/London"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Time-zone"}
        description={headerItem?.desc}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workspace default timezone">
          <Select value={tz.default} onValueChange={setTzField("default")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Time format">
          <Select value={tz.format} onValueChange={setTzField("format")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-hour (6:30 PM)</SelectItem>
              <SelectItem value="24h">24-hour (18:30)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <SettingsList className="mt-5">
        <SettingRow
          icon={Clock}
          title="Show times in attendee's local timezone"
          description="Online events display converted times based on the visitor's device."
          checked={tz.localTz}
          onCheckedChange={setTzField("localTz")}
        />
        <SettingRow
          icon={Globe}
          title="Display timezone label"
          description="Append the timezone (e.g. BST) next to every time."
          checked={tz.showLabel}
          onCheckedChange={setTzField("showLabel")}
        />
      </SettingsList>

      <SectionCard
        title="Per-event timezones"
        description="How each event currently handles time."
        bodyPadding={false}
      >
        <DataTable
          columns={columns}
          data={EVENTS.slice(0, 5)}
          getRowKey={(e) => e.id}
          className="rounded-none border-0"
        />
      </SectionCard>
    </div>
  );
}
