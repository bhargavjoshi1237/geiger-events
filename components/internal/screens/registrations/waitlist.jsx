"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Clock,
  Loader2,
  Settings2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SettingsList,
  SettingRow,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listEvents, updateEventMeta } from "@/lib/supabase/events";
import { listRegistrations, promoteWaitlist } from "@/lib/supabase/registrations";
import { useProject } from "@/context/project-context";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { countRegs, PipelineBar } from "./pipeline";
import { formatDate, formatDateTime, initials } from "./constants";

const PAGE_EVENTS = 60;
const PAGE_ROWS = 100;
const DEFAULT_RULES = { autoPromote: false, claimWindowHours: 24, notify: true };

// Sort options for the master list of events with a waitlist — mirrors the
// filter/sort toolbar the other list screens use.
const SORT_OPTIONS = [
  { value: "waiting-desc", label: "Most waiting" },
  { value: "waiting-asc", label: "Fewest waiting" },
  { value: "open-desc", label: "Most open spots" },
  { value: "date-asc", label: "Event date" },
  { value: "name-asc", label: "Name (A–Z)" },
];

function RulesDialog({ event, open, onOpenChange, onSaved }) {
  const [rules, setRules] = useState({
    ...DEFAULT_RULES,
    ...(event?.waitlistRules || {}),
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setRules((r) => ({ ...r, [key]: value }));

  const save = async () => {
    setSaving(true);
    const res = await updateEventMeta(event.id, { waitlistRules: rules });
    setSaving(false);
    if (res === false) {
      toast.error("Couldn't save the rules.");
      return;
    }
    toast.success("Auto-promotion rules saved.");
    onSaved(event.id, rules);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Auto-promotion rules</DialogTitle>
          <DialogDescription>
            How the waitlist for{" "}
            <span className="font-medium text-foreground">{event?.name}</span>{" "}
            promotes the next person when a spot opens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SettingsList>
            <SettingRow
              title="Auto-promote"
              description="Automatically promote the next person when a confirmed spot frees up."
              checked={rules.autoPromote}
              onCheckedChange={set("autoPromote")}
            />
            <SettingRow
              title="Notify on promotion"
              description="Email the promoted guest so they can claim their spot."
              checked={rules.notify}
              onCheckedChange={set("notify")}
            />
          </SettingsList>
          <Field
            label="Claim window (hours)"
            hint="How long a promoted guest has to confirm before the spot passes on."
          >
            <Input
              type="number"
              min={1}
              value={rules.claimWindowHours}
              onChange={(e) => set("claimWindowHours")(Number(e.target.value))}
              className="w-32"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WaitlistScreen() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rulesFor, setRulesFor] = useState(null);

  const [openEventId, setOpenEventId] = useState(null);
  const [listSearch, setListSearch] = useState("");
  const [listSort, setListSort] = useState("waiting-desc");
  const [listLimit, setListLimit] = useState(PAGE_EVENTS);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailLimit, setDetailLimit] = useState(PAGE_ROWS);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listRegistrations(projectId), listEvents(projectId)]).then(([rows, evts]) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setEvents(evts ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const eventsById = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e;
    return m;
  }, [events]);

  const groups = useMemo(() => {
    const byEvent = {};
    for (const r of regs) (byEvent[r.eventId] ||= []).push(r);
    return Object.entries(byEvent)
      .map(([eventId, list]) => {
        const counts = countRegs(list);
        const event = eventsById[eventId] || { id: eventId, name: "Unknown event" };
        const cap = event.capacity || 0;
        return {
          event,
          counts,
          cap,
          open: cap > 0 ? Math.max(0, cap - counts.seats) : 0,
          queue: list
            .filter((r) => r.status === "Waitlisted")
            .sort(
              (a, b) => (a.waitlistPosition || 99) - (b.waitlistPosition || 99),
            ),
        };
      })
      .filter((g) => g.queue.length > 0)
      .sort((a, b) => b.queue.length - a.queue.length);
  }, [regs, eventsById]);

  const handlePromote = async (eventId, count) => {
    const group = groups.find((g) => g.event.id === eventId);
    if (!group || !group.queue.length) return;
    const toPromote = group.queue.slice(0, count);
    const promotedIds = new Set(toPromote.map((p) => p.id));
    setRegs((prev) => {
      let pos = 0;
      return prev.map((r) => {
        if (r.eventId !== eventId || r.status !== "Waitlisted") return r;
        if (promotedIds.has(r.id))
          return { ...r, status: "Confirmed", waitlistPosition: null };
        pos += 1;
        return { ...r, waitlistPosition: pos };
      });
    });
    toast.success(
      count === 1
        ? `Promoted ${toPromote[0].name} from the waitlist.`
        : `Promoted ${count} from the waitlist.`,
    );
    const res = await promoteWaitlist(eventId, count);
    if (res === false) toast.error("Couldn't promote on the server.");
  };

  const handleRulesSaved = (eventId, rules) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, waitlistRules: rules } : e)),
    );
  };

  const openGroup = groups.find((g) => g.event.id === openEventId) || null;

  // ----------------------------------------------------------------------- //
  // Per-event queue
  // ----------------------------------------------------------------------- //
  if (openGroup) {
    const matches = openGroup.queue.filter((r) =>
      detailSearch
        ? `${r.name} ${r.email}`
            .toLowerCase()
            .includes(detailSearch.toLowerCase())
        : true,
    );
    const shown = matches.slice(0, detailLimit);
    const canPromote = openGroup.open > 0;

    return (
      <MainScreenWrapper>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => {
            setOpenEventId(null);
            setDetailSearch("");
            setDetailLimit(PAGE_ROWS);
          }}
        >
          <ArrowLeft className="h-4 w-4" /> All events
        </Button>

        <div className="space-y-3 border-b border-border pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {openGroup.event.name}
              </h1>
              {openGroup.event.waitlistRules?.autoPromote ? (
                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  Auto-promote on
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => setRulesFor(openGroup.event)}
              >
                <Settings2 className="h-4 w-4" /> Rules
              </Button>
              <Button
                disabled={!canPromote}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={() => handlePromote(openGroup.event.id, 1)}
              >
                <ArrowUp className="h-4 w-4" /> Promote next
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PipelineBar
              counts={openGroup.counts}
              capacity={openGroup.cap}
              className="flex-1"
              size="lg"
            />
            <span className="shrink-0 text-xs text-text-secondary tabular-nums">
              {openGroup.counts.seats}/{openGroup.cap || "∞"} ·{" "}
              {canPromote ? (
                <span className="text-emerald-400">{openGroup.open} open</span>
              ) : (
                <span className="text-red-400">full</span>
              )}
              {" · "}
              {openGroup.queue.length} waiting
            </span>
          </div>
        </div>

        <Toolbar>
          <span className="text-sm text-text-tertiary">
            {detailSearch
              ? `${matches.length} of ${openGroup.queue.length} match`
              : `Showing ${shown.length} of ${openGroup.queue.length}`}
          </span>
          <SearchInput
            value={detailSearch}
            onChange={(v) => {
              setDetailSearch(v);
              setDetailLimit(PAGE_ROWS);
            }}
            placeholder="Search this waitlist…"
            className="w-full sm:max-w-xs"
          />
        </Toolbar>

        {shown.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div className="divide-y divide-border">
              {shown.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-card text-xs font-semibold tabular-nums text-text-secondary">
                    {r.waitlistPosition || "—"}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
                    {initials(r.name) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">{r.email}</p>
                  </div>
                  <span className="hidden items-center gap-1 text-xs text-text-tertiary sm:flex">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(r.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canPromote}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
                    onClick={() => handlePromote(openGroup.event.id, 1)}
                  >
                    <ArrowUp className="h-4 w-4" /> Promote
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Clock}
              title="No one matches your search"
              description="Try a different name or email."
            />
          </div>
        )}

        {shown.length < matches.length ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setDetailLimit((l) => l + PAGE_ROWS)}
            >
              Show more ({matches.length - shown.length} left)
            </Button>
          </div>
        ) : null}

        {rulesFor ? (
          <RulesDialog
            event={rulesFor}
            open={!!rulesFor}
            onOpenChange={(o) => !o && setRulesFor(null)}
            onSaved={handleRulesSaved}
          />
        ) : null}
      </MainScreenWrapper>
    );
  }

  // ----------------------------------------------------------------------- //
  // Master list of events with a waitlist
  // ----------------------------------------------------------------------- //
  const listMatches = groups.filter((g) =>
    listSearch
      ? g.event.name.toLowerCase().includes(listSearch.toLowerCase())
      : true,
  );
  const listSorted = [...listMatches].sort((a, b) => {
    switch (listSort) {
      case "waiting-asc":
        return a.queue.length - b.queue.length;
      case "open-desc":
        return b.open - a.open;
      case "date-asc":
        return (a.event.date || "9999").localeCompare(b.event.date || "9999");
      case "name-asc":
        return a.event.name.localeCompare(b.event.name);
      default:
        return b.queue.length - a.queue.length;
    }
  });
  const listShown = listSorted.slice(0, listLimit);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Waitlist"
        description="Events with a queue. Open one to manage its waitlist, or promote the next person without leaving the list."
      />

      <Toolbar>
        <FilterDropdown
          value={listSort}
          onValueChange={setListSort}
          options={SORT_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={listSearch}
          onChange={(v) => {
            setListSearch(v);
            setListLimit(PAGE_EVENTS);
          }}
          placeholder="Search events…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading waitlists…
        </div>
      ) : listShown.length ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div className="divide-y divide-border">
              {listShown.map((g) => (
                <button
                  key={g.event.id}
                  type="button"
                  onClick={() => {
                    setOpenEventId(g.event.id);
                    setDetailSearch("");
                    setDetailLimit(PAGE_ROWS);
                  }}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {g.event.name}
                      </span>
                      {g.event.waitlistRules?.autoPromote ? (
                        <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          Auto
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-text-secondary">
                      {g.event.date ? `${formatDate(g.event.date)} · ` : ""}
                      {g.counts.seats}/{g.cap || "∞"} confirmed
                    </p>
                    <PipelineBar
                      counts={g.counts}
                      capacity={g.cap}
                      size="sm"
                      className="mt-2 max-w-xs"
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {g.queue.length}
                    </p>
                    <p className="text-[11px] text-text-secondary">waiting</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {g.open > 0 ? (
                      <span className="text-xs font-medium text-emerald-400 tabular-nums">
                        {g.open} open
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-400">full</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={g.open <= 0}
                    className="hidden shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePromote(g.event.id, 1);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" /> Promote
                  </Button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
                </button>
              ))}
            </div>
          </div>

          {listShown.length < listMatches.length ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => setListLimit((l) => l + PAGE_EVENTS)}
              >
                Show more events ({listMatches.length - listShown.length} left)
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Clock}
            title="No one's waiting"
            description="When an event fills up, people who register go on the waitlist and show up here, ready to promote."
          />
        </div>
      )}

      {rulesFor ? (
        <RulesDialog
          event={rulesFor}
          open={!!rulesFor}
          onOpenChange={(o) => !o && setRulesFor(null)}
          onSaved={handleRulesSaved}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default WaitlistScreen;
