"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarX2, Loader2, Moon, Share2, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export default function PublishedEventPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [event, setEvent] = useState(() => findEventById(id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getEvent(id).then((row) => {
      if (!alive) return;
      if (row) setEvent(row);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

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

  const design = event?.pageDesign;
  const themed = !!design && design.mode !== "standard";
  const brandFavicon = themed ? design.theme?.favicon || "" : "";
  const baseTheme = themed ? resolveTheme(design) : null;

  const viewerMode = design?.viewerMode || "auto";
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
    } catch {}
    if (saved !== "light" && saved !== "dark") {
      const system = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
      saved = viewerMode === "auto" ? system : null;
    }
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
    } catch {}
  };
  const brandTheme = baseTheme ? themeForMode(baseTheme, activeMode) : null;
  const siteName = brandTheme?.source?.siteName || "";
  const pageTitle = event?.name
    ? siteName
      ? `${event.name} — ${siteName}`
      : event.name
    : "";
  const themeColor = brandTheme
    ? brandTheme.themeColor || brandTheme.colors?.bg || ""
    : "";
  const hasBrandBar = !!(
    brandTheme && resolveHeader(brandTheme, !!resolveLogo(brandTheme, "bar"))
  );
  const chromeStyle = brandTheme ? themeChromeStyle(brandTheme) : undefined;

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
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
          <CalendarX2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            Event not found
          </h1>
          <p className="max-w-sm text-sm text-text-secondary">
            This event may have been unpublished, or the link is incorrect.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </Button>
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
      {pageTitle ? <title>{pageTitle}</title> : null}
      {themeColor ? <meta name="theme-color" content={themeColor} /> : null}
      {brandFavicon ? (
        <link rel="icon" href={brandFavicon} precedence="default" />
      ) : null}
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
