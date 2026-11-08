"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Building2, Check, Globe, ListChecks, Loader2, MapPin, Phone, Plus, RotateCw, Search } from "lucide-react";

import { ScreenHeader, SearchInput, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { Button, LogoLoading, cn } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { conferenceApi } from "@/lib/supabase/conference";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { VENUE_PIPELINE_MODULE } from "./venue_pipeline";
import { VENUE_TYPES, searchVenues, venueResultToLead } from "@/lib/venues/discovery";

const VenueMap = dynamic(() => import("./venue_map"), {
  ssr: false,
  loading: () => <MapPlaceholder label="Loading map…" />,
});

const RADIUS_OPTIONS = [
  { value: "2000", label: "Within 2 km" },
  { value: "5000", label: "Within 5 km" },
  { value: "10000", label: "Within 10 km" },
  { value: "25000", label: "Within 25 km" },
];

const SORT_OPTIONS = [
  { value: "distance", label: "Nearest first" },
  { value: "name", label: "Name A–Z" },
];

const TYPE_OPTIONS = VENUE_TYPES.map((t) => ({ value: t.value, label: t.label }));

const POPULAR = ["London", "Amsterdam", "New York", "Austin", "Berlin", "Paris"];

// The server caps a search at 50 km, so a wider map view can't be searched as-is.
const MAX_AREA_M = 50000;

const outline = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

const resultKey = (r) => `${r.source}:${r.sourceId}`;

function formatDistance(m) {
  if (!Number.isFinite(m)) return "";
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// "SoHo, Manhattan, New York County, …" → "SoHo, Manhattan".
const shortPlace = (label) => String(label || "").split(",").slice(0, 2).join(",").trim();

export function VenueSourcingScreen() {
  // An open pipeline record in the URL (e.g. coming Back from an RFP) starts on the Pipeline tab.
  const { recordId } = useWorkspaceUrl();
  const [tab, setTab] = useState(recordId ? "pipeline" : "discover");

  const tabSwitch = (
    <SegmentedTabs
      className="w-fit sm:w-fit"
      value={tab}
      onChange={setTab}
      tabs={[
        { value: "discover", label: "Discover", icon: Search },
        { value: "pipeline", label: "Pipeline", icon: ListChecks },
      ]}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {tab === "discover" ? (
        <DiscoverPanel tabs={tabSwitch} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RecordsScreen mod={VENUE_PIPELINE_MODULE} api={conferenceApi} headerActions={tabSwitch} />
        </div>
      )}
    </div>
  );
}

function DiscoverPanel({ tabs }) {
  const { projectId } = useProject();
  const [userId, setUserId] = useState(null);

  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [radius, setRadius] = useState("5000");
  const [sort, setSort] = useState("distance");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [center, setCenter] = useState(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [lastSearch, setLastSearch] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [area, setArea] = useState(null);
  const [addedKeys, setAddedKeys] = useState(() => new Set());
  const rowRefs = useRef(new Map());

  useEffect(() => {
    getUser().then((u) => setUserId(u?.id || null));
  }, []);

  // Venues already in the pipeline show as added, so a repeat search doesn't invite duplicates.
  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    conferenceApi.list(projectId, "venue_lead").then((rows) => {
      if (!alive || !rows) return;
      const keys = rows
        .filter((r) => r.config?.source && r.config?.sourceId)
        .map((r) => `${r.config.source}:${r.config.sourceId}`);
      setAddedKeys((prev) => new Set([...prev, ...keys]));
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const runSearch = useCallback(async (params) => {
    if (!params.q && !params.near) {
      toast.error("Enter a city, area or address to search.");
      return;
    }
    setLoading(true);
    setError("");
    setArea(null);
    setLastSearch(params);
    const res = await searchVenues({ q: params.q, near: params.near, radius: Number(params.radius), type: params.type });
    setLoading(false);
    setActiveId(null);
    if (res.center) setCenter(res.center);
    if (!res.ok) {
      setError(res.error);
      setResults([]);
      return;
    }
    setResults(res.results);
    setPlaceLabel(params.near ? "this map area" : shortPlace(res.label) || params.q);
  }, []);

  const onSubmit = (e) => {
    e?.preventDefault?.();
    runSearch({ q: query.trim(), type, radius });
  };

  const searchFor = (city) => {
    setQuery(city);
    runSearch({ q: city, type, radius });
  };

  // Changing a filter after a search re-runs it with the new value.
  const changeType = (value) => {
    setType(value);
    if (lastSearch) runSearch({ ...lastSearch, type: value });
  };
  const changeRadius = (value) => {
    setRadius(value);
    if (lastSearch && !lastSearch.near) runSearch({ ...lastSearch, radius: value });
  };

  const searchArea = () => {
    if (!area) return;
    runSearch({ near: `${area.center.lat},${area.center.lng}`, radius: String(Math.max(area.radius, 1000)), type });
  };

  const selectFromList = (id) => {
    setActiveId(id);
    setFocus((f) => ({ id, n: (f?.n || 0) + 1 }));
  };

  const selectFromMap = (id) => {
    setActiveId(id);
    rowRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const addToShortlist = async (r) => {
    const key = resultKey(r);
    if (addedKeys.has(key)) return;
    if (!projectId) {
      toast.error("Open a project first to shortlist venues.");
      return;
    }
    setAddedKeys((prev) => new Set(prev).add(key));
    const saved = await conferenceApi.create({
      id: crypto.randomUUID(),
      module: "venue_lead",
      coverUrl: r.photoUrl || "",
      createdBy: userId,
      projectId,
      ...venueResultToLead(r),
    });
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

  const sorted = useMemo(
    () =>
      sort === "name"
        ? [...results].sort((a, b) => a.name.localeCompare(b.name))
        : [...results].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)),
    [results, sort],
  );

  const headline = loading
    ? "Searching…"
    : error
      ? "Search failed"
      : lastSearch
        ? `${sorted.length} venue${sorted.length === 1 ? "" : "s"} near ${placeLabel}`
        : "Start a search";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full flex-col gap-6 px-2 pb-6 pt-4 lg:h-full lg:max-w-[85%] lg:px-0">
        <ScreenHeader
          title="Venue Sourcing"
          description="Search real venues from OpenStreetMap, preview them on the map, and shortlist the best into your pipeline."
          actions={tabs}
        />

        <form onSubmit={onSubmit} className="flex shrink-0 flex-wrap items-center gap-2">
          <SearchInput
            expanded
            value={query}
            onChange={setQuery}
            placeholder="City, neighbourhood or address"
            className="w-auto min-w-[220px] flex-1"
          />
          <FilterDropdown value={type} onValueChange={changeType} options={TYPE_OPTIONS} height="h-9" />
          <FilterDropdown value={radius} onValueChange={changeRadius} options={RADIUS_OPTIONS} height="h-9" />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </form>

        <div className="grid overflow-hidden rounded-xl border border-border bg-surface-subtle lg:min-h-[480px] lg:flex-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-border max-lg:h-[440px] lg:border-b-0 lg:border-r">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{headline}</p>
              {!loading && sorted.length > 1 ? (
                <FilterDropdown value={sort} onValueChange={setSort} options={SORT_OPTIONS} height="h-8" />
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16">
                  <LogoLoading size={40} aria-label="Searching venues" />
                </div>
              ) : error ? (
                <ListMessage title="The search didn't go through" desc={error}>
                  <Button variant="outline" size="sm" className={`h-8 ${outline}`} onClick={() => runSearch(lastSearch)}>
                    <RotateCw className="h-3.5 w-3.5" /> Try again
                  </Button>
                </ListMessage>
              ) : !lastSearch ? (
                <div className="space-y-4 px-4 py-5">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Find venues anywhere</p>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      Search a city, neighbourhood or full address — or pan the map and search that area.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR.map((city) => (
                      <Button
                        key={city}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-8 ${outline}`}
                        onClick={() => searchFor(city)}
                      >
                        {city}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : !sorted.length ? (
                <ListMessage
                  title="No venues found"
                  desc="Try a wider radius, another venue type, or search a different area."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {sorted.map((r) => (
                    <ResultRow
                      key={r.id}
                      r={r}
                      active={r.id === activeId}
                      added={addedKeys.has(resultKey(r))}
                      rowRef={(el) => (el ? rowRefs.current.set(r.id, el) : rowRefs.current.delete(r.id))}
                      onHover={setActiveId}
                      onSelect={selectFromList}
                      onAdd={addToShortlist}
                    />
                  ))}
                </ul>
              )}
            </div>

            <p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-text-tertiary">
              Venue data © OpenStreetMap contributors
            </p>
          </div>

          <div className="relative h-[360px] lg:h-auto">
            <VenueMap
              center={center}
              results={sorted}
              activeId={activeId}
              onSelect={selectFromMap}
              focus={focus}
              onUserMove={(c, r) => setArea({ center: c, radius: r })}
            />
            {area && !loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={area.radius > MAX_AREA_M}
                  onClick={searchArea}
                  className="pointer-events-auto h-8 border-border-strong bg-surface-card text-foreground shadow-lg hover:bg-surface-hover"
                >
                  {area.radius > MAX_AREA_M ? (
                    "Zoom in to search this area"
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" /> Search this area
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListMessage({ title, desc, children }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {desc ? <p className="mx-auto max-w-xs text-xs leading-relaxed text-text-secondary">{desc}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ r, active, added, rowRef, onHover, onSelect, onAdd }) {
  const meta = [r.category, formatDistance(r.distanceM), r.address || r.city].filter(Boolean);
  return (
    <li ref={rowRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(r.id)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(r.id)}
        onMouseEnter={() => onHover(r.id)}
        className={cn(
          "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors focus-visible:outline-none",
          active ? "bg-surface-hover" : "hover:bg-surface-hover",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card">
          {r.photoUrl ? (
            <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4 text-text-tertiary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-text-secondary">{meta.join(" · ")}</p>
          {r.website || r.phone ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
              {r.website ? (
                <a
                  href={r.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Globe className="h-3 w-3" /> Website
                </a>
              ) : null}
              {r.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {r.phone}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {added ? (
          <Button size="sm" variant="outline" disabled className={`h-8 shrink-0 ${outline}`}>
            <Check className="h-3.5 w-3.5" /> Added
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={`h-8 shrink-0 ${outline}`}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(r);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Shortlist
          </Button>
        )}
      </div>
    </li>
  );
}

function MapPlaceholder({ label }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
      <MapPin className="mr-2 h-4 w-4" /> {label}
    </div>
  );
}

export default VenueSourcingScreen;
