"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2, Map as MapIcon, Save } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import { Field, SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import {
  ActionMenu,
  Badge,
  Button,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { currency } from "@/components/internal/screens/tickets/constants";
import { formatDate } from "@/components/internal/screens/events/sample_data";
import { BOOTH_SIZE_CLASSES } from "@/lib/event_design";
import { updateExpoBooth } from "@/lib/supabase/expo_halls";
import { PlanRenderer } from "@/components/internal/screens/event_design/plan_renderer";
import { BOOTH_STATE_MAP, boothFootprint, boothStateOf, loadEventBoothState } from "./booth_state";
import { boothEventActions } from "./booth_actions";

// One booth's edit page: its number and sale fields (written through the hall's plan), where it sits on the floor,
// and what it is doing at every event that sells its hall.

const outline = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

const draftOf = (booth) => ({ label: booth.code, sizeClass: booth.sizeClass, price: booth.price || "", zone: booth.zone });

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium tabular-nums text-foreground">{value || "—"}</span>
    </div>
  );
}

export function BoothDetail({ booth, events, demoStates, onBack, onSaved, onOpenPlan, onAssign, refreshKey }) {
  const [draft, setDraft] = useState(() => draftOf(booth));
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState(demoStates || null);
  const [stateKey, setStateKey] = useState(0);

  useEffect(() => {
    if (demoStates || !events.length) return undefined;
    let alive = true;
    Promise.all(events.map((e) => loadEventBoothState(e.id))).then((rows) => {
      if (alive) setStates(new Map(events.map((e, i) => [e.id, rows[i]])));
    });
    return () => {
      alive = false;
    };
  }, [events, demoStates, stateKey, refreshKey]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(booth));

  const save = async () => {
    if (!draft.label.trim()) {
      toast.error("Give the booth a number.");
      return;
    }
    setSaving(true);
    const result = await updateExpoBooth({ plan: booth.hall.plan, booth }, {
      label: draft.label,
      sizeClass: draft.sizeClass,
      price: Number(draft.price) || 0,
      zone: draft.zone,
    });
    setSaving(false);
    if (result === "conflict") {
      toast.error("Someone saved this hall a moment ago — reload and try again.");
      return;
    }
    if (!result || result.boothSync === "failed") {
      toast.error("Couldn't save the booth.");
      return;
    }
    toast.success(`Booth ${draft.label.trim()} saved.`);
    onSaved?.();
  };

  const footprint = boothFootprint(booth);

  return (
    <MainScreenWrapper>
      <EditorHeader
        back={{ label: "Expo Booths", onClick: onBack }}
        title={`Booth ${booth.code || "—"}`}
        badges={
          <>
            <Badge variant="neutral">{booth.sizeClass}</Badge>
            <Badge variant="info">{booth.hallName}</Badge>
          </>
        }
        actions={
          booth.planId ? (
            <Button variant="outline" className={outline} onClick={() => onOpenPlan(booth)}>
              <MapIcon className="h-4 w-4" /> Open on floor plan
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="Details"
            description="What exhibitors see when they pick a booth. Saving updates the hall for every event that sells it."
            action={
              <Button
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!dirty || saving || Boolean(demoStates)}
                onClick={save}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Booth number">
                <Input value={draft.label} onChange={(e) => set("label")(e.target.value)} placeholder="e.g. A12" />
              </Field>
              <Field label="Size class">
                <Select value={draft.sizeClass} onValueChange={set("sizeClass")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOTH_SIZE_CLASSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Price" hint="Used when an event sells booths at their own price.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.price}
                  onChange={(e) => set("price")(e.target.value)}
                  placeholder="0"
                  className="tabular-nums"
                />
              </Field>
              <Field label="Zone or aisle">
                <Input value={draft.zone} onChange={(e) => set("zone")(e.target.value)} placeholder="e.g. Hall B · Aisle 3" />
              </Field>
            </div>
            <div className="mt-4 divide-y divide-border border-t border-border">
              <InfoRow label="Footprint" value={footprint || "Set when the hall is opened in the editor"} />
              <InfoRow label="Hall" value={booth.hallName} />
            </div>
          </SectionCard>

          <SectionCard title="On the floor" description="Where the booth sits in its hall.">
            {booth.hall?.plan ? (
              <div className="relative h-80 overflow-hidden rounded-lg border border-border bg-surface-card">
                <PlanRenderer plan={booth.hall.plan} selectedIds={[booth.id]} padding={0.05} className="pointer-events-none" />
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                This hall predates the floor plan editor. Open it from Floor Plan &amp; Booths once to draw it to scale.
              </p>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Events"
          description={events.length ? "This booth at every event selling its hall." : undefined}
          bodyPadding={!events.length}
        >
          {!events.length ? (
            <p className="text-sm text-text-secondary">
              No event sells this hall yet. Pick it on an event&apos;s Exhibitor Floor tab to put its booths on sale.
            </p>
          ) : !states ? (
            <div className="flex justify-center py-10">
              <LogoLoading size={36} aria-label="Loading booth status" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => {
                const state = boothStateOf(booth.id, states.get(event.id));
                const a = state.assignment;
                const items = demoStates
                  ? []
                  : boothEventActions({ event, booth, state, onAssign, onDone: () => setStateKey((k) => k + 1) });
                return (
                  <li key={event.id} className="flex items-start gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                        <span className="truncate">{event.name || "Untitled event"}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={state.key} map={BOOTH_STATE_MAP} />
                        {event.date ? <span className="text-xs text-text-tertiary">{formatDate(event.date)}</span> : null}
                      </div>
                      {a && a.status !== "blocked" ? (
                        <p className="truncate text-xs text-text-secondary">
                          {[a.exhibitorName || "Exhibitor", a.exhibitorEmail, a.price ? currency(a.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {state.key === "sold" ? (
                        <p className="text-xs text-text-tertiary">Sold through checkout — refund the order to free it.</p>
                      ) : null}
                    </div>
                    {items.length ? <ActionMenu label={`Actions for ${event.name}`} items={items} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

export default BoothDetail;
