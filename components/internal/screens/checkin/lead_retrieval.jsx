"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Contact, Loader2, Download } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listLeadsByProject } from "@/lib/supabase/checkin";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { formatDate } from "./constants";

export function LeadRetrievalScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), listLeadsByProject(projectId)]).then(
      ([evts, lds]) => {
        if (!alive) return;
        setEvents(evts ?? []);
        setLeads(lds ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventName = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e.name;
    return m;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (eventFilter !== "all" && l.eventId !== eventFilter) return false;
      if (!q) return true;
      return (
        l.attendeeName.toLowerCase().includes(q) ||
        (l.contact.company || "").toLowerCase().includes(q) ||
        (l.contact.email || "").toLowerCase().includes(q)
      );
    });
  }, [leads, eventFilter, search]);

  const stats = useMemo(() => {
    const exhibitors = new Set(leads.map((l) => l.exhibitor).filter(Boolean));
    return [
      { label: "Leads captured", value: leads.length.toLocaleString(), footer: "Across all events" },
      { label: "Exhibitors", value: String(exhibitors.size), footer: "Collecting leads" },
      { label: "Showing", value: filtered.length.toLocaleString(), footer: "In current view" },
    ];
  }, [leads, filtered]);

  const exportCsv = () => {
    if (!filtered.length) {
      toast.error("No leads to export.");
      return;
    }
    downloadCsv(
      [
        { header: "name", value: (l) => l.attendeeName },
        { header: "company", value: (l) => l.contact.company || "" },
        { header: "title", value: (l) => l.contact.title || "" },
        { header: "email", value: (l) => l.contact.email || "" },
        { header: "phone", value: (l) => l.contact.phone || "" },
        { header: "exhibitor", value: (l) => l.exhibitor || "" },
        { header: "event", value: (l) => eventName[l.eventId] || "" },
        { header: "notes", value: (l) => l.contact.notes || "" },
      ],
      filtered,
      "lead-retrieval.csv",
    );
    toast.success(`Exported ${filtered.length} leads.`);
  };

  const columns = [
    {
      key: "name",
      header: "Attendee",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{l.attendeeName || "Unnamed"}</p>
          <p className="truncate text-xs text-text-secondary">{l.contact.email || "No email"}</p>
        </div>
      ),
    },
    { key: "company", header: "Company", render: (l) => l.contact.company || "—" },
    { key: "exhibitor", header: "Captured by", render: (l) => l.exhibitor || "—" },
    { key: "event", header: "Event", render: (l) => eventName[l.eventId] || "—" },
    {
      key: "captured",
      header: "When",
      align: "right",
      render: (l) => <span className="text-xs text-text-secondary">{formatDate(l.capturedAt)}</span>,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Lead Retrieval"
        description="Contacts your exhibitors and sponsors collected by scanning attendee badges — ready to hand off for follow-up."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="h-9 w-full bg-surface-card sm:max-w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, company, email…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(l) => l.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Contact}
                title={leads.length ? "No leads match" : "No leads captured yet"}
                description={
                  leads.length
                    ? "Try a different filter or search."
                    : "When exhibitors scan attendee badges at your events, their captured contacts appear here to export."
                }
              />
            </div>
          }
        />
      )}
    </MainScreenWrapper>
  );
}

export default LeadRetrievalScreen;
