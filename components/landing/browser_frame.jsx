"use client";

import React, { Suspense } from "react";
import { cn } from "@/lib/utils";

// Lightweight framed container for the landing spotlight playgrounds: a bordered,
// fixed-height, internally-scrollable content area (hidden scrollbar, like
// EventsPlayground). Children may read useSearchParams, so they render inside a
// Suspense boundary.
export function BrowserFrame({ children, className, contentClassName }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[#191919]",
        className,
      )}
    >
      <div
        className={cn(
          "h-[460px] overflow-y-auto bg-background [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          contentClassName,
        )}
      >
        <Suspense fallback={<div className="h-full w-full bg-background" />}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

export default BrowserFrame;
