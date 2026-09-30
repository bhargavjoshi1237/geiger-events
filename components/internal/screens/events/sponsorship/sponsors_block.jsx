"use client";

import React from "react";
import { ArrowRight, Handshake } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { ctaHref, ctaIsExternal } from "@/lib/events/ctas";
import {
  marqueeSponsors,
  resolveSponsorsDisplay,
  sponsorCtaHref,
  sponsorGroups,
} from "@/lib/events/sponsorship";

const LOGO_HEIGHT = { sm: "h-8", md: "h-12", lg: "h-16", xl: "h-20" };
const STEP_UP = { sm: "md", md: "lg", lg: "xl" };
// Card widths rather than grid columns, so a short row can still centre.
const CARD_WIDTH = {
  3: "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)]",
  4: "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]",
  5: "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(20%-0.8rem)]",
};
const MUTED = "opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0";

function SponsorLink({ sponsor, display, className, children }) {
  const href = display.linkLogos ? ctaHref(sponsor.website) : null;
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={sponsor.name}>
      {children}
    </a>
  );
}

function Logo({ sponsor, display, size }) {
  if (!sponsor.logoUrl) {
    return <span className="text-base font-semibold text-foreground">{sponsor.name}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sponsor.logoUrl}
      alt={sponsor.name}
      className={cn(
        "w-auto max-w-[12rem] object-contain",
        LOGO_HEIGHT[size],
        display.logoStyle === "muted" && MUTED,
      )}
    />
  );
}

function Caption({ sponsor, display, showSpot }) {
  const spot = showSpot && display.showSpotLabels ? sponsor.spotName : "";
  if (!display.showNames && !spot) return null;
  return (
    <div className="min-w-0">
      {display.showNames && sponsor.logoUrl ? (
        <p className="truncate text-sm font-medium text-foreground">{sponsor.name}</p>
      ) : null}
      {spot ? <p className="truncate text-xs text-text-tertiary">{spot}</p> : null}
    </div>
  );
}

function Wall({ sponsors, display, size, showSpot }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-10 gap-y-6",
        display.align === "center" ? "justify-center" : "justify-start",
      )}
    >
      {sponsors.map((s) => (
        <SponsorLink
          key={s.id}
          sponsor={s}
          display={display}
          className={cn("flex flex-col gap-2", display.align === "center" ? "items-center text-center" : "items-start")}
        >
          <Logo sponsor={s} display={display} size={size} />
          <Caption sponsor={s} display={display} showSpot={showSpot} />
        </SponsorLink>
      ))}
    </div>
  );
}

function Cards({ sponsors, display, size, showSpot }) {
  const carded = display.cardStyle === "card";
  return (
    <div className={cn("flex flex-wrap gap-4", display.align === "center" ? "justify-center" : "justify-start")}>
      {sponsors.map((s) => (
        <SponsorLink
          key={s.id}
          sponsor={s}
          display={display}
          className={cn(
            "flex min-w-0 flex-col gap-3 rounded-xl p-4",
            CARD_WIDTH[display.columns],
            carded ? "border border-border bg-surface-subtle" : "",
            display.align === "center" ? "items-center text-center" : "items-start",
          )}
        >
          <div className="flex h-20 w-full items-center justify-center">
            <Logo sponsor={s} display={display} size={size} />
          </div>
          <Caption sponsor={s} display={display} showSpot={showSpot} />
        </SponsorLink>
      ))}
    </div>
  );
}

function List({ sponsors, display, size, showSpot }) {
  const carded = display.cardStyle === "card";
  return (
    <div className="flex flex-col gap-3">
      {sponsors.map((s) => (
        <SponsorLink
          key={s.id}
          sponsor={s}
          display={display}
          className={cn(
            "flex items-center gap-5 rounded-xl p-3",
            carded ? "border border-border bg-surface-subtle" : "",
          )}
        >
          <div className="flex w-28 shrink-0 items-center justify-center">
            <Logo sponsor={s} display={display} size={size} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{s.name}</p>
            {showSpot && display.showSpotLabels && s.spotName ? (
              <p className="text-xs text-text-tertiary">{s.spotName}</p>
            ) : null}
            {s.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{s.description}</p>
            ) : null}
          </div>
        </SponsorLink>
      ))}
    </div>
  );
}

