"use client";

import React from "react";
import { useBanner } from "@/context/banner-context";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";

const THEMES = {
  warning: {
    root: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    chip: "border-amber-500/30 bg-amber-500/15 text-amber-200",
    linkDecoration: "decoration-amber-300/40",
  },
  info: {
    root: "border-primary/20 bg-primary/10 text-foreground",
    chip: "border-primary/30 bg-primary/15 text-primary",
    linkDecoration: "decoration-primary/40",
  },
};

export function GlobalBanner() {
  const { banner, hideBanner } = useBanner();

  if (!banner.isVisible) return null;

  const theme = THEMES[banner.type] || THEMES.warning;

  return (
    <div
      role="status"
      className={cn(
        "relative w-full border-b px-4 py-2.5 flex items-center justify-center gap-3 transition-all duration-500 animate-in fade-in slide-in-from-top-full z-[100]",
        theme.root,
      )}
    >
      <div className="flex items-center gap-3 max-w-7xl mx-auto w-full justify-center">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded border flex-shrink-0",
            theme.chip,
          )}
        >
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-tight leading-none">
          <span>{banner.message}</span>
          {banner.link && (
            <>
              <span className="opacity-40 font-normal">·</span>
              <a
                href={banner.link.url}
                className={cn(
                  "hover:text-foreground transition-colors underline underline-offset-4 font-bold flex items-center gap-1.5",
                  theme.linkDecoration,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {banner.link.text}
              </a>
            </>
          )}
        </div>
      </div>

      {banner.isSticky && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={hideBanner}
          className="absolute right-4 p-1.5 rounded-full hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center"
          aria-label="Close banner"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
