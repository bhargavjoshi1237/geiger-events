"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Clock,
  Facebook,
  Github,
  Globe,
  Instagram,
  LayoutGrid,
  Linkedin,
  List,
  Search,
  Twitch,
  Twitter,
  X,
  Youtube,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  resolveTheme,
  themeStyle,
  themeAccent,
  themeFontFaceCss,
  themeWebfonts,
  resolveWidth,
  pageBackgroundVideo,
} from "@/lib/events/theme";
import { PageFooter } from "../page_footer";
import { FollowButton } from "@/components/internal/screens/discovery/public_follow";
import { resolveLayout } from "./wall_layout";
import {
  applyFilters,
  byStatus,
  formatClock,
  gmtOffsetLabel,
  typeCounts,
} from "./wall_agenda";
import { WallEventList } from "./wall_event_list";
import { WallSidebar } from "./wall_calendar";

// The published Event Wall (/w/<slug>): an organiser's identity above a
// date-grouped agenda, with a calendar, an upcoming/past switch, and a map of
// where the events are alongside it.
//
// Status, type, day, search, and view are viewer state — the wall's saved
// `filters` and `layout` only seed them, so browsing never writes anything back.

const SOCIAL_ICONS = [
  [/instagram\./i, Instagram],
  [/(twitter\.|x\.com)/i, Twitter],
  [/(youtube\.|youtu\.be)/i, Youtube],
  [/linkedin\./i, Linkedin],
  [/facebook\./i, Facebook],
  [/github\./i, Github],
  [/twitch\./i, Twitch],
];

// Match a link to its brand icon by host, falling back to a globe. Matching on
// the URL rather than the label means an unlabelled link still gets its icon.
function socialIcon(link) {
  const haystack = `${link.url || ""} ${link.label || ""}`;
  for (const [pattern, Icon] of SOCIAL_ICONS) {
    if (pattern.test(haystack)) return Icon;
  }
  return Globe;
}

// A single half-minute clock shared by every readout on the page. It's an
// external store rather than state-in-an-effect so the snapshot stays stable
// between ticks, and so the server snapshot can be `null`: the server has no
// idea what timezone the reader is in, and rendering a guess mismatches on
// hydration for every visitor outside UTC.
let clockNow = null;
const clockListeners = new Set();
let clockTimer = null;

function subscribeClock(onChange) {
  clockListeners.add(onChange);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((listener) => listener());
    }, 30000);
  }
  return () => {
    clockListeners.delete(onChange);
    if (!clockListeners.size) {
      clearInterval(clockTimer);
      clockTimer = null;
      clockNow = null;
    }
  };
}

function useLocalNow() {
  const stamp = useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => null,
  );
  return stamp ? new Date(stamp) : null;
}

// Compact "4:56 PM GMT+5:30" for the route's top bar.
export function WallClock({ className }) {
  const now = useLocalNow();
  return (
    <span className={cn("text-sm text-text-secondary tabular-nums", className)}>
      {now ? `${formatClock(now)} ${gmtOffsetLabel(now)}` : ""}
    </span>
  );
}

// "Times in GMT+5:30 — 4:56 PM", under the organiser's name.
function LocalTimeLine() {
  const now = useLocalNow();

  return (
    <p className="flex h-5 items-center gap-1.5 text-sm text-text-secondary">
      {now ? (
        <>
          <Clock className="h-3.5 w-3.5" />
          Times in {gmtOffsetLabel(now)} —{" "}
          <span className="text-text-tertiary">{formatClock(now)}</span>
        </>
      ) : null}
    </p>
  );
}

