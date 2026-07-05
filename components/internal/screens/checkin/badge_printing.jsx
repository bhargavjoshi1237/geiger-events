"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Loader2, Download, IdCard } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { BADGE_TEMPLATES, defaultBadge, formatDate } from "./constants";

const ticketCode = (id) => String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
const isUpcoming = (e) => !e.date || new Date(e.date) >= new Date(new Date().toDateString());
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// One badge as inline-styled HTML (used for both the live preview and the print
// sheet, so what you see is what prints).
function badgeHtml(design, ev, att) {
  const accent = design.accent || "#6366f1";
  const rows = [];
  if (design.fields.name) rows.push(`<div style="font-size:20px;font-weight:700;color:#111">${esc(att.name || "Attendee")}</div>`);
  if (design.fields.company) rows.push(`<div style="font-size:13px;color:#555;margin-top:2px">${esc(att.company || ev.name)}</div>`);
  if (design.fields.ticket) rows.push(`<div style="font-family:monospace;font-size:12px;color:#888;margin-top:6px">${esc(ticketCode(att.id))}</div>`);
  const qr = design.fields.qr
    ? `<div style="width:56px;height:56px;border-radius:6px;background:#111;margin-top:10px"></div>`
    : "";
  return `
    <div style="width:240px;height:150px;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:#fff;font-family:system-ui,sans-serif">
      <div style="height:8px;background:${accent}"></div>
      <div style="padding:14px;flex:1;display:flex;flex-direction:column;justify-content:center">
        ${design.showLogo ? `<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:8px">${esc(ev.name)}</div>` : ""}
        ${rows.join("")}
        ${qr}
      </div>
    </div>`;
}

function BadgePreview({ design, ev, att }) {
  return (
    <div
      className="mx-auto"
      dangerouslySetInnerHTML={{ __html: badgeHtml(design, ev, att) }}
    />
  );
}

export function BadgePrintingScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [design, setDesign] = useState(() => ({
    template: "classic",
    accent: "#6366f1",
    showLogo: true,
    fields: { name: true, company: true, ticket: true, qr: true },
    ...defaultBadge(),
  }));

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      const upcoming = (rows ?? []).filter(isUpcoming);
      setEvents(upcoming);
      setEventId((cur) => cur || upcoming[0]?.id || "");
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const load = async () => {
      setLoadingList(true);
      const rows = await listRegistrationsByEvent(eventId);
      if (!alive) return;
      setAttendees(rows ?? []);
      setLoadingList(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [eventId]);

  const ev = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId]);
  const sample = attendees[0] || { id: "sample-0000", name: "Alex Morgan", company: "" };
  const setField = (key, v) => setDesign((d) => ({ ...d, fields: { ...d.fields, [key]: v } }));

  const applyTemplate = (t) => {
    const presets = {
      classic: { showLogo: true, fields: { name: true, company: true, ticket: true, qr: true } },
      compact: { showLogo: false, fields: { name: true, company: false, ticket: true, qr: false } },
      qr: { showLogo: true, fields: { name: true, company: false, ticket: true, qr: true } },
      vip: { showLogo: true, fields: { name: true, company: true, ticket: false, qr: true } },
    };
    setDesign((d) => ({ ...d, template: t, ...(presets[t] || {}) }));
  };

  const printSheet = () => {
    if (!ev || !attendees.length) {
      toast.error("No attendees to print for this event.");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to open the print sheet.");
      return;
    }
    const badges = attendees.map((a) => badgeHtml(design, ev, a)).join("");
    win.document.write(`<!doctype html><html><head><title>${esc(ev.name)} — badges</title>
      <style>@page{margin:12mm}body{margin:0}.grid{display:flex;flex-wrap:wrap;gap:12px;padding:12px}</style>
      </head><body><div class="grid">${badges}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
    toast.success(`Prepared ${attendees.length} badges.`);
  };

  const exportCsv = () => {
    if (!attendees.length) {
      toast.error("No attendees to export.");
      return;
    }
    downloadCsv(
      [
        { header: "name", value: (a) => a.name },
        { header: "company", value: (a) => a.company || "" },
        { header: "ticket_code", value: (a) => ticketCode(a.id) },
        { header: "email", value: (a) => a.email },
      ],
      attendees,
      "badge-data.csv",
    );
    toast.success("Badge data exported.");
  };

  if (loading) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Badge Printing" description="Design and print attendee badges for your upcoming events." />
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      </MainScreenWrapper>
    );
  }

  if (!events.length) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Badge Printing" description="Design and print attendee badges for your upcoming events." />
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={IdCard}
            title="No upcoming events"
            description="Create an upcoming event to design and print its attendee badges."
          />
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Badge Printing"
        description="Pick an upcoming event, choose a template, tweak the layout, and print badges for every attendee."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" /> Export data
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={printSheet}
            >
              <Printer className="h-4 w-4" /> Print / PDF
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
          {ev ? formatDate(ev.date) : ""} ·{" "}
          {loadingList ? "…" : `${attendees.length} attendee${attendees.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <SectionCard title="Template" description="Start from a preset, then fine-tune below.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BADGE_TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => applyTemplate(t.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    design.template === t.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-card hover:border-border-strong",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{t.desc}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Layout" description="What shows on each badge.">
            <SettingsList>
              <SettingRow title="Event name header" checked={design.showLogo} onCheckedChange={(v) => setDesign((d) => ({ ...d, showLogo: v }))} />
              <SettingRow title="Attendee name" checked={design.fields.name} onCheckedChange={(v) => setField("name", v)} />
              <SettingRow title="Company / role" checked={design.fields.company} onCheckedChange={(v) => setField("company", v)} />
              <SettingRow title="Ticket code" checked={design.fields.ticket} onCheckedChange={(v) => setField("ticket", v)} />
              <SettingRow title="QR code" checked={design.fields.qr} onCheckedChange={(v) => setField("qr", v)} />
            </SettingsList>
            <div className="mt-4 max-w-xs">
              <Field label="Accent color" hint="The band across the top of each badge.">
                <Input value={design.accent} onChange={(e) => setDesign((d) => ({ ...d, accent: e.target.value }))} placeholder="#6366f1" />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Preview">
            <div className="flex flex-col items-center gap-3 py-4">
              {ev ? <BadgePreview design={design} ev={ev} att={sample} /> : null}
              <p className="text-center text-xs text-text-secondary">
                Preview of {sample.name}. Print produces one per attendee.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export default BadgePrintingScreen;
