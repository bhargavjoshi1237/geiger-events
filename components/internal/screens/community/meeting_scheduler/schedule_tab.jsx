"use client";

import React, { useMemo, useState } from "react";
import { CalendarRange, Plus, Settings2 } from "lucide-react";

import { EmptyState, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { meetingDates, overlaps, sessionIntervals, slotsForDate } from "@/lib/meetings/slots";
import { dateToWall, fmtDayLabel, fmtRange, fmtTime, tzAbbrev } from "@/lib/meetings/time";
import { MEETING_STATUS_MAP, isFuture, personName } from "./constants";
import { CreateMeetingDialog, MeetingDialog } from "./meeting_dialogs";

const UNASSIGNED = "__unassigned";

function MeetingChip({ meeting, people, tz, onOpen }) {
  const status = MEETING_STATUS_MAP[meeting.status] || MEETING_STATUS_MAP.scheduled;
  const names = (meeting.participants || []).map((id) => personName(people, id).split(/\s+/)[0]);
  return (
    <button
      type="button"
      onClick={() => onOpen(meeting.id)}
      className={cn(
        "flex w-full items-start gap-1.5 rounded-lg border border-border bg-surface-card px-2 py-1.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover",
        meeting.status !== "scheduled" && "opacity-70",
      )}
    >
      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{names.join(" & ")}</span>
        <span className="block truncate text-[11px] text-text-tertiary">
          {fmtRange(meeting.startsAt, meeting.endsAt, tz)}
          {meeting.status !== "scheduled" ? ` · ${status.label}` : ""}
        </span>
      </span>
    </button>
  );
}

// Grid of a day's slots (rows) by location (columns); click an open cell to book on attendees' behalf.
export function ScheduleTab({
  tz,
  settings,
  sessions,
  meetings,
  people,
  options,
  onCreate,
  onUpdate,
  onReschedule,
  onOpenSettings,
}) {
  const dates = useMemo(() => meetingDates(settings), [settings]);
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(null);
  const [openId, setOpenId] = useState(null);
  const activeDate = dates.includes(date) ? date : dates[0] || "";

  const rows = useMemo(() => slotsForDate(settings, tz, activeDate), [settings, tz, activeDate]);
  const agenda = useMemo(() => sessionIntervals(sessions, settings, tz), [sessions, settings, tz]);

  const layout = useMemo(() => {
    const live = meetings.filter((m) => m.status !== "cancelled" && dateToWall(m.startsAt, tz)?.date === activeDate);
    const cells = new Map();
    const offGrid = [];
    let unassigned = false;
    const locationIds = new Set(settings.locations.map((l) => l.id));
    for (const m of live) {
      const start = Date.parse(m.startsAt);
      let row = -1;
      for (let i = 0; i < rows.length; i += 1) {
        const rowStart = Date.parse(rows[i].start);
        const next = i + 1 < rows.length ? Date.parse(rows[i + 1].start) : Date.parse(rows[i].end);
        if (start >= rowStart && start < Math.max(next, Date.parse(rows[i].end))) {
          row = i;
          break;
        }
      }
      if (row < 0) {
        offGrid.push(m);
        continue;
      }
      let col = m.locationId && locationIds.has(m.locationId) ? m.locationId : UNASSIGNED;
      if (!settings.locations.length) col = UNASSIGNED;
      else if (col === UNASSIGNED) unassigned = true;
      const key = `${rows[row].key}|${col}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(m);
    }
    return { cells, offGrid, unassigned };
  }, [meetings, rows, settings.locations, tz, activeDate]);

  const columns = settings.locations.length
    ? [
        ...settings.locations,
        ...(layout.unassigned ? [{ id: UNASSIGNED, name: "Unassigned", capacity: 0, readOnly: true }] : []),
      ]
    : [{ id: UNASSIGNED, name: "Meetings", capacity: Infinity }];

  const openMeeting = meetings.find((m) => m.id === openId) || null;

  if (!dates.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={CalendarRange}
          title="No meeting days yet"
          description="Add the days and hours attendees can meet in Settings, then the schedule fills in here."
          action={
            <Button
              variant="outline"
              onClick={onOpenSettings}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" /> Open settings
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {dates.length > 1 ? (
          <SegmentedTabs
            tabs={dates.map((d) => ({ value: d, label: fmtDayLabel(d) }))}
            value={activeDate}
            onChange={setDate}
          />
        ) : (
          <p className="text-sm font-medium text-foreground">{fmtDayLabel(activeDate, { long: true })}</p>
        )}
        <p className="text-xs text-text-tertiary">
          Times in {tzAbbrev(tz, rows[0] ? new Date(rows[0].start) : new Date())} · click an open cell to book a meeting
        </p>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-28 border-b border-border bg-surface-subtle px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Time
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className="min-w-[170px] border-b border-l border-border px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-secondary"
                  >
                    {c.name}
                    {Number.isFinite(c.capacity) && c.capacity > 1 ? (
                      <span className="ml-1 normal-case tracking-normal text-text-tertiary">· {c.capacity} at once</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const s = Date.parse(row.start);
                const e = Date.parse(row.end);
                const session = agenda.find((i) => overlaps(s, e, i.start, i.end));
                const open = isFuture(row.start);
                return (
                  <tr key={row.key} className={cn(session && "bg-surface-strong/40")}>
                    <td className="sticky left-0 z-10 border-b border-border bg-surface-subtle px-3 py-2 align-top">
                      <span className="block text-xs font-medium tabular-nums text-foreground">{fmtTime(row.start, tz)}</span>
                      {session ? (
                        <span className="mt-0.5 block truncate text-[11px] text-text-tertiary" title={session.name}>
                          {session.name || "Agenda session"}
                        </span>
                      ) : null}
                    </td>
                    {columns.map((c) => {
                      const list = layout.cells.get(`${row.key}|${c.id}`) || [];
                      const active = list.filter((m) => m.status === "scheduled").length;
                      const canAdd = open && !c.readOnly && active < c.capacity;
                      return (
                        <td key={c.id} className="border-b border-l border-border px-2 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            {list.map((m) => (
                              <MeetingChip key={m.id} meeting={m} people={people} tz={tz} onOpen={setOpenId} />
                            ))}
                            {canAdd ? (
                              <button
                                type="button"
                                onClick={() => setCreating({ slot: row, locationId: c.id === UNASSIGNED ? null : c.id })}
                                className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] text-text-tertiary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
                                aria-label={`Book a meeting at ${fmtTime(row.start, tz)} in ${c.name}`}
                              >
                                <Plus className="h-3 w-3" /> Book
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarRange}
            title="No slots on this day"
            description="This day's window is shorter than one meeting slot. Adjust it in Settings."
          />
        </div>
      )}

      {layout.offGrid.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Outside this day&apos;s slots</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {layout.offGrid.map((m) => (
              <MeetingChip key={m.id} meeting={m} people={people} tz={tz} onOpen={setOpenId} />
            ))}
          </div>
        </div>
      ) : null}

      <CreateMeetingDialog
        open={Boolean(creating)}
        onOpenChange={(o) => !o && setCreating(null)}
        slot={creating?.slot || null}
        locationId={creating?.locationId || null}
        settings={settings}
        tz={tz}
        options={options}
        people={people}
        meetings={meetings}
        onCreate={onCreate}
      />

      <MeetingDialog
        meeting={openMeeting}
        onOpenChange={(o) => !o && setOpenId(null)}
        people={people}
        settings={settings}
        tz={tz}
        sessions={sessions}
        meetings={meetings}
        onUpdate={onUpdate}
        onReschedule={onReschedule}
      />
    </div>
  );
}

export default ScheduleTab;