function SocialLinks({ profile }) {
  const links = [
    ...(profile?.website ? [{ url: profile.website, label: "Website" }] : []),
    ...(Array.isArray(profile?.links) ? profile.links.filter((l) => l?.url) : []),
  ];
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {links.map((link, i) => {
        const Icon = socialIcon(link);
        return (
          <a
            key={`${link.url}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label || link.url}
            title={link.label || link.url}
            className="text-text-secondary transition-colors hover:text-foreground"
          >
            <Icon className="h-[18px] w-[18px]" />
          </a>
        );
      })}
    </div>
  );
}

// Cards / list switch, matching the pair of icon buttons in the section header.
function ViewToggle({ view, onView }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5">
      {[
        ["cards", LayoutGrid, "Card view"],
        ["list", List, "List view"],
      ].map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onView(key)}
          aria-label={label}
          aria-pressed={view === key}
          className={cn(
            "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
            view === key
              ? "bg-surface-active text-foreground"
              : "text-text-secondary hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

// Collapsed to an icon until used, so the header stays quiet on a wall with
// three events and still scales to one with sixty.
function SearchControl({ query, onQuery }) {
  const [open, setOpen] = useState(false);

  if (!open && !query) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search events"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-text-secondary transition-colors hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle pl-2.5 pr-1">
      <Search className="h-4 w-4 shrink-0 text-text-secondary" />
      <input
        autoFocus
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search events"
        aria-label="Search events"
        className="w-36 bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary sm:w-48"
      />
      <button
        type="button"
        onClick={() => {
          onQuery("");
          setOpen(false);
        }}
        aria-label="Clear search"
        className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TypeChips({ chips, type, onType, accent }) {
  if (chips.length < 2) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {chips.map(({ type: key, count }) => {
        const active = type === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onType(active ? "" : key)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              active
                ? "border-transparent"
                : "border-border bg-surface-subtle text-text-secondary hover:text-foreground",
            )}
            style={
              active ? { backgroundColor: accent.color, color: accent.text } : undefined
            }
          >
            {key}
            <span className={cn("text-xs", active ? "opacity-70" : "text-text-tertiary")}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Organiser identity: banner, overlapping avatar, name, local time, and socials.
function WallHero({ wall, profile, banner, accent }) {
  const name = profile?.displayName || wall?.name || "Our Events";
  const avatar = wall?.logoUrl || profile?.avatarUrl || "";
  const managedBy = profile?.displayName || wall?.name;

  return (
    <header className="relative">
      {banner ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="h-44 w-full object-cover sm:h-72" />
        </div>
      ) : null}

      <div className={cn("flex items-end justify-between gap-4", banner && "-mt-8")}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className=""
          />
        ) : (
          <span />
        )}
        <FollowButton
          projectId={profile?.projectId || wall?.projectId}
          organiserName={name}
        />
      </div>

      <div className="mt-5 space-y-2">
        {/* <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {name}
        </h1> */}
        <LocalTimeLine />
        {managedBy ? (
          <p className="text-sm text-text-secondary">Events managed by {managedBy}</p>
        ) : null}
        {wall?.tagline ? (
          <p className="max-w-xl text-sm text-text-secondary">{wall.tagline}</p>
        ) : null}
        {profile?.bio ? (
          <p className="max-w-2xl text-sm text-text-secondary">{profile.bio}</p>
        ) : null}
        <div className="pt-1">
          <SocialLinks profile={profile} />
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-64"
        style={{
          background: `radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, ${accent.color} 16%, transparent), transparent 72%)`,
        }}
      />
    </header>
  );
}

// Chrome-less body shared by the public route (app/w/[slug]/page.js).
export function WallPublicPageContent({ wall, events, profile }) {
  const theme = resolveTheme({ theme: wall?.theme });
  const accent = themeAccent(theme);
  const wrapperStyle = themeStyle(theme);
  const contentWidth = resolveWidth(theme);
  // A video background can't be painted via CSS background-image, so it renders
  // as a fixed layer under the content (raised with `relative z-10` below).
  const bgVideo = pageBackgroundVideo(theme);
  // A brand import can bring the source site's own typeface — either linked from
  // Google Fonts or re-hosted from its @font-face rules. Without these the page
  // asks for a family the browser has never heard of and falls back silently.
  const webfonts = themeWebfonts(theme);
  const fontFaceCss = themeFontFaceCss(theme);
  const layout = resolveLayout(wall?.layout);
  const banner = layout.header.bannerUrl || profile?.bannerUrl || "";

  const [view, setView] = useState(layout.defaultView);
  const [status, setStatus] = useState(
    wall?.filters?.status === "past" ? "past" : "upcoming",
  );
  const [type, setType] = useState("");
  const [day, setDay] = useState("");
  const [query, setQuery] = useState("");

  const scoped = useMemo(() => byStatus(events, status), [events, status]);
  const chips = useMemo(() => typeCounts(scoped), [scoped]);
  const visible = useMemo(
    () => applyFilters(scoped, { type, day, query }),
    [scoped, type, day, query],
  );

  // A day picked in one status doesn't exist in the other, and a type chip can
  // vanish with it — drop both rather than show an empty list with no cause.
  const changeStatus = (next) => {
    setStatus(next);
    setDay("");
    setType("");
  };

  const emptyMessage =
    type || day || query
      ? "No events match these filters."
      : status === "past"
        ? "No past events yet."
        : "No events to show right now — check back soon.";

  return (
    <div
      className="ev-themed min-h-screen bg-background text-foreground"
      style={wrapperStyle}
    >
      {webfonts.map((w) => (
        <link key={w.css} rel="stylesheet" href={w.css} precedence="default" />
      ))}
      {fontFaceCss ? (
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      ) : null}

      {bgVideo ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
        >
          <video
            src={bgVideo.url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
          />
          {bgVideo.scrim ? (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: bgVideo.scrim }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="relative z-10 isolate">
        <div
          className="mx-auto px-4 pb-12 pt-6 sm:px-6 lg:px-8"
          style={{ maxWidth: contentWidth }}
        >
          <WallHero wall={wall} profile={profile} banner={banner} accent={accent} />
        </div>

        {/* The agenda sits on its own band so the identity above it reads as a
            header rather than as the first item in the list. */}
        <div className="border-t border-border bg-surface-subtle/25">
          <div
            className="mx-auto px-4 py-10 sm:px-6 lg:px-8"
            style={{ maxWidth: contentWidth }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Events
              </h2>
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onView={setView} />
                <SearchControl query={query} onQuery={setQuery} />
              </div>
            </div>

            <TypeChips chips={chips} type={type} onType={setType} accent={accent} />

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <WallEventList
                events={visible}
                view={view}
                meta={layout.cardMeta}
                accent={accent}
                featuredIds={wall?.featured}
                emptyMessage={emptyMessage}
              />
              <WallSidebar
                events={scoped}
                status={status}
                onStatus={changeStatus}
                day={day}
                onDay={setDay}
                accent={accent}
              />
            </div>

            <PageFooter footer={wall?.footer} accent={accent} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WallPublicPageContent;
