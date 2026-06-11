"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  LayoutTemplate,
  Layers,
  Plus,
  Music,
  Mic,
  GraduationCap,
  PartyPopper,
  Video,
  Users,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  Field,
  ScreenHeader,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_STATUS_MAP, formatDate } from "./sample_data";

// --- Templates ---------------------------------------------------------------

const TEMPLATES = [
  { id: "t1", name: "Meetup", description: "Talks + networking, free RSVP, one ticket type.", category: "Community", uses: 42, icon: Users },
  { id: "t2", name: "Concert / Gig", description: "Paid tickets, tiers, door sales, capacity cap.", category: "Music", uses: 28, icon: Music },
  { id: "t3", name: "Workshop", description: "Limited seats, custom questions, materials add-on.", category: "Education", uses: 35, icon: GraduationCap },
  { id: "t4", name: "Webinar", description: "Online, registration form, automated reminders.", category: "Online", uses: 51, icon: Video },
  { id: "t5", name: "Conference Talk", description: "Multi-session agenda, speakers, sponsor slots.", category: "Conference", uses: 17, icon: Mic },
  { id: "t6", name: "Party", description: "Guest list, plus-ones, who's going, photo album.", category: "Social", uses: 23, icon: PartyPopper },
];

const TEMPLATE_CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "Community", label: "Community" },
  { value: "Music", label: "Music" },
  { value: "Education", label: "Education" },
  { value: "Online", label: "Online" },
  { value: "Conference", label: "Conference" },
  { value: "Social", label: "Social" },
];

export function TemplatesScreen() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);

  const filtered = TEMPLATES.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Templates"
        description="Reusable event setups — page layout, ticket types, questions, and reminders — so you launch a new event in minutes."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates…"
          className="w-full sm:max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              className="group flex flex-col rounded-xl border border-border bg-surface-subtle p-5 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="neutral">{t.category}</Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {t.name}
              </h3>
              <p className="mt-1 flex-1 text-sm text-text-secondary">
                {t.description}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-tertiary">
                  Used by {t.uses} events
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => toast.success(`Creating event from "${t.name}"…`)}
                >
                  Use <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              Save a starting point you can reuse for future events.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Template name">
              <Input placeholder="e.g. Monthly Community Meetup" />
            </Field>
            <Field label="Category">
              <Select defaultValue="Community">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.slice(1).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea rows={2} placeholder="What's included in this template?" />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setOpen(false);
                toast.success("Template saved.");
              }}
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

// --- Event Series ------------------------------------------------------------

const SERIES = [
  { id: "s1", name: "First Friday Meetup", cadence: "Monthly", events: 11, nextDate: "2026-07-03", status: "On sale" },
  { id: "s2", name: "Lunch & Learn", cadence: "Weekly", events: 24, nextDate: "2026-06-13", status: "On sale" },
  { id: "s3", name: "Quarterly Town Hall", cadence: "Quarterly", events: 4, nextDate: "2026-09-01", status: "Scheduled" },
  { id: "s4", name: "Summer Concert Run", cadence: "Custom", events: 6, nextDate: "2026-06-21", status: "Draft" },
];

export function EventSeriesScreen() {
  const [open, setOpen] = useState(false);

  const columns = [
    {
      key: "name",
      header: "Series",
      render: (s) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{s.name}</span>
          <span className="text-xs text-text-secondary">{s.events} events</span>
        </div>
      ),
    },
    { key: "cadence", header: "Cadence", render: (s) => <Badge variant="neutral">{s.cadence}</Badge> },
    {
      key: "next",
      header: "Next event",
      render: (s) => (
        <span className="text-sm text-muted-foreground">{formatDate(s.nextDate)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusPill status={s.status} map={EVENT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: () => (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          Manage <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Event Series"
        description="Group related events under one series. Attendees can follow the whole run, and you manage shared settings in one place."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> New series
          </Button>
        }
      />

      <DataTable columns={columns} data={SERIES} getRowKey={(s) => s.id} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event series</DialogTitle>
            <DialogDescription>
              Bundle recurring or themed events so attendees can follow them
              together.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Series name">
              <Input placeholder="e.g. First Friday Meetup" />
            </Field>
            <Field label="Cadence">
              <Select defaultValue="Monthly">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setOpen(false);
                toast.success("Series created.");
              }}
            >
              Create series
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}
