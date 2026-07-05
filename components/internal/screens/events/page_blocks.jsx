"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import {
  EventMap,
  NearbyList,
  WeatherCard,
  nearbyGroups,
  flattenPlaces,
  GETTING_THERE_GROUPS,
  AROUND_VENUE_GROUPS,
} from "./event_map";
import { geocodeAddress } from "@/lib/map/geo";
import { getVenue } from "@/lib/supabase/venues";

// Sample content for the "smart" event blocks. Stands in for real per-event
// data until the backend is connected.
const WHAT_TO_EXPECT = [
  "Welcome drinks & snacks on arrival",
  "Three lightning talks from the community",
  "Plenty of time to network and meet people",
  "An open Q&A with the host",
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

function ScheduleBlock({ event }) {
  // Real, organizer-authored timeline only (stored on the event's metadata bag
  // and edited in the Schedule section). No static fallback — render nothing
  // until the organizer adds items, so the page never shows placeholder data.
  const items = Array.isArray(event.schedule) ? event.schedule : [];
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <SectionTitle icon={Clock}>Schedule</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
        {items.map((slot, i) => (
          <div
            key={slot.id || slot.title}
            className={cn(
              "flex gap-4 p-4",
              i !== items.length - 1 && "border-b border-border",
            )}
          >
            <span className="w-16 shrink-0 text-sm font-medium tabular-nums text-text-secondary">
              {slot.time}
            </span>
            {slot.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slot.image}
                alt=""
                className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{slot.title}</p>
              {slot.description ? (
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {slot.description}
                </p>
              ) : null}
              {slot.by ? (
                <p className="mt-0.5 text-xs text-text-secondary">{slot.by}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoteCard({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-text-secondary">{text}</p>
      </div>
    </div>
  );
}

function LocationBlock({ event }) {
  const m = event.map || {};
  const coords = m.coords;
  const isRemote = event.city === "Remote";
  const address = event.address || event.city || "";
  const gettingThere = nearbyGroups(m, GETTING_THERE_GROUPS);
  const aroundVenue = nearbyGroups(m, AROUND_VENUE_GROUPS);
  const mapPlaces = useMemo(() => flattenPlaces(event.map), [event.map]);

  // When the event has no pin of its own, fall back to the linked venue's
  // coordinates (the venue owns its location) so a venue picked at creation — or
  // geocoded after it was attached — still drops a real pin on the live map.
  const [venueCoords, setVenueCoords] = useState(null);
  useEffect(() => {
    if (coords || !event.venueId || isRemote) return undefined;
    let alive = true;
    getVenue(event.venueId).then((v) => {
      if (!alive || !v) return;
      const has =
        v.latitude != null &&
        v.longitude != null &&
        v.latitude !== "" &&
        v.longitude !== "";
      if (has) setVenueCoords({ lat: Number(v.latitude), lng: Number(v.longitude) });
    });
    return () => {
      alive = false;
    };
  }, [coords, event.venueId, isRemote]);

  // The pin the map centres on — the event's own saved coords, else the venue's.
  const pin = coords || venueCoords;

  // With no pin at all, lightly geocode the address so the map still centres on
  // the right area (centre-only — no pin).
  const [autoCenter, setAutoCenter] = useState(null);
  const geocodedFor = useRef("");
  useEffect(() => {
    if (pin || isRemote || !address || geocodedFor.current === address)
      return undefined;
    geocodedFor.current = address;
    let alive = true;
    geocodeAddress(address).then((g) => {
      if (alive && g) setAutoCenter({ lat: g.lat, lng: g.lng });
    });
    return () => {
      alive = false;
    };
  }, [address, pin, isRemote]);

  return (
    <section className="space-y-4">
      <SectionTitle icon={MapPin}>Location</SectionTitle>
      <div>
        <p className="text-sm font-medium text-foreground">{event.venue}</p>
        {!isRemote ? (
          <p className="text-sm text-text-secondary">
            {event.address || event.city}
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Online — link sent after registration
          </p>
        )}
      </div>

      {!isRemote ? (
        <EventMap
          coords={pin}
          places={mapPlaces}
          fallbackCenter={autoCenter}
          label={event.venue || event.name || "Venue"}
          address={address}
          className="aspect-[21/9] w-full"
        />
      ) : null}

      {!isRemote ? (
        <WeatherCard coords={pin || autoCenter} date={event.date} />
      ) : null}

      <NearbyList groups={gettingThere} collapse />
      <NearbyList groups={aroundVenue} collapse />

      {m.transport || m.parking ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {m.transport ? (
            <NoteCard icon={Train} title="Getting there" text={m.transport} />
          ) : null}
          {m.parking ? (
            <NoteCard icon={Car} title="Parking" text={m.parking} />
          ) : null}
        </div>
      ) : null}
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

function GuestsBlock({ event }) {
  const guests = Array.isArray(event.guests) ? event.guests : [];
  if (!guests.length) return null;
  return (
    <section className="space-y-4">
      <SectionTitle icon={Users}>Guests</SectionTitle>
      <div className="gap-4 flex flex-col">
        {guests.map((g, i) => (
          <div
            key={g.id || i}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4"
          >
            {g.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={g.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <Avatar className="h-14 w-14 shrink-0 border border-border">
                <AvatarFallback className="bg-surface-card text-sm text-muted-foreground">
                  {initials(g.name || "?")}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{g.name}</p>
              {g.role ? (
                <p className="text-xs font-medium text-text-secondary">{g.role}</p>
              ) : null}
              {g.bio ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {g.bio}
                </p>
              ) : null}
            </div>
          </div>
        ))}
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
  guests: GuestsBlock,
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
