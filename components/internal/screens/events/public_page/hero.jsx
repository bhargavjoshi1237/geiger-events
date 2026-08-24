"use client";

import { Clock, MapPin, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/internal/screens/discovery/public_follow";
import { cn } from "@/lib/utils";

import { EVENT_TYPE_MAP, formatDate, initials } from "../sample_data";
import { resolveGallery, coverKind } from "@/lib/events/gallery";
import { PhotoGallery } from "../page_gallery";

export function CoverImage({ event }) {
  if (!event.coverUrl) return null;
  if (coverKind(event.coverUrl) === "video") {
    // A video cover plays muted on its own — the hero has no player chrome for
    // it, and browsers require mute + playsInline for autoplay anyway.
    return (
      <video
        src={event.coverUrl}
        autoPlay
        muted
        loop
        playsInline
        className="pointer-events-none h-full w-full object-cover"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.coverUrl}
      alt={`${event.name} cover`}
      className="h-full w-full object-cover"
    />
  );
}

export function venueLine(event) {
  return `${event.venue}${event.city && event.city !== "Remote" ? `, ${event.city}` : ""}`;
}

function TitleMeta({ event, themed, theme, tags, centered, onVenueClick }) {
  return (
    <div className={cn("space-y-4", centered && "text-center")}>
      <div className={cn("flex flex-wrap gap-2", centered && "justify-center")}>
        {tags.map((t) => (
          <Badge key={t} variant="neutral">
            {t}
          </Badge>
        ))}
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {event.name}
      </h1>
      {themed && theme.tagline ? (
        <p
          className={cn(
            "max-w-2xl text-base text-text-secondary",
            centered && "mx-auto",
          )}
        >
          {theme.tagline}
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground",
          centered && "justify-center",
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-text-secondary" />
          {formatDate(event.date)} · {event.time}
        </span>
        {event.venueId ? (
          <button
            type="button"
            onClick={onVenueClick}
            className="flex items-center gap-2 text-left transition-colors hover:text-foreground"
          >
            <MapPin className="h-4 w-4 text-text-secondary" />
            <span className="underline decoration-dotted underline-offset-4">
              {venueLine(event)}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-text-secondary" />
            {venueLine(event)}
          </span>
        )}
      </div>
    </div>
  );
}

export function galleryStripOf(event, effective) {
  const gallery = Array.isArray(event.gallery) ? event.gallery : [];
  return effective.showGallery && gallery.length ? (
    <PhotoGallery
      items={gallery}
      settings={resolveGallery(event.galleryDisplay)}
    />
  ) : null;
}

function CoverWrap({ event, effective, TypeIcon }) {
  const strip = galleryStripOf(event, effective);
  if (!event.coverUrl && !strip) return null;

  return (
    <div className="space-y-3">
      {event.coverUrl ? (
        <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-border">
          <CoverImage event={event} />
          <div className="absolute left-4 top-4 flex gap-2">
            <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
              <TypeIcon className="h-3 w-3" />
              {event.type}
            </Badge>
          </div>
        </div>
      ) : null}
      {strip}
    </div>
  );
}

export function HostsBlock({ event, hosts }) {
  if (!hosts.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-5">
      {hosts.map((h, i) => (
        <div key={h.name} className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            {/* A host avatar is as often a brand mark as a face, and AvatarImage
                is only `aspect-square size-full` — an <img> with no object-fit
                stretches, so a wide wordmark arrives visibly squashed. Contain
                letterboxes it instead; the inset keeps the extremes off the
                circular mask. Square photos are unaffected. */}
            {h.avatarUrl ? (
              <AvatarImage src={h.avatarUrl} alt="" className="object-contain p-1" />
            ) : null}
            <AvatarFallback className="bg-surface-card text-sm text-muted-foreground">
              {initials(h.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-text-secondary">
              {i === 0 ? "Hosted by" : "Co-host"}
            </p>
            <p className="text-sm font-medium text-foreground">{h.name}</p>
          </div>
        </div>
      ))}
      {event.projectId ? (
        <FollowButton
          projectId={event.projectId}
          organiserName={hosts[0]?.name}
          subtle
          className="sm:ml-auto"
        />
      ) : null}
    </div>
  );
}

export function BannerHero({ event, tags, coverClass, coverStyle, bannerOverlay }) {
  return (
    <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
      <div
        className={cn(
          "relative flex aspect-[21/9] items-center justify-center overflow-hidden text-text-tertiary",
          event.coverUrl ? "" : coverClass,
        )}
        style={event.coverUrl ? undefined : coverStyle}
      >
        <CoverImage event={event} />
      </div>
      {bannerOverlay ? (
        <div className="pointer-events-none absolute inset-0" style={bannerOverlay} />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {event.name}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatDate(event.date)} · {event.time}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {venueLine(event)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroRegion({
  event,
  effective,
  hero,
  themed,
  theme,
  tags,
  TypeIcon,
  hosts,
  onVenueClick,
}) {
  if (hero === "none") return null;

  const cover = <CoverWrap event={event} effective={effective} TypeIcon={TypeIcon} />;
  const title = (centered) => (
    <TitleMeta
      event={event}
      themed={themed}
      theme={theme}
      tags={tags}
      centered={centered}
      onVenueClick={onVenueClick}
    />
  );

  return (
    <>
      {hero === "classic" ? (
        <>
          {cover}
          {title(false)}
        </>
      ) : null}
      {hero === "centered" ? (
        <>
          {title(true)}
          {cover}
        </>
      ) : null}
      {hero === "minimal" ? title(false) : null}
      {hero === "banner" ? galleryStripOf(event, effective) : null}
      <HostsBlock event={event} hosts={hosts} />
    </>
  );
}