// The track holds the logos twice and slides by half its width, so the loop never shows a seam.
function Marquee({ sponsors, display, size }) {
  const half = marqueeSponsors(sponsors);
  const duration = `${Math.max(20, half.length * 4)}s`;
  const item = (s, copy) => (
    <SponsorLink
      key={`${copy}-${s.id}`}
      sponsor={s}
      display={display}
      className="flex shrink-0 flex-col items-center gap-2 pr-12"
    >
      <Logo sponsor={s} display={display} size={size} />
      <Caption sponsor={s} display={display} showSpot />
    </SponsorLink>
  );
  return (
    <div
      className="overflow-hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)" }}
    >
      <div className="ev-sponsor-marquee flex w-max items-center" style={{ "--marquee-duration": duration }}>
        {half.map((s) => item(s, "a"))}
        <div aria-hidden className="flex items-center">
          {half.map((s) => item(s, "b"))}
        </div>
      </div>
    </div>
  );
}

const LAYOUTS = { wall: Wall, grid: Cards, list: List, marquee: Marquee };

function SponsorCta({ href, display, accent }) {
  const { cta } = display;
  const external = ctaIsExternal(href);
  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const btnStyle = accent ? { backgroundColor: accent.color, color: accent.text } : undefined;
  const center = display.align === "center";

  if (cta.style === "banner") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          {cta.heading ? <p className="text-base font-semibold text-foreground">{cta.heading}</p> : null}
          {cta.body ? <p className="text-sm text-text-secondary">{cta.body}</p> : null}
        </div>
        <Button asChild style={btnStyle} className="shrink-0 hover:opacity-90">
          <a href={href} {...linkProps}>
            {cta.label || "Become a sponsor"} <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  if (cta.style === "button") {
    return (
      <div className={cn("flex", center ? "justify-center" : "justify-start")}>
        <Button asChild style={btnStyle} className="hover:opacity-90">
          <a href={href} {...linkProps}>
            {cta.label || "Become a sponsor"}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex", center ? "justify-center" : "justify-start")}>
      <a
        href={href}
        {...linkProps}
        className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        style={accent ? { color: accent.color } : undefined}
      >
        {cta.label || "Become a sponsor"} <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/** The event page's sponsor strip; `display` overrides the saved settings for the editor's live preview. */
export function SponsorsBlock({ event, accent, display: override }) {
  const saved = override || resolveSponsorsDisplay(event?.sponsorsDisplay);
  // List rows read left to right, so centring their headings would float them away from the rows.
  const display = saved.layout === "list" ? { ...saved, align: "left" } : saved;
  const groups = sponsorGroups(event, display);
  const hasSponsors = groups.length > 0;
  const ctaTarget = display.cta.enabled ? sponsorCtaHref(event, display.cta) : null;
  const showCta = !!ctaTarget && (hasSponsors || display.cta.showWhenEmpty);
  if (!hasSponsors && !showCta) return null;

  const Layout = LAYOUTS[display.layout];
  const grouped = display.grouping === "spot" && display.layout !== "marquee";
  const sections = !hasSponsors ? [] : grouped
    ? groups
    : [{ spot: null, sponsors: groups.flatMap((g) => g.sponsors) }];

  return (
    <section className="space-y-6">
      {display.heading ? (
        <h2
          className={cn(
            "flex items-center gap-2 text-xl font-semibold text-foreground",
            display.align === "center" && "justify-center",
          )}
        >
          <Handshake className="h-5 w-5 text-text-secondary" />
          {display.heading}
        </h2>
      ) : null}

      {sections.map((section, i) => {
        const featured = display.featureTop && i === 0 && sections.length > 1;
        const size = featured ? STEP_UP[display.logoSize] : display.logoSize;
        return (
          <div key={section.spot?.id || "all"} className="space-y-3">
            {section.spot && display.showSpotLabels ? (
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-text-tertiary",
                  display.align === "center" && "text-center",
                )}
              >
                {section.spot.name}
              </p>
            ) : null}
            <Layout sponsors={section.sponsors} display={display} size={size} showSpot={!grouped} />
          </div>
        );
      })}

      {showCta ? <SponsorCta href={ctaTarget} display={display} accent={accent} /> : null}
    </section>
  );
}

export default SponsorsBlock;
