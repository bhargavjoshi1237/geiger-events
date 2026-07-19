"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  BedDouble,
  Check,
  Globe,
  ListChecks,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Plane,
  Plus,
  Search,
  Star,
  TrainFront,
} from "lucide-react";

import { ScreenHeader, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, Tabs, TabsList, TabsTrigger, cn } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { conferenceApi } from "@/lib/supabase/conference";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { MODULES } from "./modules";
import {
  HOUSING_TYPES,
  searchHousing,
  housingResultToLead,
} from "@/lib/housing/discovery";

// Housing & Travel is a two-mode screen. "Discover" searches real accommodation
// and travel gateways (airports / main-line rail) from OpenStreetMap — free, no
// key — via /api/housing/search, then shortlists them into the pipeline;
// "Pipeline" is the existing housing record list (RecordsScreen).

// Reuses the venue location map (CARTO dark tiles + shared MapZoomControls).
const VenueMap = dynamic(() => import("./venue_map"), {
  ssr: false,
  loading: () => <MapPlaceholder label="Loading map…" />,
});

const RADIUS_OPTIONS = [
  { value: "2000", label: "Within 2 km" },
  { value: "5000", label: "Within 5 km" },
  { value: "10000", label: "Within 10 km" },
  { value: "25000", label: "Within 25 km" },
  { value: "50000", label: "Within 50 km" },
];

const TYPE_OPTIONS = HOUSING_TYPES.map((t) => ({ value: t.value, label: t.label }));

const GROUP_ICON = { stay: BedDouble, airport: Plane, station: TrainFront };

// Quick-start chips + value props shown before the first search.
const POPULAR = ["London", "Amsterdam", "New York", "Austin", "Berlin", "Paris"];
const FEATURES = [
  {
    icon: BedDouble,
    title: "Stays near your event",
    desc: "Hotels, hostels and apartments — straight from OpenStreetMap.",
  },
  {
    icon: Plane,
    title: "Airports & rail",
    desc: "The nearest travel gateways so attendees can plan their trip.",
  },
  {
    icon: Plus,
    title: "One-click shortlist",
    desc: "Send options straight into your housing pipeline.",
  },
];

export function HousingTravelScreen() {
  const [tab, setTab] = useState("discover");

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full shrink-0 px-2 pt-1 lg:max-w-[85%] lg:px-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="discover">
              <Search className="h-4 w-4" /> Discover
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              <ListChecks className="h-4 w-4" /> Pipeline
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "discover" ? (
        <DiscoverPanel />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RecordsScreen mod={MODULES.housing} api={conferenceApi} />
        </div>
      )}
    </div>
  );
}

