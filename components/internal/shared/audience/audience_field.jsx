"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarDays } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listEvents } from "@/lib/supabase/events";
import { AudienceBuilder } from "./audience_builder";
import { normalizeSpec, describeSpec } from "@/lib/audience/resolve";

// Reusable audience form control: an optional event scope + the AudienceBuilder.
// Stores its value as a live audience spec (see lib/audience/resolve.js). Legacy
// { eventId, emails } / "all" / "selected" values migrate in via normalizeSpec.
// Pick an event to unlock ticket/offering/add-on targeting; leave it on
// "All guests" to target the whole project by segment / tag / status / individual.
export function AudienceField({ projectId, value, onChange }) {
  const spec = useMemo(() => normalizeSpec(value), [value]);
  const eventId = spec.scope === "event" ? spec.eventId : "";

  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (alive) setEvents(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Changing scope resets criteria — ticket/offering facets only exist per-event.
  const chooseEvent = (v) =>
    onChange({
      ...normalizeSpec(null),
      scope: v === "none" ? "project" : "event",
      eventId: v === "none" ? "" : v,
      mode: spec.mode,
    });

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-card px-3 py-4 text-center text-xs text-text-secondary">
        Save this first, then choose an audience.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
          Scope
        </span>
        <Select value={eventId || "none"} onValueChange={chooseEvent}>
          <SelectTrigger className="h-9 flex-1 bg-surface-card text-sm sm:max-w-[15rem]">
            <SelectValue placeholder="All guests (project-wide)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All guests (project-wide)</SelectItem>
            {events === null ? (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading events…
              </div>
            ) : (
              events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name || "Untitled event"}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-tertiary">
          {describeSpec(spec)}
        </span>
      </div>

      <AudienceBuilder
        key={eventId || "project"}
        projectId={projectId}
        eventId={eventId}
        spec={spec}
        onSpecChange={onChange}
      />
    </div>
  );
}

export default AudienceField;
