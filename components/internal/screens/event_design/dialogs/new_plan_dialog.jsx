"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, TriangleAlert } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import {
  DEFAULT_ROOM,
  formatDimensions,
  MIN_ROOM_M,
  objectsOutsideRoom,
  planSummary,
  setupStyleLabel,
} from "@/lib/event_design";
import { EventSelect, LengthInput, SetupStyleSelect, UnitToggle } from "../fields";
import { TEMPLATE_CATEGORIES } from "../constants";
import { SpacePicker } from "./space_picker";

// Create a plan (or template / library diagram): from a blank room, a venue space's real size, or a copy of a template / diagram.

const SOURCE_TABS = [
  { value: "blank", label: "Blank room" },
  { value: "space", label: "Venue space" },
  { value: "template", label: "Template" },
];

function seedDraft(initial, templates, ctx) {
  const space = initial.spaceId ? ctx.spaceById.get(initial.spaceId) : null;
  const sourcePlan =
    initial.source === "library"
      ? initial.sourcePlan
      : initial.source === "template"
        ? templates.find((t) => t.id === initial.templateId) || templates[0] || null
        : null;
  return {
    name: initial.name ?? sourcePlan?.name ?? "",
    source: initial.source || "blank",
    templateId: initial.source === "template" ? sourcePlan?.id ?? null : null,
    venueId: initial.venueId ?? space?.venueId ?? sourcePlan?.venueId ?? null,
    spaceId: initial.spaceId ?? (initial.source === "library" ? sourcePlan?.venueSpaceId ?? null : null),
    eventId: initial.eventId ?? null,
    widthM: space?.widthM || sourcePlan?.widthM || DEFAULT_ROOM.widthM,
    lengthM: space?.lengthM || sourcePlan?.lengthM || DEFAULT_ROOM.lengthM,
    unit: space?.unit || sourcePlan?.unit || "m",
    setupStyle: sourcePlan?.setupStyle || "custom",
    templateCategory: sourcePlan?.templateCategory || TEMPLATE_CATEGORIES[0],
  };
}

