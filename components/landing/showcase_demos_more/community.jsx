"use client";

import { useState } from "react";
import { Check, Clock, HelpCircle, Send, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  META,
  PANEL,
  TITLE,
  useVisibleInterval,
} from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Community — "The event doesn't stop between sessions"
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  { id: "q1", text: "Will the livestream be captioned?", votes: 48, answered: true },
  { id: "q2", text: "Can recordings be shared with the team?", votes: 31, answered: false },
  { id: "q3", text: "Is there a quiet room on day two?", votes: 17, answered: false },
];

// Q&A — upvoted questions float to the room, answered ones are marked.
export function QADemo() {
  const [votes, setVotes] = useState(
    Object.fromEntries(QUESTIONS.map((item) => [item.id, item.votes])),
  );
  const [voted, setVoted] = useState({});

  const upvote = (id) => {
    if (voted[id]) return;
    setVoted((prev) => ({ ...prev, [id]: true }));
    setVotes((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  };

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Q&A · Main stage</span>
        <span className={META}>128 asked</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {QUESTIONS.map((item) => (
          <div key={item.id} className={cn(CARD, "flex items-start gap-2 px-3 py-2")}>
            <button
              type="button"
              onClick={() => upvote(item.id)}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-md border px-1.5 py-1 transition-colors",
                voted[item.id]
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-300"
                  : "border-white/10 text-white/40 hover:text-white",
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              <span className="mt-0.5 text-[10px] tabular-nums">{votes[item.id]}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] leading-snug text-white">{item.text}</div>
              {item.answered && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <Check className="h-3 w-3" />
                  Answered on stage
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-[#262626] px-2.5 py-1.5">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <span className="flex-1 text-[11px] text-white/35">Ask a question…</span>
        <Send className="h-3 w-3 shrink-0 text-white/30" />
      </div>
    </div>
  );
}

const POLL_OPTIONS = [
  { id: "a", label: "Right after the last session", votes: 128 },
  { id: "b", label: "An hour break, then party", votes: 94 },
  { id: "c", label: "Quiet hang at the hotel", votes: 41 },
];

// Live polls — results rendered as the votes land, visible to the whole room.
export function PollsDemo() {
  const [counts, setCounts] = useState(
    Object.fromEntries(POLL_OPTIONS.map((item) => [item.id, item.votes])),
  );
  const [mine, setMine] = useState(null);
  const ref = useVisibleInterval(() => {
    setCounts((prev) => ({ ...prev, a: prev.a + 1 }));
  }, 3000);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const vote = (id) => {
    if (mine) return;
    setMine(id);
    setCounts((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  };

  return (
    <div className={PANEL} ref={ref}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Live poll</span>
        <Chip tone="live">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {total} votes
        </Chip>
      </div>

      <div className="mb-2 shrink-0 text-[12px] font-medium text-white">
        What&apos;s the best time for the afterparty?
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {POLL_OPTIONS.map((option) => {
          const count = counts[option.id];
          const pct = Math.round((count / total) * 100);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
                mine === option.id
                  ? "border-indigo-400/40"
                  : "border-white/[0.07] bg-[#212121] hover:border-white/20",
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-white">
                  {option.label}
                </span>
                {mine === option.id && (
                  <span className="shrink-0 text-[10px] font-medium text-indigo-300">
                    You voted
                  </span>
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                  {pct}% · {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SLOTS = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
const PRE_TAKEN = { "14:30": true, "15:30": true };

// Meeting scheduler — office hours with open slots left for the taking.
export function MeetingSchedulerDemo() {
  const [booked, setBooked] = useState({});
  const [mine, setMine] = useState(null);

  const take = (slot) => {
    if (mine || booked[slot]) return;
    setBooked((prev) => ({ ...prev, [slot]: true }));
    setMine(slot);
  };

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Meeting scheduler</span>
        <span className={META}>Office hours · Ada Chen</span>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        {SLOTS.map((slot) => {
          const taken = PRE_TAKEN[slot];
          const isMine = mine === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => take(slot)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border py-2 text-[11px] transition-colors",
                isMine
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  : taken
                    ? "border-white/[0.07] text-white/20 line-through"
                    : "border-white/10 text-white/60 hover:border-white/30 hover:text-white",
              )}
            >
              <Clock className="h-3 w-3" />
              {slot}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-2">
        <span className="text-[10px] text-white/35">
          {mine ? "Meeting request sent with the agenda attached" : "Pick a free slot to book 1:1"}
        </span>
        {mine && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <Check className="h-3 w-3" />
            {mine} booked
          </span>
        )}
      </div>
    </div>
  );
}
