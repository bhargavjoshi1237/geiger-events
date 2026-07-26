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
  ChevronDown,
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
import { parseRichText } from "@/lib/events/richtext";
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

// Every smart block below renders organizer-authored data only — a block with
// nothing behind it returns null rather than inventing placeholder copy, so a
// half-filled event page is short instead of fictional.

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
      {Icon ? <Icon className="h-5 w-5 text-text-secondary" /> : null}
      {children}
    </h2>
  );
}

// --- Smart event blocks (driven by the event record) -------------------------

// Height a long description is clipped to before it collapses (px).
const CLAMP_HEIGHT = 320;

// Clips its children to a fixed height behind a faded "Show more" toggle. The
// toggle only appears when the content actually overflows, so short copy is
// untouched; a ResizeObserver re-measures when images or fonts settle.
function ClampedContent({ children, max = CLAMP_HEIGHT }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Ignore a few stray pixels — clipping those would be all cost, no benefit.
    const measure = () => setOverflows(el.scrollHeight > max + 32);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);

  const clipped = overflows && !expanded;
  return (
    <div>
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={clipped ? { maxHeight: max } : undefined}
      >
        {children}
        {clipped ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
        ) : null}
      </div>
      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

// The organizer's own description (Page → Rich Description), rendered through
// the markdown-lite parser so headings, lists, and links survive.
function AboutBlock({ event }) {
  if (!String(event.description || "").trim()) return null;
  return (
    <section className="space-y-4">
      <SectionTitle>About this event</SectionTitle>
      <ClampedContent>
        <RichText source={event.description} />
      </ClampedContent>
    </section>
  );
}

