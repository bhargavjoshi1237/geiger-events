"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check } from "lucide-react";

import {
  DataTable,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_STATUS_MAP, formatDate } from "./sample_data";

// --- Recurring Events --------------------------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FREQ_LABEL = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export function RecurringEventsSection({ event }) {
  const [freq, setFreq] = useState("weekly");
  const [interval, setInterval] = useState(1);
  const [days, setDays] = useState(["Tue"]);
  const [ends, setEnds] = useState("after");
  const [count, setCount] = useState(8);

  const toggleDay = (d) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const summary = `Every ${interval > 1 ? `${interval} ` : ""}${FREQ_LABEL[freq]}${interval > 1 ? "s" : ""}${
    freq === "weekly" && days.length ? ` on ${days.join(", ")}` : ""
  }${ends === "after" ? `, ${count} times` : ends === "on" ? ", until a set date" : ", with no end"}`;

  // Build a few illustrative upcoming occurrences.
  const occurrences = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    id: i,
    date: `2026-07-${String(7 + i * 7).padStart(2, "0")}`,
    status: i === 0 ? "On sale" : "Scheduled",
  }));

  const occColumns = [
    {
      key: "n",
      header: "#",
      render: (o) => <span className="text-[#737373]">{o.id + 1}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (o) => (
        <span className="font-medium text-[#ededed]">{formatDate(o.date)}</span>
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
                            ? "border-white bg-white text-[#161616]"
                            : "border-[#2a2a2a] bg-[#202020] text-[#a3a3a3] hover:bg-[#252525]",
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
              <div className="space-y-2">
                {[
                  { value: "never", label: "Never" },
                  { value: "on", label: "On a specific date" },
                  { value: "after", label: "After a number of occurrences" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEnds(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      ends === opt.value
                        ? "border-[#3a3a3a] bg-[#202020] text-[#ededed]"
                        : "border-[#2a2a2a] bg-transparent text-[#a3a3a3] hover:bg-[#1f1f1f]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        ends === opt.value
                          ? "border-white bg-white"
                          : "border-[#444]",
                      )}
                    >
                      {ends === opt.value ? (
                        <Check className="h-3 w-3 text-[#161616]" />
                      ) : null}
                    </span>
                    {opt.label}
                    {opt.value === "after" && ends === "after" ? (
                      <Input
                        type="number"
                        min={1}
                        value={count}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCount(Number(e.target.value) || 1)}
                        className="ml-auto !h-8 w-20"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Summary">
            <div className="flex items-start gap-3 rounded-lg border border-[#2a2a2a] bg-[#202020] p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#a3a3a3]" />
              <p className="text-sm text-[#ededed]">{summary}</p>
            </div>
            <Button
              className="mt-4 w-full bg-white text-[#161616] hover:bg-[#e7e7e7]"
              onClick={() => toast.success("Recurrence rule saved.")}
            >
              Generate occurrences
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
