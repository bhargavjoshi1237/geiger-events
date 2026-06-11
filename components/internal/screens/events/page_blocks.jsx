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
      {Icon ? <Icon className="h-5 w-5 text-text-secondary" /> : null}
      {children}
    </h2>
  );
}

// --- Smart event blocks (driven by the event record) -------------------------

function AboutBlock({ event }) {
  return (
    <section className="space-y-4">
      <SectionTitle>About this event</SectionTitle>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
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
    <div className="rounded-xl border border-border bg-surface-subtle p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-muted-foreground" /> What to expect
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {WHAT_TO_EXPECT.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
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
      <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
        {AGENDA.map((slot, i) => (
          <div
            key={slot.title}
            className={cn(
              "flex gap-4 p-4",
              i !== AGENDA.length - 1 && "border-b border-border",
            )}
          >
            <span className="w-16 shrink-0 text-sm font-medium tabular-nums text-text-secondary">
              {slot.time}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{slot.title}</p>
              {slot.by ? (
                <p className="text-xs text-text-secondary">{slot.by}</p>
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
        <p className="text-sm font-medium text-foreground">{event.venue}</p>
        {event.city && event.city !== "Remote" ? (
          <p className="text-sm text-text-secondary">
            61 Southwark Street, {event.city}
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Online — link sent after registration
          </p>
        )}
      </div>
      <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-card">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2a2a2a_1px,transparent_1px),linear-gradient(to_bottom,#2a2a2a_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
        <MapPin className="relative h-7 w-7 text-muted-foreground" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3">
          <Train className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Public transport</p>
            <p className="text-xs text-text-secondary">
              2 min from Southwark (Jubilee line)
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Parking</p>
            <p className="text-xs text-text-secondary">
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
            <Avatar key={n} className="h-9 w-9 border-2 border-background">
              <AvatarFallback className="bg-surface-active text-xs text-muted-foreground">
                {initials(n)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
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
          <AccordionItem key={f.q} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="text-left text-sm text-foreground hover:text-foreground hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
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
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {paragraphs.length ? (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      ) : (
        <p className="text-text-tertiary">Empty text block</p>
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
          className="w-full rounded-xl border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-[#3a3a3a]">
          <ImgIcon className="h-10 w-10" />
        </div>
      )}
      {props.caption ? (
        <figcaption className="text-center text-xs text-text-secondary">
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function VideoBlock({ props }) {
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-subtle text-muted-foreground">
        <Play className="h-6 w-6" />
      </div>
      {props.url ? (
        <span className="absolute bottom-3 left-3 max-w-[80%] truncate rounded bg-black/50 px-2 py-1 text-xs text-muted-foreground">
          {props.url}
        </span>
      ) : null}
    </div>
  );
}

function EmbedBlock({ props }) {
  return (
    <div className="flex min-h-[120px] flex-col justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card p-5 text-text-secondary">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-subtle p-8 text-center">
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
  return <hr className="border-border" />;
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