// Highlights authored in Page → What to expect: { id, title, detail }.
function ExpectBlock({ event }) {
  const items = (Array.isArray(event.highlights) ? event.highlights : []).filter(
    (h) => h?.title,
  );
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-muted-foreground" /> What to expect
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((h, i) => (
          <li key={h.id || i} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span className="min-w-0 text-muted-foreground">
              <span className="font-medium text-foreground">{h.title}</span>
              {h.detail ? <> — {h.detail}</> : null}
            </span>
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
              "flex flex-col gap-2 p-4 sm:flex-row sm:gap-4",
              i !== items.length - 1 && "border-b border-border",
            )}
          >
            {/* Times run to "2:00 PM PDT / 5:00 PM EDT" — keep them on one line
                and let the column size to the longest, rather than wrapping. */}
            {slot.time ? (
              <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-text-secondary sm:min-w-[6.5rem]">
                {slot.time}
              </span>
            ) : null}
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

      {/* One note stretches full width rather than leaving a half-empty row. */}
      {m.transport || m.parking ? (
        <div
          className={cn(
            "grid gap-3",
            m.transport && m.parking ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
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

// Attendee identities are private, so this reports the real count rather than
// standing in invented faces.
function WhosGoingBlock({ event }) {
  const goingCount = event.sold;
  if (goingCount <= 0) return null;
  const capacity = Number(event.capacity) || 0;
  return (
    <section className="space-y-4">
      <SectionTitle icon={Users}>Who&apos;s going</SectionTitle>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-subtle p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-muted-foreground">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <span className="text-base font-semibold text-foreground">
              {goingCount.toLocaleString()}
            </span>{" "}
            {goingCount === 1 ? "person is" : "people are"} going
          </p>
          {capacity > goingCount ? (
            <p className="text-xs text-text-secondary">
              {(capacity - goingCount).toLocaleString()} spots left of{" "}
              {capacity.toLocaleString()}
            </p>
          ) : null}
        </div>
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

// Questions authored in Page → FAQ: { id, q, a }. Answers accept markdown-lite.
function FaqBlock({ event }) {
  const items = (Array.isArray(event.faq) ? event.faq : []).filter((f) => f?.q);
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <SectionTitle icon={HelpCircle}>Frequently asked questions</SectionTitle>
      <Accordion type="single" collapsible className="w-full">
        {items.map((f, i) => (
          <AccordionItem
            key={f.id || i}
            value={`faq-${i}`}
            className="border-border"
          >
            <AccordionTrigger className="text-left text-sm text-foreground hover:text-foreground hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent>
              <RichText source={f.a} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

// --- Rich text ---------------------------------------------------------------

// One line's styled spans. Links open in a new tab; the parser has already
// dropped any non-navigable href.
function renderSpans(spans) {
  return spans.map((s, i) => {
    let content = s.text;
    if (s.bold) {
      content = <strong className="font-semibold text-foreground">{s.text}</strong>;
    } else if (s.italic) {
      content = <em>{s.text}</em>;
    }
    if (s.href) {
      return (
        <a
          key={i}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
        >
          {content}
        </a>
      );
    }
    return <React.Fragment key={i}>{content}</React.Fragment>;
  });
}

const RICH_HEADING_CLASS = {
  2: "text-xl font-semibold text-foreground",
  3: "text-base font-semibold text-foreground",
  4: "text-sm font-semibold text-foreground",
};

/** Renders markdown-lite copy (headings, paragraphs, lists, inline marks). */
export function RichText({ source, className }) {
  const nodes = useMemo(() => parseRichText(source), [source]);
  if (!nodes.length) return null;
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {nodes.map((n, i) => {
        if (n.type === "heading") {
          const Tag = `h${n.level}`;
          return (
            <Tag key={i} className={RICH_HEADING_CLASS[n.level] || RICH_HEADING_CLASS[4]}>
              {renderSpans(n.spans)}
            </Tag>
          );
        }
        if (n.type === "list") {
          const Tag = n.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={cn(
                "space-y-2 pl-5",
                n.ordered ? "list-decimal" : "list-disc",
              )}
            >
              {n.items.map((spans, j) => (
                <li key={j} className="pl-1 marker:text-text-tertiary">
                  {renderSpans(spans)}
                </li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{renderSpans(n.spans)}</p>;
      })}
    </div>
  );
}

// --- Freeform content blocks (driven by block props) -------------------------

function HeadingBlock({ props }) {
  return (
    <h2 className="text-2xl font-bold tracking-tight text-foreground">
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
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
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
      <p className="text-lg font-semibold text-foreground">
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

function RichTextBlock({ props }) {
  return <RichText source={props.text} />;
}

// One side of a columns block — either copy or a captioned image.
function ColumnCell({ kind, text, url, caption }) {
  if (kind === "image") {
    if (!url) {
      return (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
          <ImgIcon className="h-8 w-8" />
        </div>
      );
    }
    return (
      <figure className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={caption || ""}
          className="w-full rounded-xl border border-border object-cover"
        />
        {caption ? (
          <figcaption className="text-xs text-text-secondary">{caption}</figcaption>
        ) : null}
      </figure>
    );
  }
  return <RichText source={text} />;
}

const COLUMN_RATIOS = {
  "1:1": "sm:grid-cols-2",
  "1:2": "sm:grid-cols-[1fr_2fr]",
  "2:1": "sm:grid-cols-[2fr_1fr]",
};

const COLUMN_ALIGN = {
  start: "items-start",
  center: "items-center",
};

function ColumnsBlock({ props }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        COLUMN_RATIOS[props.ratio] || COLUMN_RATIOS["1:1"],
        COLUMN_ALIGN[props.align] || COLUMN_ALIGN.start,
      )}
    >
      <ColumnCell
        kind={props.leftKind}
        text={props.leftText}
        url={props.leftUrl}
        caption={props.leftCaption}
      />
      <ColumnCell
        kind={props.rightKind}
        text={props.rightText}
        url={props.rightUrl}
        caption={props.rightCaption}
      />
    </div>
  );
}

function AccordionBlock({ props }) {
  const items = Array.isArray(props.items) ? props.items.filter((i) => i?.q) : [];
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-border">
            <AccordionTrigger className="text-left text-sm text-foreground hover:text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent>
              <RichText source={item.a} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

const SPACER_SIZES = { sm: "1rem", md: "2.5rem", lg: "5rem" };

function SpacerBlock({ props }) {
  return (
    <div
      aria-hidden
      style={{ height: SPACER_SIZES[props.size] || SPACER_SIZES.md }}
    />
  );
}

function ButtonsBlock({ props, accent }) {
  const items = Array.isArray(props.items) ? props.items.filter((i) => i?.label) : [];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item, i) => {
        const outline = item.style === "outline";
        return (
          <Button
            key={i}
            asChild
            variant={outline ? "outline" : "default"}
            style={
              outline
                ? { borderColor: accent.color, color: accent.color }
                : { backgroundColor: accent.color, color: accent.text }
            }
            className={cn("hover:opacity-90", outline && "bg-transparent")}
          >
            <a href={item.url || "#"}>{item.label}</a>
          </Button>
        );
      })}
    </div>
  );
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
  richtext: RichTextBlock,
  columns: ColumnsBlock,
  accordion: AccordionBlock,
  spacer: SpacerBlock,
  buttons: ButtonsBlock,
};

// --- Per-block layout --------------------------------------------------------

const BLOCK_WIDTHS = { wide: "56rem", narrow: "40rem" };
const BLOCK_ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

// Wraps a block in its optional layout treatment (width, alignment, surface).
// A block with no layout renders exactly as before — the wrapper is skipped
// entirely so default pages keep their existing markup.
function BlockShell({ layout, accent, children }) {
  const width = BLOCK_WIDTHS[layout?.width];
  const align = BLOCK_ALIGN[layout?.align];
  const background = layout?.background || "none";
  const carded = background !== "none";
  if (!width && !align && !carded) return children;

  const style = {};
  if (width) {
    style.maxWidth = width;
    style.marginInline = "auto";
  }
  if (background === "brand") {
    style.backgroundColor = `color-mix(in srgb, ${accent.color} 12%, transparent)`;
    style.borderColor = `color-mix(in srgb, ${accent.color} 28%, transparent)`;
  }

  return (
    <div
      style={style}
      className={cn(
        align,
        carded && "rounded-2xl border p-6",
        background === "surface" && "border-border bg-surface-subtle",
      )}
    >
      {children}
    </div>
  );
}

/** Renders a single page block by type. Returns null for unknown/empty blocks. */
export function PageBlock({ block, event, accent }) {
  const Renderer = BLOCK_RENDERERS[block.type];
  if (!Renderer) return null;
  return (
    <BlockShell layout={block.layout} accent={accent}>
      <Renderer event={event} props={block.props || {}} accent={accent} />
    </BlockShell>
  );
}
