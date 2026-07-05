"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Download, Loader2, Users } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { listAttendeeRows } from "@/lib/supabase/attendees";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import {
  EXPORT_SCOPE_OPTIONS,
  formatDate,
  todayISO,
} from "./constants";

// Exportable columns. `default` seeds the initial field selection.
const FIELDS = [
  { key: "name", header: "Name", value: (r) => r.name, default: true },
  { key: "email", header: "Email", value: (r) => r.email, default: true },
  { key: "phone", header: "Phone", value: (r) => r.phone, default: true },
  { key: "event", header: "Event", value: (r) => r.eventName, default: true },
  { key: "date", header: "Date", value: (r) => r.eventDate, default: true },
  { key: "time", header: "Time", value: (r) => r.eventTime, default: false },
  { key: "venue", header: "Venue", value: (r) => r.eventVenue, default: false },
  { key: "city", header: "City", value: (r) => r.eventCity, default: false },
  { key: "status", header: "Status", value: (r) => r.status, default: true },
  { key: "partySize", header: "Party size", value: (r) => r.partySize, default: false },
  { key: "dietary", header: "Dietary", value: (r) => r.dietary, default: false },
  { key: "accessibility", header: "Accessibility", value: (r) => r.accessibility, default: false },
  { key: "tags", header: "Tags", value: (r) => (r.tags || []).join("; "), default: false },
  { key: "company", header: "Company", value: (r) => r.company, default: false },
  { key: "title", header: "Title", value: (r) => r.title, default: false },
  { key: "location", header: "Location", value: (r) => r.location, default: false },
  { key: "registeredAt", header: "Registered", value: (r) => formatDate(r.registeredAt), default: false },
];

const PREVIEW_LIMIT = 8;

export function AttendeeExportScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("all");
  const [eventId, setEventId] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState(
    () => new Set(FIELDS.filter((f) => f.default).map((f) => f.key)),
  );
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listAttendeeRows(projectId).then((r) => {
      if (!alive) return;
      setRows(r ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventOptions = useMemo(() => {
    const seen = new Map();
    for (const r of rows)
      if (r.eventId && !seen.has(r.eventId)) seen.set(r.eventId, r.eventName);
    return Array.from(seen, ([value, label]) => ({ value, label: label || "Event" }));
  }, [rows]);

  const locationOptions = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      const loc = r.eventVenue || r.eventCity;
      if (loc) set.add(loc);
    }
    return Array.from(set).sort();
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    for (const r of rows) if (r.status) set.add(r.status);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const today = todayISO();
    return rows.filter((r) => {
      switch (scope) {
        case "today":
          return r.eventDate === today;
        case "upcoming":
          return r.eventDate && r.eventDate >= today;
        case "past":
          return r.eventDate && r.eventDate < today;
        case "event":
          return eventId ? r.eventId === eventId : true;
        case "location":
          return location ? (r.eventVenue || r.eventCity) === location : true;
        case "status":
          return status ? r.status === status : true;
        case "range":
          if (from && (!r.eventDate || r.eventDate < from)) return false;
          if (to && (!r.eventDate || r.eventDate > to)) return false;
          return true;
        default:
          return true;
      }
    });
  }, [rows, scope, eventId, location, status, from, to]);

  const activeFields = FIELDS.filter((f) => selected.has(f.key));

  const toggleField = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const scopeLabel =
    EXPORT_SCOPE_OPTIONS.find((o) => o.value === scope)?.label || "attendees";

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("Nothing matches this scope.");
      return;
    }
    if (!activeFields.length) {
      toast.error("Pick at least one field to export.");
      return;
    }
    const slug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadCsv(activeFields, filtered, `attendees-${slug}.csv`);
    toast.success(`Exported ${filtered.length} rows.`);
  };

  const handleCopyEmails = async () => {
    const emails = Array.from(
      new Set(filtered.map((r) => r.email).filter(Boolean)),
    );
    if (!emails.length) {
      toast.error("No emails in this scope.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join("\n"));
      toast.success(`Copied ${emails.length} emails.`);
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const previewColumns = activeFields.slice(0, 6).map((f) => ({
    key: f.key,
    header: f.header,
    render: (r) => (
      <span className="truncate text-sm text-foreground">
        {String(f.value(r) ?? "") || "—"}
      </span>
    ),
  }));

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Attendee Export"
        description="Build an attendee list any way you need it — today's events, a venue, a date range or a status — pick your columns, and export."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleCopyEmails}
            >
              <ClipboardCopy className="h-4 w-4" /> Copy emails
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendees…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-4">
            <SectionCard title="Scope">
              <div className="grid gap-4">
                <Field label="Include">
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPORT_SCOPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {scope === "event" ? (
                  <Field label="Event">
                    <Select value={eventId} onValueChange={setEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}

                {scope === "location" ? (
                  <Field label="Venue / location">
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}

                {scope === "status" ? (
                  <Field label="Status">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}

                {scope === "range" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From">
                      <Input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </Field>
                    <Field label="To">
                      <Input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Fields">
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <Checkbox
                      checked={selected.has(f.key)}
                      onCheckedChange={() => toggleField(f.key)}
                    />
                    {f.header}
                  </label>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Preview"
            action={
              <span className="text-sm text-text-secondary">
                {filtered.length.toLocaleString()}{" "}
                {filtered.length === 1 ? "row" : "rows"} ·{" "}
                {activeFields.length}{" "}
                {activeFields.length === 1 ? "column" : "columns"}
              </span>
            }
          >
            {filtered.length && activeFields.length ? (
              <>
                <DataTable
                  columns={previewColumns}
                  data={filtered.slice(0, PREVIEW_LIMIT)}
                  getRowKey={(r) => r.id}
                />
                {filtered.length > PREVIEW_LIMIT ? (
                  <p className="pt-3 text-center text-xs text-text-tertiary">
                    Showing {PREVIEW_LIMIT} of {filtered.length.toLocaleString()}{" "}
                    — export for the full list.
                  </p>
                ) : null}
                {activeFields.length > previewColumns.length ? (
                  <p className="pt-1 text-center text-xs text-text-tertiary">
                    +{activeFields.length - previewColumns.length} more columns in
                    the export.
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={Users}
                title={
                  activeFields.length
                    ? "No attendees in this scope"
                    : "Pick at least one field"
                }
                description={
                  activeFields.length
                    ? "Widen the scope or choose a different event, venue or date range."
                    : "Select the columns you want in the export."
                }
              />
            )}
          </SectionCard>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default AttendeeExportScreen;
