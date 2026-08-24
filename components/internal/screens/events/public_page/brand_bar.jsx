"use client";

import { useState } from "react";
import { Menu, Share2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandBar({ headerCfg, barLogo, primaryBtnStyle, ctaHover, onShare }) {
  // Nav links collapse behind a toggle below `md`. Left to wrap, five links plus
  // a CTA and Share stack into a four-line block that pushes the hero off the
  // phone screen entirely.
  const [menuOpen, setMenuOpen] = useState(false);

  if (!headerCfg) return null;

  const barFill = headerCfg.fill || null;
  const painted = headerCfg.surface || null;
  const hasLinks = headerCfg.links.length > 0;
  const centered = headerCfg.align === "center";
  const brandMark = barLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={barLogo.url}
      alt=""
      style={{ height: barLogo.height }}
      className="w-auto max-w-[160px] object-contain sm:max-w-[240px]"
    />
  ) : null;

  // Desktop keeps whatever the align setting produced. On mobile the nav is
  // gone, so the action cluster takes the free space instead.
  const actionsClass = centered ? "" : hasLinks ? "ml-auto md:ml-0" : "ml-auto";

  const navLink = (l, stacked) => (
    <a
      key={`${l.label}-${l.url}`}
      href={l.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={headerCfg.navStyle}
      onClick={() => setMenuOpen(false)}
      className={cn(
        "text-sm text-text-secondary transition-colors hover:text-foreground",
        stacked && "block py-2",
      )}
    >
      {l.label}
    </a>
  );

  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-center gap-x-6 gap-y-3",
        headerCfg.border && "border-b border-border",
        centered && "justify-center text-center",
        barFill ? "py-4" : "pb-5",
        headerCfg.sticky && "sticky z-20",
      )}
      style={{
        ...(headerCfg.sticky ? { top: "var(--ev-chrome-h, 0px)" } : null),
        ...(barFill
          ? {
              backgroundColor: barFill,
              boxShadow: `0 0 0 100vw ${barFill}`,
              clipPath: "inset(0 -100vw)",
            }
          : null),
        ...painted,
      }}
    >
      {barLogo?.link ? (
        <a href={barLogo.link} target="_blank" rel="noopener noreferrer">
          {brandMark}
        </a>
      ) : (
        brandMark
      )}

      {hasLinks ? (
        <nav
          className={cn(
            "hidden items-center gap-x-5 gap-y-2 md:flex",
            headerCfg.align === "split" && "md:ml-auto",
          )}
        >
          {headerCfg.links.map((l) => navLink(l, false))}
        </nav>
      ) : null}

      <div className={cn("flex items-center gap-2 sm:gap-3", actionsClass)}>
        {headerCfg.cta ? (
          <a
            href={headerCfg.cta.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity",
              ctaHover || "hover:opacity-90",
            )}
            style={primaryBtnStyle}
          >
            {headerCfg.cta.label}
          </a>
        ) : null}

        {onShare ? (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this event"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        ) : null}

        {hasLinks ? (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="inline-flex items-center rounded-lg border border-border p-1.5 text-text-secondary transition-colors hover:text-foreground md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {/* Stays in flow rather than floating, so the sticky bar's own painted
          band grows with it instead of the panel escaping the clip-path. */}
      {hasLinks && menuOpen ? (
        <nav className="basis-full border-t border-border pt-2 md:hidden">
          {headerCfg.links.map((l) => navLink(l, true))}
        </nav>
      ) : null}
    </div>
  );
}
