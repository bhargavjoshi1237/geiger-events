"use client";

import { AlertTriangle, ArrowUp, Award, Check, Loader2, Lock, Play, Radio, Send, Trophy, Unlock, Users } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, Field, Notice, Part, Pill, Row, RowText, SceneCard, flow } from "./kit";

// Program, community and broadcast scenes: each one ends on what the audience or the program gains.

const SLOTS = ["11:00", "12:00", "14:00"];
const ROOMS = ["Main stage", "Studio"];

// Agenda: a double-booked speaker is flagged; dragging the session to a free slot clears it.
function AgendaScene({ view }) {
  const { state } = view;
  const sessions = [
    { title: "Keynote", speaker: "Mara Ellis", room: 0, slot: 0 },
    { title: "Panel: Live sound", speaker: "Mara Ellis", room: 1, slot: state.moved ? 2 : 0 },
    { title: "Workshop", speaker: "Jordan Lee", room: 1, slot: 1 },
  ];
  const conflict = !state.moved;
  return (
    <SceneCard title="Agenda" meta="Sat 14 Mar · 2 rooms">
      <div className="grid grid-cols-[44px_1fr_1fr] gap-1.5 text-xs">
        <span />
        {ROOMS.map((room) => <span key={room} className="pb-1 font-medium text-muted-foreground">{room}</span>)}
        {SLOTS.map((slot, slotIndex) => (
          <div key={slot} className="contents">
            <span className="pt-2 tabular-nums text-muted-foreground">{slot}</span>
            {ROOMS.map((room, roomIndex) => {
              const session = sessions.find((s) => s.room === roomIndex && s.slot === slotIndex);
              const clash = conflict && session?.speaker === "Mara Ellis";
              const lifted = state.lifted && session?.title === "Panel: Live sound";
              return (
                <div key={room} data-part={session ? `session-${session.title}` : `slot-${roomIndex}-${slotIndex}`} className={cn("min-h-12 rounded-md border p-2 transition-all duration-300", session ? "border-border bg-muted" : "border-dashed border-border", clash && "border-amber-500/60 bg-amber-500/10", lifted && "-translate-y-1 shadow-lg", state.lifted && !session && "border-foreground/40")}>
                  {session ? <><div className="truncate font-medium text-foreground">{session.title}</div><div className="truncate text-muted-foreground">{session.speaker}</div></> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <Part id="flag" view={view} className="mt-3">
        {conflict ? <Notice tone="warning" icon={AlertTriangle}>Mara Ellis is booked in two rooms at 11:00.</Notice> : <Notice tone="success" icon={Check}>No conflicts. Speakers and rooms all line up.</Notice>}
      </Part>
    </SceneCard>
  );
}

const SUBMISSIONS = [["Designing for loud rooms", "Mara Ellis · Sound", "4.6"], ["Ticketing without queues", "Sam Okafor · Ops", "4.1"], ["Merch that sells", "Jordan Lee · Business", "3.4"]];

// Call for papers: reviewed talks are accepted straight into an agenda slot.
function PapersScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Call for papers" meta="Nightshift Conference · 38 submissions" aside={<span className="shrink-0 text-xs text-muted-foreground">Review score</span>}>
      <div className="space-y-2">
        {SUBMISSIONS.map(([title, meta, score], index) => (
          <Row key={title} className="py-2">
            <RowText title={title} meta={meta} />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tabular-nums">{score}</span>
              {index === 0 && state.accepted ? <Pill tone="success">Accepted</Pill> : <Button data-part={`accept-${index}`} size="sm" variant="outline" className="h-7 text-xs">Accept</Button>}
            </div>
          </Row>
        ))}
      </div>
      <Part id="slot" view={view} className="mt-3">
        <div className="mb-1.5 text-xs text-muted-foreground">Main stage · Sat 14 Mar</div>
        <div className="grid grid-cols-[44px_1fr] gap-1.5 text-xs">
          <span className="pt-2 tabular-nums text-muted-foreground">13:00</span><div className="rounded-md border border-border bg-muted p-2 font-medium">Keynote</div>
          <span className="pt-2 tabular-nums text-muted-foreground">14:00</span>
          <div className={cn("rounded-md border p-2 transition-all duration-500", state.scheduled ? "border-foreground bg-foreground font-medium text-background" : "border-dashed border-border text-muted-foreground")}>{state.scheduled ? "Designing for loud rooms" : "Open slot"}</div>
        </div>
      </Part>
    </SceneCard>
  );
}

const SPEAKERS = [["Mara Ellis", "Keynote · 1.5 credits"], ["Sam Okafor", "Panel · 1.0 credit"], ["Jordan Lee", "Workshop · 2.0 credits"]];

// Speakers & credits: confirm the line-up, then credits go to the people who attended.
function SpeakersScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Speakers" meta="Nightshift Conference 2026">
      <div className="space-y-2">
        {SPEAKERS.map(([name, meta], index) => {
          const confirmed = index !== 1 || state.confirmed;
          return (
            <Row key={name} className="py-2">
              <div className="flex min-w-0 items-center gap-3"><Avatar name={name} /><RowText title={name} meta={meta} /></div>
              {confirmed ? <Pill tone="success">Confirmed</Pill> : <Button data-part="confirm" size="sm" variant="outline" className="h-7 text-xs">Confirm</Button>}
            </Row>
          );
        })}
      </div>
      <Part id="credits" view={view} className="mt-3">
        <Notice tone={state.issued ? "success" : "neutral"} icon={state.issued ? Award : Users}>
          {state.issued ? <><span className="font-semibold">1.5 credits issued to 212 attendees</span> who checked in to the keynote.</> : "Credits are issued after each session to the attendees who were there."}
        </Notice>
      </Part>
    </SceneCard>
  );
}

// Q&A: the audience pushes questions up; answered ones step aside.
function QaScene({ view }) {
  const { state } = view;
  const questions = [
    { id: "a", text: "Will the set be recorded?", votes: 12 },
    { id: "b", text: "Is there a cloakroom?", votes: 9 + state.boost },
    { id: "c", text: "Which room is the workshop in?", votes: 4 },
  ].sort((x, y) => (state.answered === x.id) - (state.answered === y.id) || y.votes - x.votes);
  return (
    <SceneCard title="Q&A" meta="Opening session · 418 in the room">
      <div className="space-y-2">
        {questions.map((q) => {
          const answered = state.answered === q.id;
          return (
            <Row key={q.id} className={cn("py-2 transition-all duration-300", answered && "opacity-60")}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex w-8 shrink-0 flex-col items-center rounded-md border border-border py-1 text-xs tabular-nums"><ArrowUp className="size-3" />{q.votes}</span>
                <span className="truncate text-sm">{q.text}</span>
              </div>
              {answered ? <Pill tone="success">Answered</Pill> : <Button data-part={`answer-${q.id}`} variant="ghost" size="icon" className="size-7"><Check className="size-3.5" /></Button>}
            </Row>
          );
        })}
      </div>
    </SceneCard>
  );
}

const OPTIONS = [["a", "Live sound"], ["b", "Lighting design"], ["c", "Running the door"]];

// Polls: votes stream in, then closing the poll names the winner.
function PollScene({ view }) {
  const { state } = view;
  const total = state.votes.reduce((sum, count) => sum + count, 0) || 1;
  const winner = state.votes.indexOf(Math.max(...state.votes));
  return (
    <SceneCard title="Which workshop should run next?" meta={`Live poll · ${state.votes.reduce((a, b) => a + b, 0)} votes`} aside={<Button data-part="close" size="sm" variant={state.closed ? "outline" : "default"}>{state.closed ? "Closed" : "Close poll"}</Button>}>
      <Part id="results" view={view} className="space-y-2">
        {OPTIONS.map(([id, label], index) => {
          const won = state.closed && index === winner;
          return (
            <div key={id} className={cn("relative overflow-hidden rounded-lg border px-3 py-2.5", won ? "border-foreground" : "border-border")}>
              <div className={cn("absolute inset-y-0 left-0 transition-[width] duration-700", won ? "bg-foreground/15" : "bg-muted")} style={{ width: `${(state.votes[index] / total) * 100}%` }} />
              <div className="relative flex justify-between text-sm"><span className="flex items-center gap-2">{won ? <Trophy className="size-3.5" /> : null}{label}</span><span className="tabular-nums text-muted-foreground">{Math.round((state.votes[index] / total) * 100)}%</span></div>
            </div>
          );
        })}
      </Part>
      <Notice tone="strong" icon={Trophy} show={state.closed} className="mt-3">Lighting design wins with 47%. That workshop runs next.</Notice>
    </SceneCard>
  );
}

const MEETING_SLOTS = ["10:30", "11:00", "11:30", "13:00"];

// Meetings: pick an open slot and it lands in both people's agendas.
function MeetingScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Meet Jordan Lee" meta="Sponsor · Sound Weekly · 20 min">
      <div className="grid grid-cols-2 gap-2">
        {MEETING_SLOTS.map((slot) => <Button key={slot} data-part={`slot-${slot}`} variant={state.slot === slot ? "default" : "outline"} disabled={slot === "11:00"} className="tabular-nums">{slot === "11:00" ? "11:00 · taken" : slot}</Button>)}
      </div>
      <Button data-part="book" className="mt-3 w-full" variant={state.booked ? "outline" : "default"} disabled={!state.slot}>{state.booked ? <><Check className="size-3.5" />Booked</> : "Book meeting"}</Button>
      <Part id="agendas" view={view} className="mt-3">
        <Notice tone="success" show={state.booked}>
          <span className="flex items-center gap-2"><span className="flex -space-x-2"><Avatar name="Ada Chen" /><Avatar name="Jordan Lee" /></span>Added to both agendas · {state.slot} · Sponsor lounge</span>
        </Notice>
      </Part>
    </SceneCard>
  );
}

// Livestream: the remote audience grows alongside the room, and joins the conversation.
function StreamScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Main stage" meta="Livestream · Nightshift 2026">
      <Part id="video" view={view} className="relative grid aspect-[16/8] place-items-center rounded-lg bg-foreground text-background">
        <Radio className="size-8 opacity-60" />
        <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">LIVE</span>
      </Part>
      <Part id="audience" view={view} className="mt-3 grid grid-cols-2 gap-2">
        {[["In the room", "418"], ["Watching online", state.online.toLocaleString("en-US")]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted px-3 py-2"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-base font-semibold tabular-nums">{value}</div></div>
        ))}
      </Part>
      <div className="mt-3 space-y-1 text-xs">
        {state.chat.map(([who, text]) => <div key={who + text} className="motion-safe:animate-in motion-safe:fade-in"><span className="font-medium">{who}</span> <span className="text-muted-foreground">{text}</span></div>)}
      </div>
      <div className="mt-2 flex gap-2">
        <Field id="message" placeholder="Say something" view={view} className="flex-1" />
        <Button data-part="send" size="icon" className="size-[42px]"><Send className="size-4" /></Button>
      </div>
    </SceneCard>
  );
}

