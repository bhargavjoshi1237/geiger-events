"use client";

import React from "react";
import {
  Clock,
  MapPin,
  Users,
  HelpCircle,
  Sparkles,
  Check,
  Train,
  Car,
  Image as ImgIcon,
  Play,
  Code as CodeIcon,
  ArrowRight,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { initials } from "./sample_data";

// Sample content for the "smart" event blocks. Stands in for real per-event
// data until the backend is connected.
const WHAT_TO_EXPECT = [
  "Welcome drinks & snacks on arrival",
  "Three lightning talks from the community",
  "Plenty of time to network and meet people",
  "An open Q&A with the host",
];

const AGENDA = [
  { time: "6:00", title: "Doors open & welcome drinks", by: null },
  { time: "6:30", title: "Opening remarks", by: "Ava Mitchell" },
  { time: "7:00", title: "Lightning talks", by: "Invited speakers" },
  { time: "8:00", title: "Networking & refreshments", by: null },
  { time: "9:00", title: "Wrap up", by: null },
];

const FAQ = [
  { q: "What's the refund policy?", a: "Full refunds are available up to 7 days before the event. After that, tickets are transferable but non-refundable." },
  { q: "Is the venue accessible?", a: "Yes — the venue has step-free access and accessible restrooms. Let us know your needs at registration." },
  { q: "Can I transfer my ticket?", a: "Absolutely. You can transfer a ticket to someone else from your order page at any time." },
  { q: "What should I bring?", a: "Just your ticket (the QR code in your confirmation) and photo ID for age-restricted events." },
];

const ATTENDEE_NAMES = [
  "Ava M", "Marco R", "Priya S", "Lena O", "Sam K", "Dani P",
  "Noah B", "Ivy C", "Theo L", "Mia W", "Jonas H", "Ruby T",
];

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
      {Icon ? <Icon className="h-5 w-5 text-[#737373]" /> : null}
      {children}
    </h2>
  );
}

// --- Smart event blocks (driven by the event record) -------------------------

function AboutBlock({ event }) {
  return (
    <section className="space-y-4">
      <SectionTitle>About this event</SectionTitle>
      <div className="space-y-3 text-sm leading-relaxed text-[#a3a3a3]">
        <p>
          Join us for {event.name} — a {event.type.toLowerCase()} event bringing
          the community together for an unforgettable evening of ideas,
          connection, and good company.
        </p>
        <p>
          Doors open at {event.time}. Whether it&apos;s your first time or
          you&apos;re a regular, you&apos;ll find a warm welcome, great
          conversation, and people who share your interests.
        </p>
      </div>
    </section>
  );
}

