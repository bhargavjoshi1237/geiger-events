"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  FileArchive,
  IdCard,
  Image as ImageIcon,
  Layers2,
  Loader2,
  Printer,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { getCheckinSettings, updateCheckinSettings } from "@/lib/supabase/checkin";
import { LanyardBadge } from "@/components/internal/shared/lanyard/lanyard_badge";
import { SAMPLE_ATTENDEE, listPassAttendees, tiersOf } from "@/lib/passes/attendees";
import { rolesOf } from "@/lib/passes/roles";
import { resolveTemplate } from "@/lib/passes/render";
import { sheetGrid } from "@/lib/passes/stock";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";

import { hasBackContent, sideLayout, withSides } from "@/lib/passes/layout";
import { uploadBadgeImage } from "@/lib/supabase/storage";

import { newPassTemplate, withDefaults } from "./constants";
import { TemplatePicker } from "./badge/template_picker";
import { LayersPanel } from "./badge/layers_panel";
import { Inspector } from "./badge/inspector";
import { PassCanvas } from "./badge/canvas";
import { printPasses } from "./badge/print";
import { exportPassPng, exportPassesZip } from "./badge/export";

const isUpcoming = (e) =>
  !e.date || new Date(e.date) >= new Date(new Date().toDateString());

export function BadgePrintingScreen() {
  const { projectId } = useProject();
  // An event still in the URL means another screen handed off to this one (the
  // event editor's Badge Printing section) — open on that event's passes.
  const { eventId: handedOffEventId } = useWorkspaceUrl();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [previewKey, setPreviewKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  const [slice, setSlice] = useState(() => withDefaults({}, "badge"));
  const [saved, setSaved] = useState(() => withDefaults({}, "badge"));
  const [qrSettings, setQrSettings] = useState(() => withDefaults({}, "qrTickets"));
  const [selectedId, setSelectedId] = useState("");
  const [elementId, setElementId] = useState(null);
  // Which face is being designed. Lives here, not in the canvas, because the
  // layers rail and the inspector edit that side too.
  const [side, setSide] = useState("front");

  // Events + the project's saved designs load together; both are needed before
  // anything can render.
  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), getCheckinSettings(projectId)]).then(
      ([rows, settings]) => {
        if (!alive) return;
        const upcoming = (rows ?? []).filter(isUpcoming);
        setEvents(upcoming);
        // The handed-off event only wins if it's one this screen can show; a
        // past event isn't in the list and would leave the picker blank.
        const handedOff = upcoming.some((e) => e.id === handedOffEventId)
          ? handedOffEventId
          : "";
        setEventId((cur) => cur || handedOff || upcoming[0]?.id || "");

        const config = settings?.config || {};
        const merged = withDefaults(config, "badge");
        // A project with no saved designs starts on one seeded from the legacy
        // preset. It's seeded into `saved` too, so an untouched screen is clean.
        // Designs saved before the free-layout editor carry only field toggles;
        // withSides converts them to positioned elements that draw the same, and
        // gives every design the blank back it didn't have.
        const templates = (
          Array.isArray(merged.templates) && merged.templates.length
            ? merged.templates
            : [newPassTemplate(merged.defaultTemplate || "classic", { isDefault: true })]
        ).map(withSides);
        const next = { ...merged, templates };
        setSlice(next);
        setSaved(next);
        setSelectedId(templates.find((t) => t.isDefault)?.id || templates[0].id);
        setQrSettings(withDefaults(config, "qrTickets"));
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, handedOffEventId]);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const load = async () => {
      setLoadingList(true);
      const rows = await listPassAttendees(eventId, projectId);
      if (!alive) return;
      setAttendees(rows ?? []);
      setPreviewKey(rows?.[0]?.key || "");
      setLoadingList(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [eventId, projectId]);

  const templates = useMemo(() => slice.templates || [], [slice.templates]);
  const event = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId]);
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || templates[0] || null,
    [templates, selectedId],
  );
  const availableTiers = useMemo(() => tiersOf(attendees), [attendees]);
  const availableRoles = useMemo(() => rolesOf(attendees), [attendees]);
  const previewIndex = useMemo(
    () => attendees.findIndex((a) => a.key === previewKey),
    [attendees, previewKey],
  );
  const previewAttendee = useMemo(
    () => attendees[previewIndex] || attendees[0] || SAMPLE_ATTENDEE,
    [attendees, previewIndex],
  );

  // How many passes each template is responsible for — shown on the chips so a
  // tier binding that matches nobody is obvious.
  const counts = useMemo(() => {
    const out = {};
    for (const attendee of attendees) {
      const template = resolveTemplate(templates, attendee.tier, attendee.role);
      if (template) out[template.id] = (out[template.id] || 0) + 1;
    }
    return out;
  }, [attendees, templates]);

  const dirty = useMemo(() => JSON.stringify(slice) !== JSON.stringify(saved), [slice, saved]);

  const setTemplates = (next) => setSlice((s) => ({ ...s, templates: next }));

  const updateTemplate = (patch) =>
    setTemplates(templates.map((t) => (t.id === selected?.id ? { ...t, ...patch } : t)));

  // Write a patched layout back onto the face currently being designed. The
  // front stays `template.layout` so designs saved before the back existed are
  // untouched; the back lives under `template.back`.
  const putLayout = useCallback(
    (template, next) =>
      side === "back"
        ? { ...template, back: { ...(template.back || {}), layout: next } }
        : { ...template, layout: next },
    [side],
  );

  // Layout edits merge into the open design; every element lives in its layout,
  // so the canvas, the layers rail and the inspector all write through here.
  const updateLayout = useCallback(
    (patch) =>
      setSlice((s) => ({
        ...s,
        templates: (s.templates || []).map((t) =>
          t.id === (selected?.id || "")
            ? putLayout(t, { ...sideLayout(t, side), ...patch })
            : t,
        ),
      })),
    [selected?.id, side, putLayout],
  );

  const element = useMemo(
    () => (sideLayout(selected, side).elements || []).find((el) => el.id === elementId) || null,
    [selected, side, elementId],
  );

  const updateElement = useCallback(
    (patch) =>
      setSlice((s) => ({
        ...s,
        templates: (s.templates || []).map((t) => {
          if (t.id !== (selected?.id || "")) return t;
          const layout = sideLayout(t, side);
          return putLayout(t, {
            ...layout,
            elements: (layout.elements || []).map((el) =>
              el.id === elementId ? { ...el, ...patch } : el,
            ),
          });
        }),
      })),
    [selected?.id, side, elementId, putLayout],
  );

  const deleteElement = (id) => {
    updateLayout({
      elements: (sideLayout(selected, side).elements || []).filter((el) => el.id !== id),
    });
    if (elementId === id) setElementId(null);
  };

  // Selection belongs to a face, so turning the card over clears it.
  const changeSide = (next) => {
    if (next === side) return;
    setSide(next);
    setElementId(null);
  };

  // Card artwork lands in storage under badges/<project>/ and the design stores
  // the public URL, so print and export read the same file.
  const uploadImage = async (file) => {
    const result = await uploadBadgeImage(projectId, file);
    if (!result?.url) {
      toast.error("Couldn't upload that image.");
      return null;
    }
    return result.url;
  };

  const addTemplate = (preset) => {
    const created = withSides(newPassTemplate(preset, { isDefault: templates.length === 0 }));
    setTemplates([...templates, created]);
    setSelectedId(created.id);
    setElementId(null);
    setSide("front");
  };

  const duplicateTemplate = (id) => {
    const source = templates.find((t) => t.id === id);
    if (!source) return;
    const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copy`, isDefault: false };
    setTemplates([...templates, copy]);
    setSelectedId(copy.id);
  };

  const setDefaultTemplate = (id) =>
    setTemplates(templates.map((t) => ({ ...t, isDefault: t.id === id })));

  const deleteTemplate = (id) => {
    if (templates.length === 1) return;
    const next = templates.filter((t) => t.id !== id);
    // Something must stay the fallback for unmatched tiers.
    if (!next.some((t) => t.isDefault)) next[0] = { ...next[0], isDefault: true };
    setTemplates(next);
    if (selectedId === id) setSelectedId(next[0].id);
  };

  // Paging the canvas steps through the real attendee list, wrapping at both
  // ends so a long list stays reachable from either direction.
  const stepPreview = (delta) => {
    if (!attendees.length) return;
    const from = previewIndex < 0 ? 0 : previewIndex;
    const next = (from + delta + attendees.length) % attendees.length;
    setPreviewKey(attendees[next].key);
  };

  const save = async () => {
    setSaving(true);
    const previous = saved;
    setSaved(slice);
    const res = await updateCheckinSettings(projectId, { badge: slice });
    setSaving(false);
    if (res === false) {
      setSaved(previous);
      toast.error("Couldn't save your designs.");
      return;
    }
    toast.success("Designs saved.");
  };

  const handlePrint = () => {
    if (!event || !attendees.length) {
      toast.error("No passes to print for this event.");
      return;
    }
    const error = printPasses({ templates, event, attendees, qrSettings });
    if (error) toast.error(error);
    else toast.success(`Prepared ${attendees.length} passes.`);
  };

  const handlePng = async (sides) => {
    if (!selected) return;
    setBusy("png");
    const warning = await exportPassPng({
      template: selected,
      event: event || {},
      attendee: previewAttendee,
      qrSettings,
      sides,
    });
    setBusy("");
    if (warning) toast.error(warning);
    else toast.success(sides.length > 1 ? "Both sides downloaded." : "PNG downloaded.");
  };

  const handleZip = async () => {
    if (!attendees.length) {
      toast.error("No passes to export.");
      return;
    }
    setBusy("zip");
    const warning = await exportPassesZip({
      templates,
      event: event || {},
      attendees,
      qrSettings,
      onProgress: (done, total) => setBusy(`zip:${done}/${total}`),
    });
    setBusy("");
    if (warning) toast.error(warning);
    else toast.success(`${attendees.length} PNGs zipped.`);
  };

  const exportCsv = () => {
    if (!attendees.length) {
      toast.error("No passes to export.");
      return;
    }
    downloadCsv(
      [
        { header: "name", value: (a) => a.name },
        { header: "company", value: (a) => a.company || "" },
        { header: "role", value: (a) => a.role || "" },
        { header: "tier", value: (a) => a.tier || "" },
        { header: "seat", value: (a) => a.seatLabel || "" },
        { header: "ticket_code", value: (a) => a.code },
        { header: "email", value: (a) => a.email || "" },
        { header: "source", value: (a) => a.source },
      ],
      attendees,
      "pass-data.csv",
    );
    toast.success("Pass data exported.");
  };

  const header = (
    <ScreenHeader
      className="shrink-0"
      title="Badge Printing"
      description="Design event passes, bind them to ticket tiers, and print or export them for every attendee."
    />
  );

  if (loading) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading designs…
        </div>
      </MainScreenWrapper>
    );
  }

  if (!events.length) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={IdCard}
            title="No upcoming events"
            description="Create an upcoming event to design and print its attendee passes."
          />
        </div>
      </MainScreenWrapper>
    );
  }

  const grid = selected ? sheetGrid(selected.sheet, selected.stock) : null;
  const zipping = busy.startsWith("zip");
  const passCount = attendees.length;
  const backUsed = hasBackContent(selected);
  const meta = [
    loadingList ? "Loading Passes…" : `${passCount} Pass${passCount === 1 ? "" : "es"}`,
    `${templates.length} Design${templates.length === 1 ? "" : "s"}`,
    backUsed ? "Double-sided" : null,
    grid ? `${grid.perPage} Per ${grid.page.wMm > 214 ? "Letter" : "A4"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const stepperLabel = attendees.length
    ? [previewAttendee.name, previewAttendee.role, previewAttendee.seatLabel]
        .filter(Boolean)
        .join(" · ")
    : "Sample attendee — nobody has registered yet";

  return (
    <MainScreenWrapper className="flex h-full flex-col space-y-4 py-0">
      {header}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Toolbar: what we're designing, for which event, and what to do with it. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-[220px] bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TemplatePicker
            templates={templates}
            selectedId={selected?.id || ""}
            counts={counts}
            onSelect={(id) => {
              setSelectedId(id);
              setElementId(null);
              setSide("front");
            }}
            onAdd={addTemplate}
            onDuplicate={duplicateTemplate}
            onSetDefault={setDefaultTemplate}
            onDelete={deleteTemplate}
          />

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-text-tertiary lg:inline">{meta}</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {zipping && busy.includes("/") ? busy.split(":")[1] : "Export"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border bg-surface-subtle shadow-xl">
                <DropdownMenuItem onClick={() => handlePng([side])}>
                  <ImageIcon className="h-4 w-4" />
                  PNG of this {side === "back" ? "back" : "front"}
                </DropdownMenuItem>
                {backUsed ? (
                  <DropdownMenuItem onClick={() => handlePng(["front", "back"])}>
                    <Layers2 className="h-4 w-4" /> PNG of both sides
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={handleZip}>
                  <FileArchive className="h-4 w-4" /> ZIP of all passes
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-surface-strong" />
                <DropdownMenuItem onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Pass data (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>

            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Three separate surfaces: fields rail · draggable canvas · inspector rail. */}
        <div className="flex min-h-0 flex-1 gap-3">
          {/* The design as it will actually be worn, over the layers rail. It
              tracks whatever is being edited, so a change on the canvas lands on
              the hanging card a moment later. */}
          <aside className="hidden w-1/5 shrink-0 flex-col gap-3 md:flex">
            <div className="shrink-0 overflow-hidden rounded-xl border border-border bg-surface-subtle">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium text-foreground">Worn preview</p>
                <span className="text-[11px] text-text-tertiary">Drag to swing</span>
              </div>
              <LanyardBadge
                template={selected}
                event={event || {}}
                attendee={previewAttendee}
                qrSettings={qrSettings}
                height={300}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-subtle">
              {selected ? (
                <LayersPanel
                  template={selected}
                  side={side}
                  selectedId={elementId}
                  onSelect={setElementId}
                  onChange={updateLayout}
                />
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
            <PassCanvas
              template={selected}
              event={event || {}}
              attendee={previewAttendee}
              qrSettings={qrSettings}
              grid={grid}
              passCount={passCount}
              stepperLabel={stepperLabel}
              canStep={attendees.length > 1}
              onPrev={() => stepPreview(-1)}
              onNext={() => stepPreview(1)}
              side={side}
              onSideChange={changeSide}
              selectedId={elementId}
              onSelect={setElementId}
              onLayoutChange={updateLayout}
            />
          </div>

          <aside className="hidden w-1/5 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-subtle lg:block">
            {selected ? (
              <Inspector
                template={selected}
                element={element}
                side={side}
                availableTiers={availableTiers}
                availableRoles={availableRoles}
                qrSettings={qrSettings}
                onChange={updateTemplate}
                onLayoutChange={updateLayout}
                onElementChange={updateElement}
                onElementDelete={deleteElement}
                onUpload={uploadImage}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export default BadgePrintingScreen;