// Replays: the recording lands in the library after the session, with access you control.
function ReplayScene({ view }) {
  const { state } = view;
  const replays = [
    { title: "Opening set", meta: "48 min", ready: true },
    ...(state.published ? [{ title: "Live: Halcyon", meta: state.processing ? "Processing recording…" : "62 min · just added", ready: !state.processing, fresh: true }] : []),
    { title: "Vinyl corner", meta: "35 min", ready: true },
  ];
  return (
    <SceneCard title="Replays" meta="Nightshift 2026 · On demand">
      <Part id="library" view={view} className="space-y-2">
        {replays.map((replay, index) => (
          <Row key={replay.title} className={cn("py-2", replay.fresh && "motion-safe:animate-in motion-safe:fade-in")}>
            <div className="flex min-w-0 items-center gap-3">
              <Button data-part={`play-${replay.title}`} variant={state.playing === replay.title ? "default" : "outline"} size="icon" className="size-8">{replay.ready ? <Play className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}</Button>
              <RowText title={replay.title} meta={state.playing === replay.title ? "Playing · 00:12" : replay.meta} />
            </div>
            {replay.ready ? (
              <Button data-part={`access-${index}`} variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                {replay.fresh && state.vip ? <><Lock className="size-3" />VIP only</> : <><Unlock className="size-3" />Ticket holders</>}
              </Button>
            ) : null}
          </Row>
        ))}
      </Part>
    </SceneCard>
  );
}

