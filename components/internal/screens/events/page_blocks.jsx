"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Clock, MapPin, Users, HelpCircle, Sparkles, Check, Train, Car, Image as ImgIcon, Play, Code as CodeIcon, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Quote, } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@geiger/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "@geiger/ui/accordion";
import { cn } from "@/lib/utils";
import { parseRichText } from "@/lib/events/richtext";
import { resolveGuestDisplay, GUEST_GRID_COLUMNS, GUEST_SHAPE_CLASS, GUEST_FIT_CLASS, } from "@/lib/events/guests";
import { initials } from "./sample_data";
import { getSectionNote, SectionNoteBadge } from "./public_page/section_note";
import { EventMap, NearbyList, WeatherCard, nearbyGroups, flattenPlaces, GETTING_THERE_GROUPS, AROUND_VENUE_GROUPS, } from "./event_map";
import { geocodeAddress } from "@/lib/map/geo";
import { getVenue } from "@/lib/supabase/venues";
import { formatScheduleTime } from "@/lib/events/schedule_items";
import { videoEmbed } from "@/lib/events/gallery";
import { ClipContent } from "@/components/internal/shared/web_clip/clip_content";
import { isClipFilled } from "@/lib/clip/model";
function SectionTitle({ icon: Icon, children }) {
    return (<h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
      {Icon ? <Icon className="h-5 w-5 text-text-secondary"/> : null}
      {children}
    </h2>);
}
const CLAMP_HEIGHT = 320;
const FADE_MASK = "linear-gradient(to bottom, #000 calc(100% - 5rem), transparent)";
function ClampedContent({ children, max = CLAMP_HEIGHT }) {
    const ref = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined")
            return;
        const measure = () => setOverflows(el.scrollHeight > max + 32);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [max]);
    const clipped = overflows && !expanded;
    return (<div>
      
      <div ref={ref} className="relative overflow-hidden" style={clipped
            ? {
                maxHeight: max,
                maskImage: FADE_MASK,
                WebkitMaskImage: FADE_MASK,
            }
            : undefined}>
        {children}
      </div>
      {overflows ? (<button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary">
          {expanded ? "Show less" : "Show more"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}/>
        </button>) : null}
    </div>);
}
function AboutBlock({ event }) {
    if (!String(event.description || "").trim())
        return null;
    return (<section className="space-y-4">
      <SectionTitle>About this event</SectionTitle>
      <ClampedContent>
        <RichText source={event.description}/>
      </ClampedContent>
    </section>);
}
function ExpectBlock({ event }) {
    const items = (Array.isArray(event.highlights) ? event.highlights : []).filter((h) => h?.title);
    if (!items.length)
        return null;
    return (<div className="rounded-xl border border-border bg-surface-subtle p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-muted-foreground"/> What to expect
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((h, i) => (<li key={h.id || i} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/>
            <span className="min-w-0 text-muted-foreground">
              <span className="font-medium text-foreground">{h.title}</span>
              {h.detail ? <> — {h.detail}</> : null}
            </span>
          </li>))}
      </ul>
    </div>);
}
function ScheduleItemCopy({ slot, onBg = false }) {
    return (<div className="min-w-0 flex-1">
      <p className={cn("text-sm font-medium", onBg ? "text-white" : "text-foreground")}>
        {slot.title}
      </p>
      {slot.description ? (<p className={cn("mt-0.5 text-sm leading-relaxed", onBg ? "text-white/85" : "text-muted-foreground")}>
          {slot.description}
        </p>) : null}
      {slot.by ? (<p className={cn("mt-0.5 text-xs", onBg ? "text-white/70" : "text-text-secondary")}>
          {slot.by}
        </p>) : null}
    </div>);
}
function ScheduleTime({ slot, onBg = false }) {
    if (!slot.time)
        return null;
    return (<span className={cn("shrink-0 whitespace-nowrap text-sm font-medium tabular-nums sm:min-w-[6.5rem]", onBg ? "text-white/90" : "text-text-secondary")}>
      {formatScheduleTime(slot.time)}
    </span>);
}
function scheduleImageFit(slot) {
    const fit = slot.imageFit || "cover";
    if (fit === "fit")
        return "object-contain";
    if (fit === "stretch")
        return "object-fill";
    return "object-cover";
}
function ScheduleSideImage({ slot, pos }) {
    if (!slot.image || (pos !== "left" && pos !== "right"))
        return null;
    return (<img src={slot.image} alt="" className={cn("h-16 w-24 shrink-0 rounded-lg border border-border", scheduleImageFit(slot), pos === "right" && "order-last")}/>);
}
function ScheduleTopImage({ slot, pos, className }) {
    if (!slot.image || pos !== "top")
        return null;
    return (<img src={slot.image} alt="" className={cn("w-full rounded-lg border border-border", scheduleImageFit(slot), className || "h-40")}/>);
}
function ScheduleBackground({ slot }) {
    return (<div className="relative min-h-[10rem] overflow-hidden rounded-xl border border-border">
      
      <img src={slot.image} alt="" className={cn("absolute inset-0 h-full w-full", scheduleImageFit(slot))}/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20"/>
      <div className="relative z-10 flex flex-col gap-2 p-4 sm:flex-row sm:gap-4">
        <ScheduleTime slot={slot} onBg/>
        <ScheduleItemCopy slot={slot} onBg/>
      </div>
    </div>);
}
const SCHEDULE_GAP_CLASSES = {
    tight: { pad: "p-3", grid: "gap-2.5", stack: "space-y-5", rail: -1.25 },
    normal: { pad: "p-4", grid: "gap-4", stack: "space-y-7", rail: -1.75 },
    wide: { pad: "p-5", grid: "gap-6", stack: "space-y-10", rail: -2.5 },
};
function ScheduleHtmlItem({ slot }) {
    return (<div className="ev-raw-html" dangerouslySetInnerHTML={{ __html: slot.description }}/>);
}
function isHtmlSlot(slot) {
    return slot.contentType === "html" && !!String(slot.description || "").trim();
}
function isClipSlot(slot) {
    return slot.contentType === "clip" && isClipFilled(slot.clip);
}
function isStandaloneSlot(slot) {
    return isHtmlSlot(slot) || isClipSlot(slot);
}
function ScheduleStandalone({ slot }) {
    if (isClipSlot(slot))
        return <ClipContent clip={slot.clip}/>;
    return <ScheduleHtmlItem slot={slot}/>;
}
export function ScheduleSlot({ slot, topClass = "mb-3 h-40", bodyGap = "gap-2" }) {
    if (isStandaloneSlot(slot))
        return <ScheduleStandalone slot={slot}/>;
    const pos = slot.imagePosition || "left";
    const bg = !!slot.image && pos === "background";
    if (bg)
        return <ScheduleBackground slot={slot}/>;
    return (<>
      <ScheduleTopImage slot={slot} pos={pos} className={topClass}/>
      <div className={cn("flex flex-col sm:flex-row sm:gap-4", bodyGap)}>
        <ScheduleTime slot={slot}/>
        <ScheduleSideImage slot={slot} pos={pos}/>
        <ScheduleItemCopy slot={slot}/>
      </div>
    </>);
}
function ScheduleListItems({ items, gapClass, bare = false }) {
    if (bare) {
        return (<div className={gapClass.stack}>
          {items.map((slot) => (<ScheduleSlot key={slot.id || slot.title} slot={slot}/>))}
        </div>);
    }
    return (<>
      {items.map((slot, i) => (<div key={slot.id || slot.title} className={cn(gapClass.pad, i !== items.length - 1 && "border-b border-border")}>
          <ScheduleSlot slot={slot}/>
        </div>))}
    </>);
}
function ScheduleFlexItems({ items, gapClass }) {
    return (<div className={cn("grid sm:grid-cols-2", gapClass.grid)}>
      {items.map((slot) => (isStandaloneSlot(slot)
            ? (<ScheduleStandalone key={slot.id || slot.title} slot={slot}/>)
            : (<div key={slot.id || slot.title} className="overflow-hidden rounded-xl border border-border bg-surface-card">
                <ScheduleSlot slot={slot} topClass="h-36" bodyGap="gap-3 p-4"/>
              </div>)))}
    </div>);
}
function ScheduleTimelineItems({ items, gapClass }) {
    return (<ol className={cn("relative", gapClass.stack)}>
      {items.map((slot, i) => {
            const last = i === items.length - 1;
            return (<li key={slot.id || slot.title} className="relative pl-10">
            
            {!last ? (<span className="absolute left-[0.375rem] top-2 w-px bg-border" style={{
                        bottom: `${gapClass.rail || 0}rem`,
                    }}/>) : null}
            <span className="absolute left-0 top-1.5 h-[13px] w-[13px] rounded-full border-2 border-border bg-surface-card"/>
            {isStandaloneSlot(slot) ? (<ScheduleStandalone slot={slot}/>) : (<ScheduleSlot slot={slot} topClass="mb-2 h-32"/>)}
          </li>);
        })}
    </ol>);
}
function ScheduleBlock({ event }) {
    const items = Array.isArray(event.schedule) ? event.schedule : [];
    if (!items.length)
        return null;
    const head = items[0] || {};
    const layout = head.layout || "list";
    const gapClass = SCHEDULE_GAP_CLASSES[head.spacing] || SCHEDULE_GAP_CLASSES.normal;
    const bare = head.frame === "bare";
    const note = String(head.sectionNote || "").trim();
    const inner = layout === "flex" || layout === "cards" ? (<div className={cn(!bare && "p-3")}>
            <ScheduleFlexItems items={items} gapClass={gapClass}/>
          </div>) : layout === "timeline" ? (<div className="p-4 sm:p-5">
            <ScheduleTimelineItems items={items} gapClass={gapClass}/>
          </div>) : (<ScheduleListItems items={items} gapClass={gapClass} bare={bare}/>);
    return (<section className="space-y-4">
      <SectionTitle icon={Clock}>Schedule</SectionTitle>
      {note ? (<p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
          {note}
        </p>) : null}
      {bare ? (inner) : (<div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
          {inner}
        </div>)}
    </section>);
}
function NoteCard({ icon: Icon, title, text }) {
    return (<div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-text-secondary">{text}</p>
      </div>
    </div>);
}
function LocationBlock({ event }) {
    const m = event.map || {};
    const coords = m.coords;
    const isRemote = event.city === "Remote";
    const address = event.address || event.city || "";
    const gettingThere = nearbyGroups(m, GETTING_THERE_GROUPS);
    const aroundVenue = nearbyGroups(m, AROUND_VENUE_GROUPS);
    const mapPlaces = useMemo(() => flattenPlaces(event.map), [event.map]);
    const [venueCoords, setVenueCoords] = useState(null);
    useEffect(() => {
        if (coords || !event.venueId || isRemote)
            return undefined;
        let alive = true;
        getVenue(event.venueId).then((v) => {
            if (!alive || !v)
                return;
            const has = v.latitude != null &&
                v.longitude != null &&
                v.latitude !== "" &&
                v.longitude !== "";
            if (has)
                setVenueCoords({ lat: Number(v.latitude), lng: Number(v.longitude) });
        });
        return () => {
            alive = false;
        };
    }, [coords, event.venueId, isRemote]);
    const pin = coords || venueCoords;
    const [autoCenter, setAutoCenter] = useState(null);
    const geocodedFor = useRef("");
    useEffect(() => {
        if (pin || isRemote || !address || geocodedFor.current === address)
            return undefined;
        geocodedFor.current = address;
        let alive = true;
        geocodeAddress(address).then((g) => {
            if (alive && g)
                setAutoCenter({ lat: g.lat, lng: g.lng });
        });
        return () => {
            alive = false;
        };
    }, [address, pin, isRemote]);
    return (<section className="space-y-4">
      <SectionTitle icon={MapPin}>Location</SectionTitle>
      <div>
        <p className="text-sm font-medium text-foreground">{event.venue}</p>
        {!isRemote ? (<p className="text-sm text-text-secondary">
            {event.address || event.city}
          </p>) : (<p className="text-sm text-text-secondary">
            Online — link sent after registration
          </p>)}
      </div>

      {!isRemote ? (<EventMap coords={pin} places={mapPlaces} fallbackCenter={autoCenter} label={event.venue || event.name || "Venue"} address={address} className="aspect-[21/9] w-full"/>) : null}

      {!isRemote ? (<WeatherCard coords={pin || autoCenter} date={event.date}/>) : null}

      <NearbyList groups={[...gettingThere, ...aroundVenue]} collapse/>

      
      {m.transport || m.parking ? (<div className={cn("grid gap-3", m.transport && m.parking ? "sm:grid-cols-2" : "grid-cols-1")}>
          {m.transport ? (<NoteCard icon={Train} title="Getting there" text={m.transport}/>) : null}
          {m.parking ? (<NoteCard icon={Car} title="Parking" text={m.parking}/>) : null}
        </div>) : null}
    </section>);
}
function WhosGoingBlock({ event }) {
    const goingCount = event.sold;
    if (goingCount <= 0)
        return null;
    const capacity = Number(event.capacity) || 0;
    return (<section className="space-y-4">
      <SectionTitle icon={Users}>Who&apos;s going</SectionTitle>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-subtle p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-muted-foreground">
          <Users className="h-5 w-5"/>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <span className="text-base font-semibold text-foreground">
              {goingCount.toLocaleString("en-US")}
            </span>{" "}
            {goingCount === 1 ? "person is" : "people are"} going
          </p>
          {capacity > goingCount ? (<p className="text-xs text-text-secondary">
              {(capacity - goingCount).toLocaleString("en-US")} spots left of{" "}
              {capacity.toLocaleString("en-US")}
            </p>) : null}
        </div>
      </div>
    </section>);
}
function GuestPhoto({ guest, display, className }) {
    const frame = cn("overflow-hidden border border-border bg-surface-card", GUEST_SHAPE_CLASS[display.imageShape], className);
    if (guest.image) {
        const logoMode = display.imageFit === "contain";
        return (<img src={guest.image} alt="" className={cn(frame, "block", GUEST_FIT_CLASS[display.imageFit], logoMode && "bg-white p-2")}/>);
    }
    return (<div className={cn(frame, "flex items-center justify-center")}>
      <span className={cn("font-medium text-muted-foreground", display.layout === "grid" ? "text-xl" : "text-sm")}>
        {initials(guest.name || "?")}
      </span>
    </div>);
}
function GuestsBlock({ event }) {
    const guests = Array.isArray(event.guests) ? event.guests : [];
    const display = resolveGuestDisplay(event.guestsDisplay);
    if (!guests.length)
        return null;
    const carded = display.cardStyle === "card";
    const isGrid = display.layout === "grid";
    return (<section className="space-y-4">
      <SectionTitle icon={Users}>Guests</SectionTitle>
      <div className={isGrid
            ? cn("grid gap-x-6 gap-y-8", GUEST_GRID_COLUMNS[display.columns])
            : "flex flex-col gap-4"}>
        {guests.map((g, i) => (<div key={g.id || i} className={cn(isGrid ? "min-w-0" : "flex min-w-0 items-start gap-4", isGrid && display.align === "center" && "text-center", carded && "rounded-xl border border-border bg-surface-subtle p-4")}>
            <GuestPhoto guest={g} display={display} className={isGrid ? "w-full" : "w-14 shrink-0"}/>
            <div className={cn("min-w-0", isGrid && "mt-4")}>
              <p className="text-base font-semibold text-foreground">{g.name}</p>
              {g.role ? (<p className="mt-1 text-sm text-text-secondary">{g.role}</p>) : null}
              {g.company ? (<p className="text-sm font-semibold text-foreground">
                  {g.company}
                </p>) : null}
              {display.showBio && g.bio ? (<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {g.bio}
                </p>) : null}
            </div>
          </div>))}
      </div>
    </section>);
}
function FaqBlock({ event }) {
    const items = (Array.isArray(event.faq) ? event.faq : []).filter((f) => f?.q);
    if (!items.length)
        return null;
    return (<section className="space-y-4">
      <SectionTitle icon={HelpCircle}>Frequently Asked Questions</SectionTitle>
      <Accordion type="single" collapsible className="w-full">
        {items.map((f, i) => (<AccordionItem key={f.id || i} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="text-left text-sm text-foreground hover:text-foreground hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent>
              <RichText source={f.a}/>
            </AccordionContent>
          </AccordionItem>))}
      </Accordion>
    </section>);
}
function renderSpans(spans) {
    return spans.map((s, i) => {
        let content = s.text;
        if (s.bold) {
            content = <strong className="font-semibold text-foreground">{s.text}</strong>;
        }
        else if (s.italic) {
            content = <em>{s.text}</em>;
        }
        if (s.href) {
            return (<a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:opacity-80">
          {content}
        </a>);
        }
        return <React.Fragment key={i}>{content}</React.Fragment>;
    });
}
const RICH_HEADING_CLASS = {
    2: "text-xl font-semibold text-foreground",
    3: "text-base font-semibold text-foreground",
    4: "text-sm font-semibold text-foreground",
};
export function RichText({ source, className }) {
    const nodes = useMemo(() => parseRichText(source), [source]);
    if (!nodes.length)
        return null;
    return (<div className={cn("ev-prose space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
      {nodes.map((n, i) => {
            if (n.type === "heading") {
                const Tag = `h${n.level}`;
                return (<Tag key={i} className={RICH_HEADING_CLASS[n.level] || RICH_HEADING_CLASS[4]}>
              {renderSpans(n.spans)}
            </Tag>);
            }
            if (n.type === "list") {
                const Tag = n.ordered ? "ol" : "ul";
                return (<Tag key={i} className={cn("space-y-2 pl-5", n.ordered ? "list-decimal" : "list-disc")}>
              {n.items.map((spans, j) => (<li key={j} className="pl-1 marker:text-text-tertiary">
                  {renderSpans(spans)}
                </li>))}
            </Tag>);
            }
            return <p key={i}>{renderSpans(n.spans)}</p>;
        })}
    </div>);
}
function HeadingBlock({ props }) {
    return (<h2 className="text-2xl font-bold tracking-tight text-foreground">
      {props.text || "Heading"}
    </h2>);
}
function TextBlock({ props }) {
    const paragraphs = (props.text || "").split("\n").filter(Boolean);
    return (<div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {paragraphs.length ? (paragraphs.map((p, i) => <p key={i}>{p}</p>)) : (<p className="text-text-tertiary">Empty text block</p>)}
    </div>);
}
function ImageBlock({ props }) {
    return (<figure className="space-y-2">
      {props.url ? (<img src={props.url} alt={props.caption || ""} className="w-full rounded-xl border border-border object-cover"/>) : (<div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
          <ImgIcon className="h-10 w-10"/>
        </div>)}
      {props.caption ? (<figcaption className="text-center text-xs text-text-secondary">
          {props.caption}
        </figcaption>) : null}
    </figure>);
}
// Empty/unsupported state — also what an editor sees before pasting a URL.
function VideoPlaceholder({ url }) {
    return (<div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-subtle text-muted-foreground">
        <Play className="h-6 w-6"/>
      </div>
      {url ? (<span className="absolute bottom-3 left-3 max-w-[80%] truncate rounded bg-black/50 px-2 py-1 text-xs text-muted-foreground">
          {url}
        </span>) : null}
    </div>);
}
function VideoBlock({ props }) {
    const video = videoEmbed(props.url);
    if (!video)
        return <VideoPlaceholder url={props.url}/>;
    if (video.kind === "file") {
        return (<video src={video.embedUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl border border-border bg-black"/>);
    }
    return (<div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      <iframe src={video.embedUrl} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="h-full w-full border-0"/>
    </div>);
}
function EmbedBlock({ props }) {
    const code = String(props.code || "").trim();
    if (!code) {
        return (<div className="flex min-h-[120px] flex-col justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card p-5 text-text-secondary">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CodeIcon className="h-4 w-4"/> Embedded content
        </span>
        <code className="block truncate text-xs">{"<!-- paste embed code -->"}</code>
      </div>);
    }
    // Organizer-authored markup, same trust model as a schedule HTML item.
    // <script> injected this way never executes, so embeds work and scripts don't.
    return (<div className="ev-raw-html" dangerouslySetInnerHTML={{ __html: code }}/>);
}
function CtaBlock({ props, accent }) {
    return (<div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-subtle p-8 text-center">
      <p className="text-lg font-semibold text-foreground">
        {props.title || "Ready to join us?"}
      </p>
      <Button style={{ backgroundColor: accent.color, color: accent.text }} className="hover:opacity-90">
        {props.label || "Get Tickets"}
        <ArrowRight className="h-4 w-4"/>
      </Button>
    </div>);
}
function DividerBlock() {
    return <hr className="border-border"/>;
}
function RichTextBlock({ props }) {
    return <RichText source={props.text}/>;
}
function ColumnCell({ kind, text, url, caption }) {
    if (kind === "image") {
        if (!url) {
            return (<div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
          <ImgIcon className="h-8 w-8"/>
        </div>);
        }
        return (<figure className="space-y-2">
        
        <img src={url} alt={caption || ""} className="w-full rounded-xl border border-border object-cover"/>
        {caption ? (<figcaption className="text-xs text-text-secondary">{caption}</figcaption>) : null}
      </figure>);
    }
    return <RichText source={text}/>;
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
    return (<div className={cn("grid grid-cols-1 gap-6", COLUMN_RATIOS[props.ratio] || COLUMN_RATIOS["1:1"], COLUMN_ALIGN[props.align] || COLUMN_ALIGN.start)}>
      <ColumnCell kind={props.leftKind} text={props.leftText} url={props.leftUrl} caption={props.leftCaption}/>
      <ColumnCell kind={props.rightKind} text={props.rightText} url={props.rightUrl} caption={props.rightCaption}/>
    </div>);
}
function AccordionBlock({ props }) {
    const items = Array.isArray(props.items) ? props.items.filter((i) => i?.q) : [];
    if (!items.length)
        return null;
    return (<section className="space-y-4">
      {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (<AccordionItem key={i} value={`item-${i}`} className="border-border">
            <AccordionTrigger className="text-left text-sm text-foreground hover:text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent>
              <RichText source={item.a}/>
            </AccordionContent>
          </AccordionItem>))}
      </Accordion>
    </section>);
}
const SPACER_SIZES = { sm: "1rem", md: "2.5rem", lg: "5rem" };
function SpacerBlock({ props }) {
    return (<div aria-hidden style={{ height: SPACER_SIZES[props.size] || SPACER_SIZES.md }}/>);
}
function ButtonsBlock({ props, accent }) {
    const items = Array.isArray(props.items) ? props.items.filter((i) => i?.label) : [];
    if (!items.length)
        return null;
    return (<div className="flex flex-wrap gap-3">
      {items.map((item, i) => {
            const outline = item.style === "outline";
            return (<Button key={i} asChild variant={outline ? "outline" : "default"} style={outline
                    ? { borderColor: accent.color, color: accent.color }
                    : { backgroundColor: accent.color, color: accent.text }} className={cn("hover:opacity-90", outline && "bg-transparent")}>
            <a href={item.url || "#"}>{item.label}</a>
          </Button>);
        })}
    </div>);
}
const INFO_TITLE_ALIGN = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};
const INFO_GRID_COLS = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
    6: "sm:grid-cols-3 lg:grid-cols-6",
};
const INFO_FLEX_WIDTHS = {
    1: "sm:w-full",
    2: "sm:w-[48%]",
    3: "sm:w-[31%]",
    4: "sm:w-[23.5%]",
    5: "sm:w-[18.5%]",
    6: "sm:w-[15.3%]",
};
function InfoHeading({ title, align }) {
    if (!title)
        return null;
    return (<h2 className={cn("text-xl font-semibold text-foreground", INFO_TITLE_ALIGN[align] || INFO_TITLE_ALIGN.left)}>
      {title}
    </h2>);
}
function InfoCta({ label, url, accent }) {
    if (!label)
        return null;
    return (<a href={url || "#"} style={{ backgroundColor: accent.color, color: accent.text }} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
      {label}
      <ArrowRight className="h-4 w-4"/>
    </a>);
}
function InfoImage({ src, className, iconSize = "h-8 w-8" }) {
    if (src) {
        return <img src={src} alt="" loading="lazy" className={className}/>;
    }
    return (<div className={cn("flex items-center justify-center bg-surface-card text-text-tertiary", className)}>
      <ImgIcon className={iconSize}/>
    </div>);
}
function useSingleIndex(count, autoplay) {
    const [index, setIndex] = useState(0);
    const go = useCallback((n) => {
        setIndex(((n % count) + count) % count);
    }, [count]);
    useEffect(() => {
        if (!autoplay || count < 2)
            return undefined;
        if (typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            return undefined;
        }
        const id = setInterval(() => setIndex((p) => (p + 1) % count), 4500);
        return () => clearInterval(id);
    }, [autoplay, count]);
    return [index, go];
}
function SingleRotatorControl({ count, index, onChange, label }) {
    return (<div className="flex items-center justify-center gap-3">
      <button type="button" onClick={() => onChange((index - 1 + count) % count)} aria-label={`Previous ${label}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground">
        <ChevronLeft className="h-4 w-4"/>
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }, (_, n) => (<button key={n} type="button" onClick={() => onChange(n)} aria-label={`Go to ${label} ${n + 1}`} aria-current={n === index} className={cn("h-2 rounded-full transition-all", n === index
                ? "w-5 bg-foreground/80"
                : "w-2 bg-foreground/25 hover:bg-foreground/45")}/>))}
      </div>
      <button type="button" onClick={() => onChange((index + 1) % count)} aria-label={`Next ${label}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground">
        <ChevronRight className="h-4 w-4"/>
      </button>
    </div>);
}
function InfographicCarouselRow({ props }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((it) => it?.title || it?.image || it?.text);
    const trackRef = useRef(null);
    const indexRef = useRef(0);
    const [index, setIndex] = useState(0);
    const count = items.length;
    const syncIndex = () => {
        const el = trackRef.current;
        if (!el || !count)
            return;
        const next = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / 304)));
        indexRef.current = next;
        setIndex(next);
    };
    const step = useCallback((dir) => {
        const el = trackRef.current;
        if (!el)
            return;
        const target = Math.min(count - 1, Math.max(0, indexRef.current + dir));
        const card = el.children[target];
        if (card)
            el.scrollTo({ left: card.offsetLeft - 2, behavior: "smooth" });
        indexRef.current = target;
        setIndex(target);
    }, [count]);
    useEffect(() => {
        if (!props.autoplay || count < 2)
            return undefined;
        if (typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            return undefined;
        }
        const id = setInterval(() => step(1), 4500);
        return () => clearInterval(id);
    }, [props.autoplay, count, step]);
    if (!count)
        return null;
    const card = (it) => {
        const info = (<div className="space-y-1.5" style={it.textColor ? { color: it.textColor } : undefined}>
        {it.title ? (<p className="truncate text-base font-semibold">{it.title}</p>) : null}
        {it.text ? (<p className="line-clamp-3 text-sm leading-relaxed opacity-90">{it.text}</p>) : null}
        {it.link || it.ctaLabel ? (it.ctaColor ? (<span className="inline-flex items-center gap-1 rounded-lg px-4 py-2 pt-2 text-sm font-medium" style={{ backgroundColor: it.ctaColor, color: "#ffffff" }}>
              {it.ctaLabel || "Learn more"} <ArrowRight className="h-4 w-4"/>
            </span>) : (<span className="inline-flex items-center gap-1 pt-1 text-sm font-medium underline-offset-2">
              {it.ctaLabel || "Learn more"} <ArrowRight className="h-4 w-4"/>
            </span>)) : null}
      </div>);
        return it.image ? (<div className="relative flex min-h-[14rem] overflow-hidden">
        
        <img src={it.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>
        {it.textSide === "left" || it.textSide === "right" ? (<>
            <div className={cn("absolute inset-y-0 w-1/2", it.textSide === "left"
                    ? "left-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
                    : "right-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent")}/>
            <div className={cn("relative flex w-1/2 flex-col justify-end p-4 text-white", it.textSide === "left" ? "items-start" : "ml-auto items-end text-right")}>
              {info}
            </div>
          </>) : (<>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"/>
            <div className="relative flex w-full flex-col justify-end p-4 text-white">
              {info}
            </div>
          </>)}
      </div>) : (<div className="p-4 text-foreground">{info}</div>);
    };
    return (<section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <InfoHeading title={props.title} align={props.titleAlign}/>
        </div>
        {count > 1 ? (<div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous slide" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground disabled:opacity-30">
              <ChevronLeft className="h-4 w-4"/>
            </button>
            <button type="button" onClick={() => step(1)} disabled={index === count - 1} aria-label="Next slide" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground disabled:opacity-30">
              <ChevronRight className="h-4 w-4"/>
            </button>
          </div>) : null}
      </div>
      <div ref={trackRef} onScroll={syncIndex} className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it, i) => {
            return (<div key={i} className="w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-surface-subtle">
              {it.link ? (<a href={it.link} target="_blank" rel="noopener noreferrer" className="block">
                  {card(it)}
                </a>) : (card(it))}
            </div>);
        })}
      </div>
    </section>);
}
function InfographicCarouselSingle({ props }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((it) => it?.title || it?.image || it?.text);
    const count = items.length;
    const [index, go] = useSingleIndex(count, props.autoplay);
    const [dir, setDir] = useState(1);
    const move = (n) => {
        setDir(n > index || (count > 0 && index === count - 1 && n === 0) ? 1 : -1);
        go(n);
    };
    if (!count)
        return null;
    const it = items[Math.min(index, count - 1)];
    const info = (<div className="space-y-1.5" style={it.textColor ? { color: it.textColor } : undefined}>
      {it.title ? (<p className="truncate text-base font-semibold">{it.title}</p>) : null}
      {it.text ? (<p className="line-clamp-3 text-sm leading-relaxed opacity-90">{it.text}</p>) : null}
      {it.link || it.ctaLabel ? (it.ctaColor ? (<span className="inline-flex items-center gap-1 rounded-lg px-4 py-2 pt-2 text-sm font-medium" style={{ backgroundColor: it.ctaColor, color: "#ffffff" }}>
            {it.ctaLabel || "Learn more"} <ArrowRight className="h-4 w-4"/>
          </span>) : (<span className="inline-flex items-center gap-1 pt-0.5 text-sm font-medium underline-offset-2">
            {it.ctaLabel || "Learn more"} <ArrowRight className="h-4 w-4"/>
          </span>)) : null}
    </div>);
    const card = it.image ? (<div className="relative flex min-h-[14rem] overflow-hidden">
      
      <img src={it.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>
      {it.textSide === "left" || it.textSide === "right" ? (<>
          <div className={cn("absolute inset-y-0 w-1/2", it.textSide === "left"
                ? "left-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
                : "right-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent")}/>
          <div className={cn("relative flex w-1/2 flex-col justify-end p-4 text-white", it.textSide === "left" ? "items-start" : "ml-auto items-end text-right")}>
            {info}
          </div>
        </>) : (<>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"/>
          <div className="relative flex w-full flex-col justify-end p-4 text-white">
            {info}
          </div>
        </>)}
    </div>) : (<div className="p-4 text-foreground">{info}</div>);
    return (<section className="space-y-4">
      <InfoHeading title={props.title} align={props.titleAlign}/>
      <div key={index} className={cn("w-full overflow-hidden rounded-2xl border border-border bg-surface-subtle", dir > 0
            ? "animate-in slide-in-from-right-8 duration-300"
            : "animate-in slide-in-from-left-8 duration-300")}>
        {it.link ? (<a href={it.link} target="_blank" rel="noopener noreferrer" className="block">
            {card}
          </a>) : (card)}
      </div>
      {count > 1 ? (<SingleRotatorControl count={count} index={index} onChange={move} label="slide"/>) : null}
    </section>);
}
function InfographicCarousel({ props, accent }) {
    return props.mode === "single" ? (<InfographicCarouselSingle props={props}/>) : (<InfographicCarouselRow props={props} accent={accent}/>);
}
function InfographicSplit({ props, accent }) {
    if (!props.title && !props.text && !props.image && !props.ctaLabel)
        return null;
    const imageFirst = props.imageSide === "left";
    const info = (<div className="flex flex-col items-start justify-center gap-4 p-6 sm:p-9">
      {props.title ? (<h3 className={cn("text-2xl font-semibold text-foreground", INFO_TITLE_ALIGN[props.titleAlign] || INFO_TITLE_ALIGN.left)}>
          {props.title}
        </h3>) : null}
      {props.text ? (<p className="text-sm leading-relaxed text-muted-foreground">{props.text}</p>) : null}
      <InfoCta label={props.ctaLabel} url={props.ctaUrl} accent={accent}/>
    </div>);
    const image = (<InfoImage src={props.image} className="aspect-[4/3] w-full bg-surface-card object-cover sm:aspect-auto sm:h-full" iconSize="h-10 w-10"/>);
    return (<div className="grid grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-border bg-surface-subtle sm:grid-cols-2">
      {imageFirst ? image : info}
      {imageFirst ? info : image}
    </div>);
}
function quoteFigure(it) {
    return (<figure className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface-subtle p-5">
      <Quote className="h-5 w-5 shrink-0 text-text-tertiary"/>
      <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
        {it.quote}
      </blockquote>
      <figcaption className="flex items-center gap-3">
        {it.avatarUrl ? (<img src={it.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-border object-cover"/>) : (<span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-medium text-muted-foreground">
            {initials(it.name || "?")}
          </span>)}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {it.name || "Anonymous"}
          </p>
          {it.role ? (<p className="truncate text-xs text-text-secondary">{it.role}</p>) : null}
        </div>
      </figcaption>
    </figure>);
}
function InfographicQuotesGrid({ props }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((t) => t?.quote);
    if (!items.length)
        return null;
    const columns = Math.min(4, Math.max(2, Number(props.columns) || 3));
    return (<section className="space-y-4">
      <InfoHeading title={props.title} align={props.titleAlign}/>
      <div className={cn("grid grid-cols-1 gap-4", INFO_GRID_COLS[columns])}>
        {items.map((it, i) => (<div key={i} className="contents">
            {quoteFigure(it)}
          </div>))}
      </div>
    </section>);
}
function InfographicQuotesSingle({ props }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((t) => t?.quote);
    const count = items.length;
    const [index, go] = useSingleIndex(count, false);
    const [dir, setDir] = useState(1);
    const move = (n) => {
        setDir(n > index || (count > 0 && index === count - 1 && n === 0) ? 1 : -1);
        go(n);
    };
    if (!count)
        return null;
    return (<section className="space-y-4">
      <InfoHeading title={props.title} align={props.titleAlign}/>
      <div key={index} className={cn("mx-auto max-w-2xl", dir > 0
            ? "animate-in slide-in-from-right-8 duration-300"
            : "animate-in slide-in-from-left-8 duration-300")}>
        {quoteFigure(items[Math.min(index, count - 1)])}
      </div>
      {count > 1 ? (<SingleRotatorControl count={count} index={index} onChange={move} label="quote"/>) : null}
    </section>);
}
function InfographicQuotes({ props }) {
    return props.layout === "single" ? (<InfographicQuotesSingle props={props}/>) : (<InfographicQuotesGrid props={props}/>);
}
function InfographicFooter({ props, accent }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((it) => it?.title || it?.link);
    if (!items.length && !props.title && !props.note)
        return null;
    return (<div className="rounded-2xl border border-border bg-surface-subtle p-6 sm:p-8">
      <div className="space-y-4">
        <InfoHeading title={props.title} align={props.titleAlign}/>
        {items.length ? (<div className="flex flex-wrap gap-2.5">
            {items.map((it, i) => {
                const chip = (<span className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-surface-card px-3.5 py-2 text-sm text-foreground transition-colors hover:border-border-strong">
                  {it.image ? (<img src={it.image} alt="" className="h-4 w-4 object-contain"/>) : null}
                  <span className="max-w-[12rem] truncate font-medium">
                    {it.title || "Untitled"}
                  </span>
                  {it.ctaLabel ? (<span className="text-sm font-medium" style={{ color: accent.color }}>
                      {it.ctaLabel}
                    </span>) : null}
                </span>);
                return it.link ? (<a key={i} href={it.link} target="_blank" rel="noopener noreferrer">
                  {chip}
                </a>) : (<span key={i} className="inline-flex">
                  {chip}
                </span>);
            })}
          </div>) : null}
        {props.note ? (<p className="border-t border-border pt-4 text-xs leading-relaxed text-text-secondary">
            {props.note}
          </p>) : null}
      </div>
    </div>);
}
function showcaseCard(it) {
    const top = it.textSide === "top";
    const info = (<div className={cn(top ? "space-y-2" : "space-y-1.5")}>
      {it.title ? (<p className={cn(top
            ? "text-xl font-bold leading-tight tracking-tight sm:text-2xl"
            : "truncate text-base font-semibold")}>{it.title}</p>) : null}
      {it.text ? (<p className={cn(top
            ? "text-sm font-semibold leading-snug"
            : "line-clamp-3 text-sm leading-relaxed opacity-90")}>{it.text}</p>) : null}
      {it.link || it.ctaLabel ? (<span className={cn("inline-flex items-center gap-1 text-sm font-medium underline-offset-2", top ? "pt-1" : "pt-0.5")}>
          {it.ctaLabel || "Learn more"} <ArrowRight className="h-4 w-4"/>
        </span>) : null}
    </div>);
    if (!it.image)
        return <div className="p-4 text-foreground">{info}</div>;
    if (top) {
        return (<div className="relative flex min-h-[16rem] overflow-hidden sm:min-h-[21rem]">
      <InfoImage src={it.image} className="absolute inset-0 h-full w-full bg-surface-subtle object-cover"/>

      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent"/>
      <div className="relative flex w-full flex-col justify-start p-5 text-white sm:p-6">
        {info}
      </div>
    </div>);
    }
    return (<div className="relative flex min-h-[14rem] overflow-hidden">
      <InfoImage src={it.image} className="absolute inset-0 h-full w-full bg-surface-subtle object-cover"/>
      {it.textSide === "left" || it.textSide === "right" ? (<>
          <div className={cn("absolute inset-y-0 w-1/2", it.textSide === "left"
                ? "left-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
                : "right-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent")}/>
          <div className={cn("relative flex w-1/2 flex-col justify-end p-4 text-white", it.textSide === "left" ? "items-start" : "ml-auto items-end text-right")}>
            {info}
          </div>
        </>) : (<>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"/>
          <div className="relative flex w-full flex-col justify-end p-4 text-white">
            {info}
          </div>
        </>)}
    </div>);
}
function ShowcaseLightbox({ item, accent, onClose }) {
    const hasImage = !!item.image;
    return (<Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className={cn("max-w-5xl overflow-hidden p-0", hasImage ? "border-black/40 bg-black" : "bg-surface-subtle")}>
        <div className={cn("relative", hasImage && "min-h-[24rem] sm:min-h-[30rem]")}>
          {hasImage ? (<>
            <InfoImage src={item.image} className="absolute inset-0 h-full w-full object-cover" iconSize="h-10 w-10"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/30 sm:bg-gradient-to-r sm:from-black sm:via-black/85 sm:to-transparent"/>
          </>) : null}

          <div className={cn("relative flex flex-col justify-center gap-4 p-6 sm:p-10", hasImage ? "text-white sm:w-[55%] lg:w-[48%]" : "text-foreground")}>
            <DialogHeader className="gap-3">
              <DialogTitle className={cn("text-2xl font-bold leading-tight tracking-tight sm:text-3xl", hasImage && "text-white")}>
                {item.title || "Details"}
              </DialogTitle>
              {item.text ? (<DialogDescription className={cn("text-sm font-semibold leading-snug", hasImage ? "text-white/90" : "text-foreground")}>
                  {item.text}
                </DialogDescription>) : null}
            </DialogHeader>

            {item.details ? (<p className={cn("whitespace-pre-line text-sm leading-relaxed", hasImage ? "text-white/75" : "text-muted-foreground")}>
                {item.details}
              </p>) : null}

            {item.link || item.ctaLabel ? (<a href={item.link || item.ctaUrl || "#"} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: accent.color }}>
                {item.ctaLabel || "Learn more"}
                <ChevronRight className="h-4 w-4"/>
              </a>) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>);
}
function ShowcaseCardBody({ it, clickOpen, onShow }) {
    const inner = showcaseCard(it);
    if (clickOpen) {
        return (<button type="button" onClick={() => onShow(it)} aria-haspopup="dialog" className="block h-full w-full cursor-pointer text-left">
        {inner}
      </button>);
    }
    if (it.link) {
        return (<a href={it.link} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>);
    }
    return inner;
}
function InfographicShowcaseGrid({ props, accent }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((it) => it?.title || it?.image);
    const [openItem, setOpenItem] = useState(null);
    if (!items.length)
        return null;
    const columns = Math.min(6, Math.max(1, Number(props.columns) || 3));
    const flexMode = props.layoutMode === "flex";
    return (<section className="space-y-4">
      <InfoHeading title={props.title} align={props.titleAlign}/>
      {flexMode ? (<div className="flex flex-wrap gap-4">
          {items.map((it, i) => (<div key={i} className={cn("w-full overflow-hidden rounded-2xl border border-border bg-surface-subtle", INFO_FLEX_WIDTHS[columns])}>
              <ShowcaseCardBody it={it} clickOpen={props.clickOpen} onShow={setOpenItem}/>
            </div>))}
        </div>) : (<div className={cn("grid grid-cols-1 gap-4", INFO_GRID_COLS[columns])}>
          {items.map((it, i) => (<div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface-subtle">
              <ShowcaseCardBody it={it} clickOpen={props.clickOpen} onShow={setOpenItem}/>
            </div>))}
        </div>)}
      {openItem ? (<ShowcaseLightbox item={openItem} accent={accent} onClose={() => setOpenItem(null)}/>) : null}
    </section>);
}
function InfographicShowcaseSingle({ props, accent }) {
    const items = (Array.isArray(props.items) ? props.items : []).filter((it) => it?.title || it?.image);
    const count = items.length;
    const [index, go] = useSingleIndex(count, false);
    const [dir, setDir] = useState(1);
    const [openItem, setOpenItem] = useState(null);
    const move = (n) => {
        setDir(n > index || (count > 0 && index === count - 1 && n === 0) ? 1 : -1);
        go(n);
    };
    if (!count)
        return null;
    const it = items[Math.min(index, count - 1)];
    return (<section className="space-y-4">
      <InfoHeading title={props.title} align={props.titleAlign}/>
      <div key={index} className={cn("mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-surface-subtle", dir > 0
            ? "animate-in slide-in-from-right-8 duration-300"
            : "animate-in slide-in-from-left-8 duration-300")}>
        <ShowcaseCardBody it={it} clickOpen={props.clickOpen} onShow={setOpenItem}/>
      </div>
      {count > 1 ? (<SingleRotatorControl count={count} index={index} onChange={move} label="card"/>) : null}
      {openItem ? (<ShowcaseLightbox item={openItem} accent={accent} onClose={() => setOpenItem(null)}/>) : null}
    </section>);
}
function InfographicShowcase({ props, accent }) {
    return props.showOne ? (<InfographicShowcaseSingle props={props} accent={accent}/>) : (<InfographicShowcaseGrid props={props} accent={accent}/>);
}
const INFOGRAPHIC_RENDERERS = {
    carousel: InfographicCarousel,
    split: InfographicSplit,
    quotes: InfographicQuotes,
    footer: InfographicFooter,
    showcase: InfographicShowcase,
};
function InfographicsBlock({ event, accent }) {
    const blocks = (Array.isArray(event.infographics) ? event.infographics : []).filter((b) => INFOGRAPHIC_RENDERERS[b?.type]);
    if (!blocks.length)
        return null;
    return (<div className="space-y-10">
      {blocks.map((b) => {
            const Renderer = INFOGRAPHIC_RENDERERS[b.type];
            return <Renderer key={b.id || b.type} props={b.props || {}} accent={accent}/>;
        })}
    </div>);
}
export const BLOCK_RENDERERS = {
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
    infographics: InfographicsBlock,
};
const BLOCK_WIDTHS = { wide: "56rem", narrow: "40rem" };
const BLOCK_ALIGN = { left: "text-left", center: "text-center", right: "text-right" };
function BlockShell({ layout, accent, children }) {
    const width = BLOCK_WIDTHS[layout?.width];
    const align = BLOCK_ALIGN[layout?.align];
    const background = layout?.background || "none";
    const carded = background !== "none";
    if (!width && !align && !carded)
        return children;
    const style = {};
    if (width) {
        style.maxWidth = width;
        style.marginInline = "auto";
    }
    if (background === "brand") {
        style.backgroundColor = `color-mix(in srgb, ${accent.color} 12%, transparent)`;
        style.borderColor = `color-mix(in srgb, ${accent.color} 28%, transparent)`;
    }
    return (<div style={style} className={cn(align, carded && "rounded-2xl border p-6", background === "surface" && "border-border bg-surface-subtle")}>
      {children}
    </div>);
}
export function PageBlock({ block, event, accent }) {
    const Renderer = BLOCK_RENDERERS[block.type];
    if (!Renderer)
        return null;
    const note = getSectionNote(event, block.type);
    const content = (<BlockShell layout={block.layout} accent={accent}>
      <Renderer event={event} props={block.props || {}} accent={accent}/>
    </BlockShell>);
    if (!note)
        return content;
    return (<div className="relative">
      <div className="absolute right-0 top-0 z-10">
        <SectionNoteBadge text={note}/>
      </div>
      {content}
    </div>);
}
