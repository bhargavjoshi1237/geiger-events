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
  themeButtonStyle,
  themeFontFaceCss,
  themeWebfonts,
  resolveWidth,
  pageBackgroundVideo,
  DEFAULT_THEME,
} from "@/lib/events/theme";
import { PageFooter, socialsFromLinks } from "../page_footer";
import { coverKind } from "@/lib/events/gallery";
import { FollowButton } from "@/components/internal/screens/discovery/public_follow";
import { ctaHref, resolveCta, resolveLayout } from "./wall_layout";
import {
  applyFilters,
  byStatus,
  formatClock,
  gmtOffsetLabel,
  typeCounts,
} from "./wall_agenda";
import { WallEventList } from "./wall_event_list";
import { WallSidebar } from "./wall_calendar";

const SOCIAL_ICONS = [
  [/instagram\./i, Instagram],
  [/(twitter\.|x\.com)/i, Twitter],
  [/(youtube\.|youtu\.be)/i, Youtube],
  [/linkedin\./i, Linkedin],
  [/facebook\./i, Facebook],
  [/github\./i, Github],
  [/twitch\./i, Twitch],
];

function socialIcon(link) {
  const haystack = `${link.url || ""} ${link.label || ""}`;
  for (const [pattern, Icon] of SOCIAL_ICONS) {
    if (pattern.test(haystack)) return Icon;
  }
  return Globe;
}

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

export function WallClock({ className }) {
  const now = useLocalNow();
  return (
    <span className={cn("text-sm text-text-secondary tabular-nums", className)}>
      {now ? `${formatClock(now)} ${gmtOffsetLabel(now)}` : ""}
    </span>
  );
}

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

// A photo behind the whole top section, washed towards the page background so
// the name, tagline, and buttons stay legible whatever the organiser picks.
function heroScrim(theme) {
  const c = (theme || DEFAULT_THEME).colors;
  return `linear-gradient(to bottom, color-mix(in srgb, ${c.bg} 74%, transparent), color-mix(in srgb, ${c.bg} 93%, transparent))`;
}

function WallHero({ wall, profile, banner, headerBg, accent, theme, contentWidth }) {
  const name = profile?.displayName || wall?.name || "Our Events";
  const avatar = wall?.logoUrl || profile?.avatarUrl || "";
  const managedBy = profile?.displayName || wall?.name;
  const cta = resolveCta(wall?.cta);
  const showCta = Boolean(cta.label && cta.url);

  return (
    // Full-bleed: the header itself spans the whole viewport so the backdrop
    // reaches the edges. The inner content (banner, identity, actions) is
    // re-centred against contentWidth so it lines up with the Events section
    // below.
    <header className="relative w-full overflow-hidden">
      {headerBg ? (
        <>
          {/* A video link loops muted behind the header; anything else is
              treated as a still. Muted + playsInline is what lets a video
              autoplay on mobile. */}
          {coverKind(headerBg) === "video" ? (
            <video
              src={headerBg}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              tabIndex={-1}
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerBg}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ backgroundImage: heroScrim(theme) }}
          />
        </>
      ) : null}

      {banner ? (
        <div className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="h-44 w-full object-cover sm:h-72" />
        </div>
      ) : null}

      <div
        className="relative mx-auto px-4 pb-12 pt-6 sm:px-6 lg:px-8"
        style={{ maxWidth: contentWidth }}
      >
      {/* Top row: logo on the left, Follow on the right, both vertically
          centred against each other. The identity text (time, managed-by,
          tagline, bio, socials) and the CTA flow below in a single column. */}
      <div className={cn("flex justify-between gap-4", banner && "-mt-8")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            {avatar ? (
              // Height drives the size and width is capped, so a full-resolution
              // logo can't blow out the hero.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-14 w-auto max-w-[200px] object-contain object-left sm:h-16 sm:max-w-[280px]"
              />
            ) : (
              <span className="h-14 sm:h-16" aria-hidden />
            )}

            <FollowButton
              projectId={profile?.projectId || wall?.projectId}
              organiserName={name}
            />
          </div>

          <div className={cn("space-y-2", avatar && "mt-5")}>
            <LocalTimeLine />
            {managedBy ? (
              <p className="text-sm text-text-secondary">
                Events managed by {managedBy}
              </p>
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

          {showCta ? (
            <div className="mt-4 flex justify-end">
              <a
                href={ctaHref(cta)}
                target="_blank"
                rel="noopener noreferrer"
                style={themeButtonStyle({ ...theme, button: cta.style }, accent)}
                className="inline-flex h-9 max-w-[220px] items-center justify-center px-4 text-sm font-medium transition-opacity hover:opacity-90"
              >
                <span className="truncate">{cta.label}</span>
              </a>
            </div>
          ) : null}
        </div>
      </div>
      </div>

      {/* The accent glow stands in for the backdrop when no photo is set. */}
      {headerBg ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-64"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, ${accent.color} 16%, transparent), transparent 72%)`,
          }}
        />
      )}
    </header>
  );
}

export function WallPublicPageContent({ wall, events, profile }) {
  const theme = resolveTheme({ theme: wall?.theme });
  const accent = themeAccent(theme);
  const wrapperStyle = themeStyle(theme);
  const contentWidth = resolveWidth(theme);
  const bgVideo = pageBackgroundVideo(theme);
  const webfonts = themeWebfonts(theme);
  const fontFaceCss = themeFontFaceCss(theme);
  const layout = resolveLayout(wall?.layout);
  const banner = layout.header.bannerUrl || profile?.bannerUrl || "";
  const headerBg = wall?.headerBgUrl || "";

  // An organiser who filled in their public profile shouldn't have to retype
  // those links to get social buttons in the footer; anything set on the footer
  // itself wins.
  const profileSocials = useMemo(
    () =>
      socialsFromLinks([
        ...(profile?.website ? [{ url: profile.website }] : []),
        ...(Array.isArray(profile?.links) ? profile.links : []),
      ]),
    [profile],
  );

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
        <WallHero
          wall={wall}
          profile={profile}
          banner={banner}
          headerBg={headerBg}
          accent={accent}
          theme={theme}
          contentWidth={contentWidth}
        />

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

            <PageFooter
              footer={wall?.footer}
              accent={accent}
              fallbackSocials={profileSocials}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WallPublicPageContent;