const TRANSCRIPT = [["14:02", "Thanks for coming out tonight."], ["14:20", "Ticket pricing was the hardest call."], ["14:41", "Next up is the workshop in the Studio."]];

// Captions: words appear live under the stream, and the transcript is searchable afterwards.
function CaptionScene({ view }) {
  const { state } = view;
  const term = state.search.trim().toLowerCase();
  return (
    <SceneCard title="Opening session" meta="Live captions · searchable transcript">
      <div className="relative grid aspect-[16/7] place-items-end rounded-lg bg-foreground p-3 text-background">
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] tabular-nums text-white">{state.jumped ? "14:20" : "14:21"}</span>
        <Part id="line" view={view} className="max-w-full rounded bg-black/70 px-2 py-1 text-xs text-white">{state.line || " "}</Part>
      </div>
      <Field id="search" placeholder="Search the transcript" view={view} className="mt-3" />
      <div className="mt-2 space-y-1">
        {TRANSCRIPT.map(([time, text]) => {
          const hit = term && text.toLowerCase().includes(term);
          return (
            <div key={time} data-part={`line-${time}`} className={cn("flex gap-3 rounded-md px-2 py-1.5 text-xs transition-colors", hit ? "bg-muted text-foreground" : "text-muted-foreground", term && !hit && "opacity-50")}>
              <span className="tabular-nums">{time}</span><span>{text}</span>
            </div>
          );
        })}
      </div>
    </SceneCard>
  );
}

const CHAT = [["Priya", "That intro!"], ["Marco", "Sound is perfect from Berlin"]];

