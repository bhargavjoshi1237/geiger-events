"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  FileArchive,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Printer,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SectionCard,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getCheckinSettings, updateCheckinSettings } from "@/lib/supabase/checkin";
import { listPassAttendees, tiersOf } from "@/lib/passes/attendees";
import { resolveTemplate } from "@/lib/passes/render";
import { sheetGrid } from "@/lib/passes/stock";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";

import { formatDate, newPassTemplate, withDefaults } from "./constants";
import { TemplateList } from "./badge/template_list";
import { DesignForm } from "./badge/design_form";
import { PassPreview } from "./badge/preview";
import { printPasses } from "./badge/print";
import { exportPassPng, exportPassesZip } from "./badge/export";

const isUpcoming = (e) =>
  !e.date || new Date(e.date) >= new Date(new Date().toDateString());

// Stands in for a real attendee so the designer is usable before anyone has
// registered. The payload is deliberately not a real id.
const SAMPLE = {
  key: "sample",
  name: "Alex Morgan",
  company: "Northwind Studio",
  tier: "",
  code: "A1B2C3D4",
  payload: "sample-pass-preview",
  seat: 1,
  of: 1,
};

export function BadgePrintingScreen() {
  const { projectId } = useProject();
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

  // Events + the project's saved designs load together; both are needed before
  // anything can render.
  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), getCheckinSettings(projectId)]).then(
      ([rows, settings]) => {
        if (!alive) return;
        const upcoming = (rows ?? []).filter(isUpcoming);
        setEvents(upcoming);
        setEventId((cur) => cur || upcoming[0]?.id || "");

        const config = settings?.config || {};
        const merged = withDefaults(config, "badge");
        // A project with no saved designs starts on one seeded from the legacy
        // preset. It's seeded into `saved` too, so an untouched screen is clean.
        const templates =
          Array.isArray(merged.templates) && merged.templates.length
            ? merged.templates
            : [newPassTemplate(merged.defaultTemplate || "classic", { isDefault: true })];
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
  }, [projectId]);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const load = async () => {
      setLoadingList(true);
      const rows = await listPassAttendees(eventId);
      if (!alive) return;
      setAttendees(rows ?? []);
      setPreviewKey(rows?.[0]?.key || "");
      setLoadingList(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [eventId]);

  const templates = useMemo(() => slice.templates || [], [slice.templates]);
  const event = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId]);
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || templates[0] || null,
    [templates, selectedId],
  );
  const availableTiers = useMemo(() => tiersOf(attendees), [attendees]);
  const previewAttendee = useMemo(
    () => attendees.find((a) => a.key === previewKey) || attendees[0] || SAMPLE,
    [attendees, previewKey],
  );

  // How many passes each template is responsible for — shown on the rail so a
  // tier binding that matches nobody is obvious.
  const counts = useMemo(() => {
    const out = {};
    for (const attendee of attendees) {
      const template = resolveTemplate(templates, attendee.tier);
      if (template) out[template.id] = (out[template.id] || 0) + 1;
    }
    return out;
  }, [attendees, templates]);

  const dirty = useMemo(() => JSON.stringify(slice) !== JSON.stringify(saved), [slice, saved]);

  const setTemplates = (next) => setSlice((s) => ({ ...s, templates: next }));

  const updateTemplate = (patch) =>
    setTemplates(templates.map((t) => (t.id === selected?.id ? { ...t, ...patch } : t)));

  const addTemplate = (preset) => {
    const created = newPassTemplate(preset, { isDefault: templates.length === 0 });
    setTemplates([...templates, created]);
    setSelectedId(created.id);
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

  const handlePng = async () => {
    if (!selected) return;
    setBusy("png");
    const warning = await exportPassPng({
      template: selected,
      event: event || {},
      attendee: previewAttendee,
      qrSettings,
    });
    setBusy("");
    if (warning) toast.error(warning);
    else toast.success("PNG downloaded.");
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

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Badge Printing"
        description="Design event passes, bind them to ticket tiers, and print or export them for every attendee."
        actions={
          <div className="flex items-center gap-2">
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
                <DropdownMenuItem onClick={handlePng}>
                  <ImageIcon className="h-4 w-4" /> PNG of this pass
                </DropdownMenuItem>
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
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="h-9 w-full bg-surface-card sm:max-w-xs">
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
        <p className="text-sm text-text-secondary">
          {event ? formatDate(event.date) : ""}
          {" · "}
          {loadingList
            ? "loading passes…"
            : `${attendees.length} pass${attendees.length === 1 ? "" : "es"}`}
        </p>
      </div>

      <StatsBar
        className="mb-6"
        stats={[
          { label: "Passes", value: String(attendees.length) },
          { label: "Templates", value: String(templates.length) },
          { label: "Per page", value: grid ? String(grid.perPage) : "—" },
          { label: "Tiers", value: String(availableTiers.length) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <TemplateList
            templates={templates}
            selectedId={selected?.id || ""}
            counts={counts}
            onSelect={setSelectedId}
            onAdd={addTemplate}
            onDuplicate={duplicateTemplate}
            onSetDefault={setDefaultTemplate}
            onDelete={deleteTemplate}
          />
        </div>

        <div className="lg:col-span-5">
          {selected ? (
            <DesignForm
              template={selected}
              availableTiers={availableTiers}
              qrSettings={qrSettings}
              onChange={updateTemplate}
            />
          ) : null}
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <SectionCard title="Preview" description="Exactly what prints and exports.">
              {selected ? (
                <PassPreview
                  template={selected}
                  event={event || {}}
                  attendee={previewAttendee}
                  qrSettings={qrSettings}
                />
              ) : null}

              <div className="mt-4">
                <Select
                  value={previewKey || SAMPLE.key}
                  onValueChange={setPreviewKey}
                  disabled={!attendees.length}
                >
                  <SelectTrigger className="h-9 bg-surface-card">
                    <SelectValue placeholder="Sample attendee" />
                  </SelectTrigger>
                  <SelectContent>
                    {attendees.length ? (
                      attendees.slice(0, 100).map((a) => (
                        <SelectItem key={a.key} value={a.key}>
                          {a.name}
                          {a.tier ? ` · ${a.tier}` : ""}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={SAMPLE.key}>Sample attendee</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {attendees.length > 100 ? (
                  <p className="mt-2 text-xs text-text-tertiary">
                    Showing the first 100 of {attendees.length} for preview; all of them print.
                  </p>
                ) : null}
                {!attendees.length && !loadingList ? (
                  <p className="mt-2 text-xs text-text-tertiary">
                    Nobody has registered yet — this is a sample pass. Its QR is not a real code.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export default BadgePrintingScreen;