export function NewPlanDialog({
  open,
  onOpenChange,
  ctx,
  projectId,
  templates = [],
  initial = {},
  kind = "plan",
  requireSpace = false,
  requireEvent = false,
  title = "New floor plan",
  description = "Draw a room to scale, then lay out tables, staging and everything else on it.",
  submitLabel = "Create plan",
  onCreate,
}) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setSeeded(true);
    setDraft(seedDraft(initial, templates, ctx));
  } else if (!open && seeded) {
    setSeeded(false);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const fixedSource = draft?.source === "library";

  const sourcePlan = useMemo(() => {
    if (!draft) return null;
    if (draft.source === "library") return initial.sourcePlan || null;
    if (draft.source === "template") return templates.find((t) => t.id === draft.templateId) || null;
    return null;
  }, [draft, initial.sourcePlan, templates]);

  const outsideCount = useMemo(() => {
    if (!sourcePlan || !draft) return 0;
    return objectsOutsideRoom({ widthM: draft.widthM, lengthM: draft.lengthM, outline: { type: "rect" } }, sourcePlan.objects).length;
  }, [sourcePlan, draft]);

  if (!draft) return <Dialog open={open} onOpenChange={onOpenChange} />;

  const spaceDims = (space) =>
    space?.widthM && space?.lengthM ? { widthM: space.widthM, lengthM: space.lengthM, unit: space.unit } : {};

  const pickSource = (source) => {
    setDraft((d) => {
      if (source === "template") {
        const t = templates.find((x) => x.id === d.templateId) || templates[0] || null;
        const space = d.spaceId ? ctx.spaceById.get(d.spaceId) : null;
        return {
          ...d,
          source,
          templateId: t?.id ?? null,
          name: d.name || t?.name || "",
          setupStyle: t?.setupStyle || d.setupStyle,
          ...(t ? { widthM: t.widthM, lengthM: t.lengthM, unit: t.unit } : {}),
          ...spaceDims(space),
        };
      }
      return { ...d, source };
    });
  };

  const pickTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    setDraft((d) => {
      const space = d.spaceId ? ctx.spaceById.get(d.spaceId) : null;
      return {
        ...d,
        templateId: id,
        name: d.name || t?.name || "",
        setupStyle: t?.setupStyle || d.setupStyle,
        ...(t ? { widthM: t.widthM, lengthM: t.lengthM, unit: t.unit } : {}),
        ...spaceDims(space),
      };
    });
  };

  const pickSpace = ({ venueId, spaceId, space }) =>
    setDraft((d) => ({ ...d, venueId, spaceId, ...spaceDims(space) }));

  const needsSpace = requireSpace || draft.source === "space";

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give it a name first.");
      return;
    }
    if (needsSpace && !draft.spaceId) {
      toast.error("Pick the venue space this is for.");
      return;
    }
    if (draft.source === "template" && !sourcePlan) {
      toast.error("Pick a template to start from.");
      return;
    }
    if (requireEvent && !draft.eventId) {
      toast.error("Pick the event this plan is for.");
      return;
    }
    if (!(draft.widthM >= MIN_ROOM_M) || !(draft.lengthM >= MIN_ROOM_M)) {
      toast.error("The room needs a width and length.");
      return;
    }
    setBusy(true);
    const ok = await onCreate({
      name: draft.name.trim(),
      sourcePlan,
      venueId: draft.venueId,
      venueSpaceId: draft.spaceId,
      eventId: draft.eventId,
      widthM: draft.widthM,
      lengthM: draft.lengthM,
      unit: draft.unit,
      setupStyle: draft.setupStyle,
      templateCategory: draft.templateCategory,
      outsideCount,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const tabs = SOURCE_TABS.filter(
    (t) => (t.value !== "template" || templates.length) && (t.value !== "space" || kind !== "template"),
  );
  const sourceStats = sourcePlan ? planSummary(sourcePlan) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Name">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder={
                kind === "template"
                  ? "e.g. Gala dinner — 20 rounds"
                  : kind === "expo"
                    ? "e.g. Hall A — main expo floor"
                    : "e.g. Awards dinner layout"
              }
            />
          </Field>

          {fixedSource ? (
            <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-sm">
              <span className="text-text-secondary">Copying </span>
              <span className="font-medium text-foreground">{sourcePlan?.name || "diagram"}</span>
              {sourceStats ? (
                <span className="text-text-secondary">
                  {" "}· {sourceStats.objectCount} objects · {sourceStats.seats} seats ·{" "}
                  {setupStyleLabel(sourcePlan.setupStyle)}
                </span>
              ) : null}
            </div>
          ) : (
            <Field label="Start from">
              <SegmentedTabs tabs={tabs} value={draft.source} onChange={pickSource} fullWidth />
            </Field>
          )}

          {draft.source === "template" ? (
            <Field label="Template">
              <Select value={draft.templateId || undefined} onValueChange={pickTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      <span className="text-text-tertiary">
                        {" "}· {formatDimensions(t.widthM, t.lengthM, t.unit)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {kind !== "template" ? (
            <SpacePicker
              ctx={ctx}
              projectId={projectId}
              venueId={draft.venueId}
              spaceId={draft.spaceId}
              onChange={pickSpace}
              requireSpace={needsSpace}
            />
          ) : null}

          <div className="flex items-end gap-3">
            <Field label="Room width" className="flex-1">
              <LengthInput metres={draft.widthM} unit={draft.unit} onChange={set("widthM")} min={MIN_ROOM_M} />
            </Field>
            <Field label="Room length" className="flex-1">
              <LengthInput metres={draft.lengthM} unit={draft.unit} onChange={set("lengthM")} min={MIN_ROOM_M} />
            </Field>
            <UnitToggle value={draft.unit} onChange={set("unit")} className="mb-1" />
          </div>

          {kind === "expo" ? null : (
          <div className={kind !== "library" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
            <Field label="Setup style">
              <SetupStyleSelect value={draft.setupStyle} onChange={set("setupStyle")} />
            </Field>
            {kind === "template" ? (
              <Field label="Category">
                <Select value={draft.templateCategory} onValueChange={set("templateCategory")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([...TEMPLATE_CATEGORIES, draft.templateCategory].filter(Boolean))].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {kind === "plan" ? (
              <Field label={requireEvent ? "Event" : "Event (optional)"}>
                <EventSelect
                  events={ctx.events}
                  value={draft.eventId}
                  onChange={set("eventId")}
                  allowNone={!requireEvent}
                />
              </Field>
            ) : null}
          </div>
          )}

          {sourcePlan && outsideCount > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Objects keep their positions — {outsideCount} would fall outside this room and are flagged in the
              editor.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
