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
  Unlink,
} from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { listVenues } from "@/lib/supabase/venues";
import { venueFullAddress } from "@/components/internal/screens/venues/constants";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EventDatePicker, EventTimeField } from "./date_time_fields";
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
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Singapore", label: "Singapore" },
];


export function LocationTimeSection({ event, headerItem, onPatch, onCommit }) {
  const patch = onPatch || (() => {});
  const commit = onCommit || (() => {});
  const isRemote = event?.city === "Remote";
  const [locMode, setLocMode] = useState("search");

  const [venues, setVenues] = useState([]);
  useEffect(() => {
    let alive = true;
    listVenues(event?.projectId).then((rows) => alive && setVenues(rows ?? []));
    return () => {
      alive = false;
    };
  }, [event?.projectId]);

  const [loc, setLoc, saveLoc, saving] = useEventConfig(event, "location", {
    room: "",
    doorsOpen: event?.time || "18:00",
    ends: "",
  });
  const setLocField = (key) => (value) => setLoc({ ...loc, [key]: value });

  const [mapCfg, setMapCfg, saveMapCfg, savingMap] = useEventConfig(event, "map", {
    transport: "",
    parking: "",
    coords: null,
    ...EMPTY_NEARBY,
  });

  const linkedVenue = venues.find((v) => v.id === event?.venueId) || null;

  const pickVenue = (id) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return;
    const hasCoords =
      v.latitude != null &&
      v.longitude != null &&
      v.latitude !== "" &&
      v.longitude !== "";
    commit({
      venueId: v.id,
      venue: v.name,
      address: venueFullAddress(v) || v.address || "",
      city: v.city || "",
      timezone: v.timezone || "Europe/London",
    });
    const nv = v.nearby || {};
    const nextMap = {
      ...mapCfg,
      coords: hasCoords ? { lat: Number(v.latitude), lng: Number(v.longitude) } : null,
      transport: v.transitNotes || "",
      parking: v.parkingNotes || "",
      nearbyParking: nv.nearbyParking || [],
      nearbyTransit: nv.nearbyTransit || [],
      nearbyBike: nv.nearbyBike || [],
      nearbyTaxi: nv.nearbyTaxi || [],
      nearbyCharging: nv.nearbyCharging || [],
      nearbyHotels: nv.nearbyHotels || [],
      nearbyFood: nv.nearbyFood || [],
    };
    setMapCfg(nextMap);
    saveMapCfg(nextMap);
    toast.success(`Prefilled from "${v.name}".`, {
      description: "Edit any field below to override it for this event.",
    });
  };

  const detachVenue = () => commit({ venueId: null });

  const handleLocation = ({ address, coords }) => {
    if (address !== undefined) patch({ address });
    if (coords !== undefined) {
      setMapCfg({ ...mapCfg, coords, ...EMPTY_NEARBY });
    }
  };

  const save = async () => {
    commit({
      venue: event?.venue,
      venueId: event?.venueId ?? null,
      address: event?.address,
      city: event?.city,
      timezone: event?.timezone,
      date: event?.date,
      time: event?.time,
    });
    await Promise.all([
      saveLoc(loc, { successMsg: "Location & time saved." }),
      saveMapCfg(mapCfg),
    ]);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Location & Time"}
        description={
          headerItem?.desc ||
          "Search an address, drop a pin on the map, or enter coordinates."
        }
        action={
          !isRemote ? (
            <LocationModeTabs
              mode={locMode}
              onModeChange={setLocMode}
              className="shrink-0"
            />
          ) : null
        }
      />

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

      {venues.length ? (
        <SectionCard
          title="Saved venue"
          description="Attach one to prefill the location, map pin, arrival notes and nearby places — or type a name below."
          action={
            linkedVenue ? (
              <Button
                size="sm"
                variant="outline"
                onClick={detachVenue}
                className="shrink-0 gap-1.5 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <Unlink className="h-3.5 w-3.5" /> Detach
              </Button>
            ) : null
          }
        >
          <Select value={event?.venueId || ""} onValueChange={pickVenue}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a saved venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.city ? ` · ${v.city}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SectionCard>
      ) : null}

      <SectionCard title="Venue details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Venue name">
            <Input
              value={event?.venue || ""}
              onChange={(e) => patch({ venue: e.target.value, venueId: null })}
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

        <div className="mt-6 mb-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <EventDatePicker
              value={event?.date}
              onChange={(date) => patch({ date })}
            />
          </Field>
          <Field label="Starts">
            <EventTimeField
              value={event?.time}
              onChange={(time) => patch({ time })}
            />
          </Field>
          <Field label="Doors open">
            <EventTimeField
              value={loc.doorsOpen || ""}
              onChange={(time) => setLocField("doorsOpen")(time)}
            />
          </Field>
          <Field label="Ends" hint="Optional — set for multi-day events.">
            <div className="flex gap-2">
              <EventDatePicker
                value={(loc.ends || "").split("T")[0] || ""}
                onChange={(date) =>
                  setLocField("ends")(
                    [date, (loc.ends || "").split("T")[1] || ""]
                      .filter(Boolean)
                      .join("T"),
                  )
                }
              />
              <EventTimeField
                value={(loc.ends || "").split("T")[1] || ""}
                onChange={(time) =>
                  setLocField("ends")(
                    [(loc.ends || "").split("T")[0] || "", time]
                      .filter(Boolean)
                      .join("T"),
                  )
                }
              />
            </div>
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
      <EditorSectionHeader
        title={headerItem?.label || "Map & Directions"}
        description={
          headerItem?.desc ||
          "Help attendees arrive — a pinned map, getting-there notes, and directions."
        }
        action={
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
            {detecting ? "Detecting…" : "Nearby Amenities"}
          </Button>
        }
      />

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
          <p className="min-w-0 max-w-xl flex-1 text-sm text-text-secondary">
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


export function TimezoneSupportSection({ event, headerItem }) {
  const [tz, , saveTz] = useEventConfig(event, "timezoneSettings", {
    default: event?.timezone || "Europe/London",
    format: "12h",
    localTz: true,
    showLabel: true,
  });
  const setTzField = (key) => (value) => saveTz({ ...tz, [key]: value });

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
    </div>
  );
}
