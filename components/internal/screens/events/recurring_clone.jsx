"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import {
  DataTable,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { EVENT_STATUS_MAP, formatDate } from "./sample_data";
import { useEventConfig } from "@/lib/events/use-event-config";
import { Segmented } from "./theme_controls";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ENDS_OPTIONS = [
  { key: "never", label: "Never" },
  { key: "on", label: "On a specific date" },
  { key: "after", label: "After a number of occurrences" },
];

const FREQ_LABEL = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

function nextOccurrences({ freq, interval, days, count }) {
  const total = Math.min(Number(count) || 0, 6);
  if (total <= 0) return [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (freq === "daily") {
    const out = [];
    for (let i = 1; i <= total; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * (Number(interval) || 1));
      out.push(toISO(d));
    }
    return out;
  }

  if (freq === "monthly") {
    const out = [];
    for (let i = 1; i <= total; i++) {
      const d = new Date(start);
      d.setMonth(start.getMonth() + i * (Number(interval) || 1));
      out.push(toISO(d));
    }
    return out;
  }

  const monday = new Date(start);
  monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const wantDays = (
    days.length ? days.map((d) => DAYS.indexOf(d)) : [(start.getDay() + 6) % 7]
  ).sort((a, b) => a - b);
  const out = [];
  for (let w = 0; out.length < total && w < 104; w++) {
    for (const di of wantDays) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + w * 7 * (Number(interval) || 1) + di);
      if (d > start) out.push(toISO(d));
      if (out.length >= total) break;
    }
  }
  return out;
}

export function RecurringEventsSection({ event }) {
  const [rule, setRule, saveRule, saving] = useEventConfig(event, "recurring", {
    freq: "weekly",
    interval: 1,
    days: ["Tue"],
    ends: "after",
    count: 8,
  });
  const [previewSeed, setPreviewSeed] = useState(0);
  const { freq, interval, days, ends, count } = rule;
  const setField = (key) => (value) => setRule({ ...rule, [key]: value });
  const setFreq = setField("freq");
  const setInterval = setField("interval");
  const setEnds = setField("ends");
  const setCount = setField("count");

  const toggleDay = (d) =>
    setRule({
      ...rule,
      days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
    });

  const summary = `Every ${interval > 1 ? `${interval} ` : ""}${FREQ_LABEL[freq]}${interval > 1 ? "s" : ""}${
    freq === "weekly" && days.length ? ` on ${days.join(", ")}` : ""
  }${ends === "after" ? `, ${count} times` : ends === "on" ? ", until a set date" : ", with no end"}`;

  const occurrences = useMemo(
    () =>
      nextOccurrences({
        freq,
        interval,
        days,
        count,
      }).map((date, i) => ({
        id: i,
        date,
        status: i === 0 ? "On sale" : "Scheduled",
      })),
    [freq, interval, days, count, previewSeed],
  );

  const save = () => {
    saveRule(rule, { successMsg: "Recurrence rule saved." });
    setPreviewSeed((n) => n + 1);
  };

  const occColumns = [
    {
      key: "n",
      header: "#",
      render: (o) => <span className="text-text-secondary">{o.id + 1}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (o) => (
        <span className="font-medium text-foreground">{formatDate(o.date)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusPill status={o.status} map={EVENT_STATUS_MAP} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <SectionCard title="Recurrence rule">
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Repeats">
                <Select value={freq} onValueChange={setFreq}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Every">
                <Input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value) || 1)}
                />
              </Field>
            </div>

            {freq === "weekly" ? (
              <Field label="On days">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const active = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={cn(
                          "h-9 w-12 rounded-md border text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : null}

            <Field label="Ends">
              <Segmented
                value={ends}
                onChange={setEnds}
                options={ENDS_OPTIONS}
              />
            </Field>
            {ends === "after" ? (
              <Field label="Occurrences">
                <Input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 1)}
                />
              </Field>
            ) : null}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Summary">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-card p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">{summary}</p>
            </div>
            <Button
              className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save rule"}
            </Button>
          </SectionCard>

          <SectionCard title="Upcoming occurrences" bodyPadding={false}>
            <DataTable
              columns={occColumns}
              data={occurrences}
              getRowKey={(o) => o.id}
              className="rounded-none border-0"
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
