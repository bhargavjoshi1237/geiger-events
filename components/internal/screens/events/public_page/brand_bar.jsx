"use client";

import { Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandBar({ headerCfg, barLogo, primaryBtnStyle, ctaHover, onShare }) {
  if (!headerCfg) return null;

  const barFill = headerCfg.fill || null;
  const painted = headerCfg.surface || null;
  const brandMark = barLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={barLogo.url}
      alt=""
      style={{ height: barLogo.height }}
      className="w-auto max-w-[240px] object-contain"
    />
  ) : null;

  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-center gap-x-6 gap-y-3",
        headerCfg.border && "border-b border-border",
        headerCfg.align === "center" && "justify-center text-center",
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
      {headerCfg.links.length ? (
        <nav
          className={cn(
            "flex flex-wrap items-center gap-x-5 gap-y-2",
            headerCfg.align === "split" && "ml-auto",
          )}
        >
          {headerCfg.links.map((l) => (
            <a
              key={`${l.label}-${l.url}`}
              href={l.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={headerCfg.navStyle}
              className="text-sm text-text-secondary transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
      {headerCfg.cta ? (
        <a
          href={headerCfg.cta.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity",
            ctaHover || "hover:opacity-90",
            !headerCfg.links.length && headerCfg.align !== "center" && "ml-auto",
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
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-foreground",
            !headerCfg.links.length && !headerCfg.cta && headerCfg.align !== "center" && "ml-auto",
          )}
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      ) : null}
    </div>
  );
}
