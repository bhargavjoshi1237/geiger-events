"use client";

import { useState } from "react";
import { Award, Check, ChevronDown, Download, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { CARD, META, PANEL, TITLE } from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Program — "Run the content, not just the door"
 * ------------------------------------------------------------------ */

const AGENDA_TRACKS = ["Main", "Studio B", "Lab"];

const TRACK_ACCENTS = [
  { text: "text-sky-300", border: "border-sky-400/30", bg: "bg-sky-500/10" },
  { text: "text-indigo-300", border: "border-indigo-400/30", bg: "bg-indigo-500/10" },
  { text: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/10" },
];

const AGENDA_ROWS = [
  {
    time: "09:00",
    cells: [
      { id: "a1", title: "Opening keynote", who: "Ada Chen", track: 0 },
      null,
      { id: "a3", title: "Workshop intake", who: "Tom Okafor", track: 2 },
    ],
  },
  {
    time: "11:00",
    cells: [
      { id: "b1", title: "Scaling live ops", who: "Marco Silva", track: 0 },
      { id: "b2", title: "Room design", who: "Priya Raman", track: 1 },
      null,
    ],
  },
  {
    time: "14:00",
    cells: [
      { id: "c1", title: "Keynote 2", who: "Ada Chen", track: 0, conflict: true },
      { id: "c2", title: "Fireside", who: "Ada Chen", track: 1, conflict: true },
      { id: "c3", title: "Hands-on lab", who: "Lena Fischer", track: 2 },
    ],
  },
  {
    time: "16:30",
    cells: [
      { id: "d1", title: "Closing", who: "Marco Silva", track: 0 },
      null,
      { id: "d3", title: "Retro", who: "Jonas Weber", track: 2 },
    ],
  },
];

// Agenda builder — sessions on tracks with live conflict detection.
export function AgendaBuilderDemo() {
  const [resolved, setResolved] = useState(false);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Agenda builder</span>
        <span className={META}>Day 1 · 3 tracks</span>
      </div>

      {resolved ? (
        <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400">
          <Check className="h-3 w-3" />
          Conflict resolved — Ada Chen stays in Main
        </div>
      ) : (
        <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-amber-300">
            Ada Chen is booked in two rooms at 14:00
          </span>
          <button
            type="button"
            onClick={() => setResolved(true)}
            className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
          >
            Swap
          </button>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-[34px_1fr_1fr_1fr] gap-1 px-0.5 pb-1 text-[9px] uppercase tracking-wider text-white/30">
        <span />
        {AGENDA_TRACKS.map((track, index) => (
          <span key={track} className={TRACK_ACCENTS[index].text}>
            {track}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
        {AGENDA_ROWS.map((row) => (
          <div key={row.time} className="grid grid-cols-[34px_1fr_1fr_1fr] items-stretch gap-1">
            <span className="pt-1 text-[10px] tabular-nums text-white/30">{row.time}</span>
            {row.cells.map((cell, index) => {
              if (!cell) {
                return (
                  <span
                    key={index}
                    className="rounded-md border border-dashed border-white/[0.07]"
                  />
                );
              }
              const accent = TRACK_ACCENTS[cell.track];
              const conflicted = cell.conflict && !resolved;
              const who = resolved && cell.id === "c2" ? "Ravi Patel" : cell.who;
              return (
                <button
                  key={cell.id}
                  type="button"
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-left transition-colors",
                    accent.border,
                    accent.bg,
                    conflicted && "border-red-500/40 bg-red-500/[0.07]",
                  )}
                >
                  <span className="block truncate text-[10px] font-medium leading-tight text-white">
                    {cell.title}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[9px] leading-tight",
                      conflicted ? "text-red-400" : accent.text,
                    )}
                  >
                    {conflicted ? `${who} · double-booked` : who}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const SUBMISSIONS = [
  { id: "s1", title: "Scaling live ops with bounded queues", who: "Marco Silva", track: "Engineering", status: "new" },
  { id: "s2", title: "Designing for the doorless event", who: "Ada Chen", track: "Experience", status: "review" },
  { id: "s3", title: "Metrics that survive the afterparty", who: "Priya Raman", track: "Analytics", status: "accepted" },
];

// Call for papers — the submission queue feeding the agenda.
export function CallForPapersDemo() {
  const [statuses, setStatuses] = useState(
    Object.fromEntries(SUBMISSIONS.map((item) => [item.id, item.status])),
  );

  const set = (id, status) => setStatuses((prev) => ({ ...prev, [id]: status }));

  const pending = SUBMISSIONS.filter(
    (item) => statuses[item.id] === "new" || statuses[item.id] === "review",
  ).length;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Call for papers</span>
        <span className={META}>{pending} to review</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {SUBMISSIONS.map((item) => {
          const status = statuses[item.id];
          const actionable = status === "new" || status === "review";
          return (
            <div
              key={item.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.title}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.who} · {item.track}
                </div>
              </div>
              {actionable ? (
                <button
                  type="button"
                  onClick={() => set(item.id, "accepted")}
                  className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
                >
                  Accept
                </button>
              ) : (
                <Chip tone={status === "accepted" ? "ok" : "muted"}>
                  {status === "accepted" ? "Accepted" : "Declined"}
                </Chip>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] text-white/35">214 submissions total</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/60">
          Review queue
          <ChevronDown className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

const SPEAKER_RUN = [
  { id: "ada", name: "Ada Chen", session: "Keynote · Main Hall 14:00" },
  { id: "marco", name: "Marco Silva", session: "Scaling live ops · 11:00" },
  { id: "lena", name: "Lena Fischer", session: "Hands-on lab · 14:00" },
];

const RUN_STAGES = ["confirmed", "in-room", "on-stage", "done"];
const STAGE_LABEL = {
  confirmed: "Confirmed",
  "in-room": "In green room",
  "on-stage": "On stage",
  done: "Wrapped",
};

// Speakers & CEU — the roster, run-of-show, and the credits attendees earn.
export function SpeakersCEUDemo() {
  const [stage, setStage] = useState({ ada: 0, marco: 0, lena: 0 });

  const advance = (id) =>
    setStage((prev) => ({
      ...prev,
      [id]: Math.min(RUN_STAGES.length - 1, prev[id] + 1),
    }));

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Speakers & CEU</span>
        <span className={META}>Run of show</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {SPEAKER_RUN.map((speaker) => {
          const step = stage[speaker.id];
          const on = RUN_STAGES[step];
          return (
            <div
              key={speaker.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-[#2b2b2b] text-[9px] font-medium text-white/60">
                {speaker.name.split(" ").map((part) => part[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {speaker.name}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {speaker.session}
                </div>
              </div>
              <button
                type="button"
                onClick={() => advance(speaker.id)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                  on === "on-stage"
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : on === "done"
                      ? "border border-white/10 text-white/30"
                      : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {STAGE_LABEL[on]}
              </button>
            </div>
          );
        })}
      </div>

      <div className={cn(CARD, "mt-2 flex shrink-0 items-center gap-2 px-3 py-2")}>
        <Award className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-white">
            CEU & certificates
          </div>
          <div className={META}>6.0 hrs earned · 2 certs ready to send</div>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
        >
          <Download className="h-3 w-3" />
          Send
        </button>
      </div>
    </div>
  );
}
