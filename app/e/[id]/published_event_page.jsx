"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarX2,
  Loader2,
  Moon,
  RotateCw,
  Share2,
  Sun,
  WifiOff,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { findEventById } from "@/components/internal/screens/events/sample_data";
import {
  EventPublicPageContent,
} from "@/components/internal/screens/events/event_public_page";
import { defaultPageDesign } from "@/components/internal/screens/events/page_design";
import { getEvent } from "@/lib/supabase/events";
import {
  resolveTheme,
  themeChromeStyle,
  resolveHeader,
  resolveLogo,
  themeForMode,
} from "@/lib/events/theme";
import { cn } from "@/lib/utils";

// However slow the client is, a spinner is a promise the page has to keep. Past
// this, the fetch is treated as failed and the visitor gets something to act on.
const LOAD_TIMEOUT_MS = 12000;

// Standalone published event page, reachable at /e/<uuid>. This is the real,
// shareable page an attendee lands on — distinct from the in-editor preview
// overlay. Opening it in a new tab keeps the editor's state intact, so there's
// no "Back drops me on the home page" behaviour.
//
// `initialEvent` is the server's own read (see page.js). When it lands, the page
// is complete in the HTML and needs no client fetch at all — which is what keeps
// it readable when a chunk fails to load and nothing ever hydrates.
export default function PublishedEventPage({ id, initialEvent = null }) {
  // Server data first, then bundled sample data, then the live table.
  const [event, setEvent] = useState(() => initialEvent || findEventById(id));
  const [loading, setLoading] = useState(() => !initialEvent);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialEvent || !id) return undefined;
    let alive = true;

    // getEvent swallows its own errors, but a request that simply never settles
    // is what leaves the spinner up forever. Cap the wait.
    const watchdog = setTimeout(() => {
      if (!alive) return;
      setLoadFailed(true);
      setLoading(false);
    }, LOAD_TIMEOUT_MS);

    getEvent(id)
      .then((row) => {
        if (!alive) return;
        if (row) setEvent(row);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[e/:id] couldn't load the event", err);
        setLoadFailed(true);
        setLoading(false);
      })
      .finally(() => clearTimeout(watchdog));

    return () => {
      alive = false;
      clearTimeout(watchdog);
    };
  }, [id, initialEvent, attempt]);

  const retryLoad = () => {
    setLoadFailed(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  // Affiliate attribution: a visit on a tracked link (?ref=<slug>) validates the
  // token, logs the click and remembers it for this event, then strips the
  // param. Imported lazily so the affiliate code only loads on a link that
  // actually carries a ref, and silent when the event has no program.
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("ref")) return;
    import("@/addons/affiliates/lib/attribution")
      .then((mod) => mod.captureRefFromUrl(id))
      .catch(() => {});
  }, [id]);

  const share = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event?.name, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("Link copied to clipboard."),
        () => toast.error("Couldn't copy the link."),
      );
    }
  };

  // A themed page can carry the source site's favicon; standard mode never does.
  const design = event?.pageDesign;
  const themed = !!design && design.mode !== "standard";
  const brandFavicon = themed ? design.theme?.favicon || "" : "";
  // The page wrapper sits above the themed body, so on an imported brand it has
  // to take the same tokens — app-dark showing above a light brand page is the
  // one seam an attendee notices. No page background here: the wrapper inherits
  // the brand base color, not the hero gradient.
  const baseTheme = themed ? resolveTheme(design) : null;

  // Visitor light/dark switch. The organizer's preferred mode (page design →
  // Viewer theme) is the default; a visitor's own choice is remembered per
  // event in localStorage; Follow system reads the OS setting. Toggling swaps
  // the neutral palette while brand colors, fonts, and shapes stay put.
  const viewerMode = design?.viewerMode || "auto"; // "light" | "dark" | "auto"
  const baseIsLight = baseTheme ? baseTheme.base === "light" : false;
  const initialMode =
    viewerMode === "light" || viewerMode === "dark"
      ? viewerMode
      : baseIsLight
        ? "light"
        : "dark";
  const [mode, setMode] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `geiger-ev-mode:${id}`;
    let saved = null;
    try {
      saved = window.localStorage.getItem(key);
    } catch {
      // Storage blocked (private mode, strict policies) — just use the default.
    }
    if (saved !== "light" && saved !== "dark") {
      const system = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
      saved = viewerMode === "auto" ? system : null;
    }
    // Deferred out of the effect body (avoids the synchronous setState-in-effect
    // cascade the linter flags) — the first paint uses the organizer's default.
    if (saved === "light" || saved === "dark") {
      Promise.resolve().then(() => setMode(saved));
    }
  }, [id, viewerMode]);
  const activeMode = mode || initialMode;
  const toggleMode = () => {
    const next = activeMode === "light" ? "dark" : "light";
    setMode(next);
    try {
      window.localStorage.setItem(`geiger-ev-mode:${id}`, next);
    } catch {
      // Non-fatal — the choice just won't survive a reload.
    }
  };
  const brandTheme = baseTheme ? themeForMode(baseTheme, activeMode) : null;
  // Tab title reads like a page on the source site rather than "Events - Geiger
  // Studio"; theme-color is what tints the mobile browser's own chrome.
  const siteName = brandTheme?.source?.siteName || "";
  const pageTitle = event?.name
    ? siteName
      ? `${event.name} — ${siteName}`
      : event.name
    : "";
  const themeColor = brandTheme
    ? brandTheme.themeColor || brandTheme.colors?.bg || ""
    : "";
  // An imported page renders the source site's own header bar, which then owns
  // the share action. Without one there's no bar on the page at all, so Share
  // sits in the top gap instead.
  const hasBrandBar = !!(
    brandTheme && resolveHeader(brandTheme, !!resolveLogo(brandTheme, "bar"))
  );
  // No platform chrome bar means nothing for a pinned brand header to clear, so
  // --ev-chrome-h is left unset and its `, 0px` fallback applies.
  const chromeStyle = brandTheme ? themeChromeStyle(brandTheme) : undefined;

  // The published page owns the whole tab. Paint the document itself with the
  // active brand background so nothing behind the wrapper shows the app's own
  // dark theme — an overscroll band above the page, or the strip that appears
  // while a mobile URL bar collapses, flashes the wrong color the moment a
  // visitor flips to light mode.
  useEffect(() => {
    const bg = brandTheme?.colors?.bg || "";
    if (!bg) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = bg;
    body.style.backgroundColor = bg;
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [brandTheme?.colors?.bg]);

  if (!event) {
    if (loading) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Event…
        </div>
      );
    }
    // A load that failed is not the same as a link that is wrong, and only one
    // of the two is worth trying again.
    const Icon = loadFailed ? WifiOff : CalendarX2;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            {loadFailed ? "Couldn't load this event" : "Event not found"}
          </h1>
          <p className="max-w-sm text-sm text-text-secondary">
            {loadFailed
              ? "Something went wrong on the way to this page. Check your connection and try again."
              : "This event may have been unpublished, or the link is incorrect."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {loadFailed ? (
            <Button onClick={retryLoad}>
              <RotateCw className="h-4 w-4" /> Try again
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Link href="/home">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={chromeStyle}
      className={cn(
        "min-h-[100dvh] bg-background text-foreground",
        themed && "ev-themed",
      )}
    >
      {/* Tab identity. React hoists title/meta/link into <head> from anywhere,
          so a client page can still own these. Without them the tab carries the
          app's own name and icon, which gives the game away first. */}
      {pageTitle ? <title>{pageTitle}</title> : null}
      {themeColor ? <meta name="theme-color" content={themeColor} /> : null}
      {brandFavicon ? (
        <link rel="icon" href={brandFavicon} precedence="default" />
      ) : null}
      {/* Top strip. The platform's own branded chrome bar is gone — a published
          page should open on the event (or on the source site's header), not on
          ours. With a brand bar the strip has nothing left to hold (Share moved
          into the bar), so it would be an empty painted band above the site's
          own header; it's dropped entirely and the header sits flush at the top
          the way it does on the source site. Without one it stays as a spacer
          carrying Share. */}
      {hasBrandBar ? null : (
        <div className="relative z-10 flex h-14 items-center justify-end px-4 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            onClick={share}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      )}

      <EventPublicPageContent
        event={event}
        design={design || defaultPageDesign()}
        live
        onShare={hasBrandBar ? share : null}
        themeOverride={brandTheme}
      />

      {/* Visitor light/dark switch — themed pages only. A standard page is the
          platform's own look, which has no brand palette to flip between. */}
      {themed ? (
        <button
          type="button"
          onClick={toggleMode}
          aria-label={
            activeMode === "light"
              ? "Switch to dark mode"
              : "Switch to light mode"
          }
          title={
            activeMode === "light"
              ? "Switch to dark mode"
              : "Switch to light mode"
          }
          className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-card text-foreground shadow-lg transition-colors hover:border-border-strong hover:bg-surface-active"
        >
          {activeMode === "light" ? (
            <Moon className="h-4.5 w-4.5" />
          ) : (
            <Sun className="h-4.5 w-4.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}