function DiscoverPanel() {
  const { projectId } = useProject();
  const [userId, setUserId] = useState(null);

  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [radius, setRadius] = useState("5000");

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [center, setCenter] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [addedKeys, setAddedKeys] = useState(() => new Set());

  useEffect(() => {
    getUser().then((u) => setUserId(u?.id || null));
  }, []);

  const doSearch = useCallback(
    async (raw) => {
      const term = (raw ?? "").trim();
      if (!term) {
        toast.error("Enter a city or area to search.");
        return;
      }
      setLoading(true);
      setError("");
      const res = await searchHousing({ q: term, radius: Number(radius), type });
      setLoading(false);
      setSearched(true);
      if (!res.ok) {
        setError(res.error);
        setResults([]);
        setCenter(null);
        toast.error(res.error);
        return;
      }
      setResults(res.results);
      setCenter(res.center);
      setActiveId(null);
      if (!res.results.length) {
        toast.message("Nothing found — try a wider radius or another type.");
      }
    },
    [radius, type],
  );

  const onSubmit = (e) => {
    e?.preventDefault?.();
    doSearch(query);
  };

  // Quick-search chip — fills the box and searches in one tap.
  const searchFor = (city) => {
    setQuery(city);
    doSearch(city);
  };

  const addToShortlist = async (r) => {
    const key = `${r.source}:${r.sourceId}`;
    if (addedKeys.has(key)) return;
    if (!projectId) {
      toast.error("Open a project first to shortlist options.");
      return;
    }
    const lead = housingResultToLead(r);
    const record = {
      id: crypto.randomUUID(),
      module: "housing",
      coverUrl: r.photoUrl || "",
      createdBy: userId,
      projectId,
      ...lead,
    };
    setAddedKeys((prev) => new Set(prev).add(key));
    const saved = await conferenceApi.create(record);
    if (saved) {
      toast.success(`"${r.name}" added to your pipeline.`);
    } else {
      toast.error("Couldn't add to the pipeline.");
      setAddedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const showResults = loading || searched;

  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-6 px-2 pb-6 pt-4 lg:max-w-[85%] lg:px-0">
      <ScreenHeader
        title="Housing & Travel"
        description="Search real hotels, hostels and apartments — plus airports and rail stations — from OpenStreetMap, then shortlist the best into your pipeline."
      />

      <form onSubmit={onSubmit} className="shrink-0">
        <Toolbar>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search a city or area — e.g. Amsterdam, Austin, SoHo NYC"
              className="w-full sm:max-w-xs"
            />
            <FilterDropdown
              value={type}
              onValueChange={setType}
              options={TYPE_OPTIONS}
              height="h-9"
            />
            <FilterDropdown
              value={radius}
              onValueChange={setRadius}
              options={RADIUS_OPTIONS}
              height="h-9"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </Toolbar>
      </form>

      {showResults ? (
        // minmax(0,1fr) row caps the panels at the remaining viewport height so the list/map scroll internally, never the page
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
          <ScrollArea className="h-[420px] rounded-xl lg:h-full">
            <div className="space-y-3 pr-3">
              <ResultsColumn
                loading={loading}
                error={error}
                results={results}
                activeId={activeId}
                addedKeys={addedKeys}
                onHover={setActiveId}
                onAdd={addToShortlist}
              />
            </div>
          </ScrollArea>

          <div className="relative h-[320px] overflow-hidden rounded-xl border border-border bg-surface-subtle lg:h-full">
            {results.length || center ? (
              <VenueMap
                center={center}
                results={results}
                activeId={activeId}
                onSelect={setActiveId}
              />
            ) : (
              <MapPlaceholder label="Search to see stays & travel on the map" />
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DiscoverIntro onPick={searchFor} />
        </div>
      )}
    </div>
  );
}

// Pre-search state — a composed intro with quick-start city chips and the value
// props, replacing the two empty panels.
function DiscoverIntro({ onPick }) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-subtle">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-card">
            <Search className="h-7 w-7 text-text-secondary" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-strong text-primary">
              <BedDouble className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">Find Stays & Travel</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Search hotels, hostels and apartments — plus nearby airports and rail
              stations — from OpenStreetMap, and shortlist the best into your pipeline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// A compact status block for the results column (loading / error / empty).
function ColumnMessage({ icon: Icon, title, desc }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {desc ? <p className="mx-auto max-w-xs text-sm text-text-secondary">{desc}</p> : null}
      </div>
    </div>
  );
}

// Loading placeholder that mirrors the ResultCard rows while a search runs.
function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-border bg-surface-subtle p-3"
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 shrink-0 self-center rounded-md" />
        </div>
      ))}
    </div>
  );
}

function ResultsColumn({
  loading,
  error,
  results,
  activeId,
  addedKeys,
  onHover,
  onAdd,
}) {
  if (loading) {
    return <ResultsSkeleton />;
  }
  if (error) {
    return <ColumnMessage icon={MapPin} title="Search failed" desc={error} />;
  }
  if (!results.length) {
    return (
      <ColumnMessage
        icon={Search}
        title="Nothing found"
        desc="Try a wider radius, a different type, or another location."
      />
    );
  }
  return (
    <>
      <p className="px-1 text-xs text-text-tertiary">
        {results.length} result{results.length === 1 ? "" : "s"} found
      </p>
      {results.map((r) => (
        <ResultCard
          key={r.id}
          r={r}
          active={r.id === activeId}
          added={addedKeys.has(`${r.source}:${r.sourceId}`)}
          onHover={onHover}
          onAdd={onAdd}
        />
      ))}
    </>
  );
}

function ResultCard({ r, active, added, onHover, onAdd }) {
  const Icon = GROUP_ICON[r.group] || BedDouble;
  const km = r.distance != null ? `${(r.distance / 1000).toFixed(1)} km` : "";
  return (
    <article
      onMouseEnter={() => onHover(r.id)}
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-colors",
        active
          ? "border-border-strong bg-surface-hover"
          : "border-border bg-surface-subtle hover:bg-surface-hover",
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-card">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-text-tertiary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {r.name}
          </h3>
          <p className="truncate text-xs text-text-secondary">
            {[r.kind, r.address || r.city].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
          {km && (
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3" /> {km}
            </span>
          )}
          {r.iata && (
            <span className="rounded bg-surface-card px-1.5 py-0.5 font-medium text-text-secondary">
              {r.iata}
            </span>
          )}
          {r.stars != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-400" /> {r.stars}
            </span>
          )}
          {r.website && (
            <a
              href={r.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
          {r.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {r.phone}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 self-center">
        {added ? (
          <Button size="sm" variant="outline" disabled className="h-8">
            <Check className="h-4 w-4" /> Added
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onAdd(r)}
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Shortlist
          </Button>
        )}
      </div>
    </article>
  );
}

function MapPlaceholder({ label }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
      <MapPin className="mr-2 h-4 w-4" /> {label}
    </div>
  );
}

export default HousingTravelScreen;
