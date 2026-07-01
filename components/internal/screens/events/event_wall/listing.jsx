"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Star, X } from "lucide-react";

import { Field, SectionCard, EmptyState } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { listListableEvents } from "@/lib/supabase/events";
import { formatDate } from "../sample_data";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming only" },
  { value: "all", label: "All listable events" },
  { value: "past", label: "Past only" },
];

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date — soonest first" },
  { value: "date_desc", label: "Date — latest first" },
  { value: "recent", label: "Recently added" },
];

const DEFAULT_FILTERS = { status: "upcoming", sortBy: "date_asc" };

// Which events appear on the wall (only events an organizer has marked
// listable — see the Visibility section of the event editor), how they're
// sorted, and an optional manually-ordered "featured" set pinned to the top.
export function WallEventsSection({ wall }) {
  const { projectId } = useProject();
  const [filters, setFilters, saveFilters] = useWallConfig(
    wall,
    "filters",
    DEFAULT_FILTERS,
  );
  const [featured, , saveFeatured] = useWallConfig(wall, "featured", []);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listListableEvents(projectId).then((rows) => {
      if (!alive) return;
      setEvents(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const featuredEvents = featured
    .map((id) => events.find((e) => e.id === id))
    .filter(Boolean);
  const availableEvents = events.filter((e) => !featured.includes(e.id));

  const addFeatured = (id) =>
    saveFeatured([...featured, id], { successMsg: "Featured events updated." });
  const removeFeatured = (id) =>
    saveFeatured(featured.filter((f) => f !== id));
  const moveFeatured = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= featured.length) return;
    const copy = [...featured];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveFeatured(copy);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Filter & sort"
        description="Controls which listable events show on your public page, and their default order."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Show">
            <Select
              value={filters.status || "upcoming"}
              onValueChange={(v) =>
                saveFilters({ ...filters, status: v }, {
                  successMsg: "Filter updated.",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sort by">
            <Select
              value={filters.sortBy || "date_asc"}
              onValueChange={(v) =>
                saveFilters({ ...filters, sortBy: v }, {
                  successMsg: "Sort order updated.",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Featured events"
        description="Pinned to the top of the wall, in this order, ahead of everything else."
      >
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
          </div>
        ) : (
          <div className="space-y-4">
            {featuredEvents.length ? (
              <div className="space-y-2">
                {featuredEvents.map((e, i) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5"
                  >
                    <Star className="h-4 w-4 shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {formatDate(e.date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === 0}
                        onClick={() => moveFeatured(i, -1)}
                        aria-label="Move up"
                        className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === featuredEvents.length - 1}
                        onClick={() => moveFeatured(i, 1)}
                        aria-label="Move down"
                        className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeFeatured(e.id)}
                        aria-label="Remove from featured"
                        className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No featured events yet — pin one below to spotlight it.
              </p>
            )}

            {availableEvents.length ? (
              <Field label="Add a featured event">
                <Select value="" onValueChange={addFeatured}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a listable event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {!events.length ? (
              <EmptyState
                title="No listable events yet"
                description='Mark an event "List on Event Wall" in its Visibility settings to have it appear here.'
              />
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default WallEventsSection;