function ExpectBlock() {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#ededed]">
        <Sparkles className="h-4 w-4 text-[#a3a3a3]" /> What to expect
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {WHAT_TO_EXPECT.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-[#a3a3a3]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleBlock() {
  return (
    <section className="space-y-4">
      <SectionTitle icon={Clock}>Schedule</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
        {AGENDA.map((slot, i) => (
          <div
            key={slot.title}
            className={cn(
              "flex gap-4 p-4",
              i !== AGENDA.length - 1 && "border-b border-[#2a2a2a]",
            )}
          >
            <span className="w-16 shrink-0 text-sm font-medium tabular-nums text-[#737373]">
              {slot.time}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#ededed]">{slot.title}</p>
              {slot.by ? (
                <p className="text-xs text-[#737373]">{slot.by}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LocationBlock({ event }) {
  return (
    <section className="space-y-4">
      <SectionTitle icon={MapPin}>Location</SectionTitle>
      <div>
        <p className="text-sm font-medium text-[#ededed]">{event.venue}</p>
        {event.city && event.city !== "Remote" ? (
          <p className="text-sm text-[#737373]">
            61 Southwark Street, {event.city}
          </p>
        ) : (
          <p className="text-sm text-[#737373]">
            Online — link sent after registration
          </p>
        )}
      </div>
      <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#202020]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2a2a2a_1px,transparent_1px),linear-gradient(to_bottom,#2a2a2a_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
        <MapPin className="relative h-7 w-7 text-[#a3a3a3]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3">
          <Train className="mt-0.5 h-4 w-4 shrink-0 text-[#a3a3a3]" />
          <div>
            <p className="text-sm font-medium text-[#ededed]">Public transport</p>
            <p className="text-xs text-[#737373]">
              2 min from Southwark (Jubilee line)
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#a3a3a3]" />
          <div>
            <p className="text-sm font-medium text-[#ededed]">Parking</p>
            <p className="text-xs text-[#737373]">
              NCP Great Suffolk Street, 5 min walk
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhosGoingBlock({ event }) {
  const goingCount = event.sold;
  if (goingCount <= 0) return null;
  const avatars = ATTENDEE_NAMES.slice(0, Math.min(8, goingCount));
  return (
    <section className="space-y-4">
      <SectionTitle icon={Users}>Who&apos;s going</SectionTitle>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {avatars.map((n) => (
            <Avatar key={n} className="h-9 w-9 border-2 border-[#161616]">
              <AvatarFallback className="bg-[#242424] text-xs text-[#d4d4d4]">
                {initials(n)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="text-sm text-[#a3a3a3]">
          <span className="font-medium text-[#ededed]">
            {goingCount.toLocaleString()}
          </span>{" "}
          going
        </span>
      </div>
    </section>
  );
}

function FaqBlock() {
  return (
    <section className="space-y-4">
      <SectionTitle icon={HelpCircle}>Frequently asked questions</SectionTitle>
      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((f, i) => (
          <AccordionItem key={f.q} value={`faq-${i}`} className="border-[#2a2a2a]">
            <AccordionTrigger className="text-left text-sm text-[#ededed] hover:text-white hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-[#a3a3a3]">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

// --- Freeform content blocks (driven by block props) -------------------------

function HeadingBlock({ props }) {
  return (
    <h2 className="text-2xl font-bold tracking-tight text-white">
      {props.text || "Heading"}
    </h2>
  );
}

function TextBlock({ props }) {
  const paragraphs = (props.text || "").split("\n").filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-[#a3a3a3]">
      {paragraphs.length ? (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      ) : (
        <p className="text-[#525252]">Empty text block</p>
      )}
    </div>
  );
}

function ImageBlock({ props }) {
  return (
    <figure className="space-y-2">
      {props.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.url}
          alt={props.caption || ""}
          className="w-full rounded-xl border border-[#2a2a2a] object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] bg-[#202020] text-[#3a3a3a]">
          <ImgIcon className="h-10 w-10" />
        </div>
      )}
      {props.caption ? (
        <figcaption className="text-center text-xs text-[#737373]">
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function VideoBlock({ props }) {
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#202020]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a] text-[#a3a3a3]">
        <Play className="h-6 w-6" />
      </div>
      {props.url ? (
        <span className="absolute bottom-3 left-3 max-w-[80%] truncate rounded bg-black/50 px-2 py-1 text-xs text-[#a3a3a3]">
          {props.url}
        </span>
      ) : null}
    </div>
  );
}

function EmbedBlock({ props }) {
  return (
    <div className="flex min-h-[120px] flex-col justify-center gap-2 rounded-xl border border-dashed border-[#2a2a2a] bg-[#202020] p-5 text-[#737373]">
      <span className="flex items-center gap-2 text-sm font-medium text-[#a3a3a3]">
        <CodeIcon className="h-4 w-4" /> Embedded content
      </span>
      <code className="block truncate text-xs">
        {props.code || "<!-- paste embed code -->"}
      </code>
    </div>
  );
}

function CtaBlock({ props, accent }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
      <p className="text-lg font-semibold text-white">
        {props.title || "Ready to join us?"}
      </p>
      <Button
        style={{ backgroundColor: accent.color, color: accent.text }}
        className="hover:opacity-90"
      >
        {props.label || "Get tickets"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DividerBlock() {
  return <hr className="border-[#2a2a2a]" />;
}

const BLOCK_RENDERERS = {
  about: AboutBlock,
  expect: ExpectBlock,
  schedule: ScheduleBlock,
  location: LocationBlock,
  whosgoing: WhosGoingBlock,
  faq: FaqBlock,
  heading: HeadingBlock,
  text: TextBlock,
  image: ImageBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  cta: CtaBlock,
  divider: DividerBlock,
};

/** Renders a single page block by type. Returns null for unknown/empty blocks. */
export function PageBlock({ block, event, accent }) {
  const Renderer = BLOCK_RENDERERS[block.type];
  if (!Renderer) return null;
  return <Renderer event={event} props={block.props || {}} accent={accent} />;
}