export const PROGRAM_PREVIEWS = {
  agenda: {
    Scene: AgendaScene,
    script: flow({ moved: false, lifted: false }, [
      { highlight: "flag", caption: "Clashes are flagged as you build the agenda.", hold: 1500 },
      { cursor: "session-Panel: Live sound", click: true, set: { lifted: true }, caption: "Drag the clashing session…", hold: 300 },
      { cursor: "slot-1-2", click: true, set: { moved: true, lifted: false }, highlight: "flag", caption: "…into a free slot, and the flag clears.", hold: 1900 },
    ]),
  },
  papers: {
    Scene: PapersScene,
    script: flow({ accepted: false, scheduled: false }, [
      { caption: "Submissions arrive with their reviewers' scores.", hold: 1300 },
      { cursor: "accept-0", click: true, set: { accepted: true }, caption: "Accept the strongest talk…", hold: 600 },
      { set: { scheduled: true }, highlight: "slot", caption: "…and it goes straight into an open agenda slot.", hold: 2000 },
    ]),
  },
  speakers: {
    Scene: SpeakersScene,
    script: flow({ confirmed: false, issued: false }, [
      { caption: "See who's confirmed for your line-up.", hold: 1200 },
      { cursor: "confirm", click: true, set: { confirmed: true }, caption: "Confirm speakers as they reply.", hold: 900 },
      { set: { issued: true }, highlight: "credits", caption: "After each session, credits go to the attendees who were there.", hold: 2100 },
    ]),
  },
  qa: {
    Scene: QaScene,
    script: flow({ boost: 0, answered: null }, [
      { caption: "The audience posts questions from their phones.", hold: 1100 },
      { set: { boost: 2 }, caption: "Upvotes push the popular ones up.", hold: 600 },
      { set: { boost: 6 }, hold: 900 },
      { cursor: "answer-b", click: true, set: { answered: "b" }, caption: "Answered questions step aside for the next one.", hold: 1800 },
    ]),
  },
  polls: {
    Scene: PollScene,
    script: flow({ votes: [0, 0, 0], closed: false }, [
      { caption: "Ask the room a question.", hold: 800 },
      { set: { votes: [12, 9, 5] }, highlight: "results", caption: "Votes stream in live.", hold: 600 },
      { set: { votes: [24, 28, 11] }, highlight: "results", hold: 600 },
      { set: { votes: [31, 40, 14] }, highlight: "results", hold: 700 },
      { cursor: "close", click: true, set: { closed: true }, caption: "Close it, and the winner is clear to everyone.", hold: 1900 },
    ]),
  },
  meetings: {
    Scene: MeetingScene,
    script: flow({ slot: null, booked: false }, [
      { caption: "Attendees see a sponsor's open slots.", hold: 1100 },
      { cursor: "slot-11:30", click: true, set: { slot: "11:30" }, caption: "They pick a time.", hold: 500 },
      { cursor: "book", click: true, set: { booked: true }, highlight: "agendas", caption: "It's booked, and it shows up in both people's agendas.", hold: 2000 },
    ]),
  },
  stream: {
    Scene: StreamScene,
    script: flow({ online: 1204, chat: [], message: "" }, [
      { highlight: "video", caption: "Stream the stage to people who couldn't make it.", hold: 1100 },
      { set: { online: 1251, chat: [CHAT[0]] }, highlight: "audience", caption: "The online audience grows alongside the room.", hold: 700 },
      { set: { online: 1312, chat: CHAT }, highlight: "audience", hold: 800 },
      { cursor: "message", type: "message", set: { message: "Great set!" }, caption: "And they join the conversation.", hold: 200 },
      { cursor: "send", click: true, set: { message: "", chat: [...CHAT, ["You", "Great set!"]] }, hold: 1500 },
    ]),
  },
  replays: {
    Scene: ReplayScene,
    script: flow({ published: false, processing: false, vip: false, playing: null }, [
      { caption: "When a session ends…", hold: 800 },
      { set: { published: true, processing: true }, highlight: "library", caption: "…its recording lands in the replay library.", hold: 900 },
      { set: { processing: false }, hold: 600 },
      { cursor: "access-1", click: true, set: { vip: true }, caption: "Choose who can watch it.", hold: 800 },
      { cursor: "play-Opening set", click: true, set: { playing: "Opening set" }, caption: "Ticket holders watch on demand.", hold: 1600 },
    ]),
  },
  captions: {
    Scene: CaptionScene,
    script: flow({ line: "", search: "", jumped: false }, [
      { type: "line", set: { line: "Ticket pricing was the hardest call." }, caption: "Captions appear live, word by word.", hold: 700 },
      { cursor: "search", type: "search", set: { search: "pricing" }, caption: "Afterwards, search the transcript…", hold: 300 },
      { cursor: "line-14:20", click: true, set: { jumped: true }, caption: "…and jump straight to that moment.", hold: 1900 },
    ]),
  },
};
