"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarX2, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { findEventById } from "@/components/internal/screens/events/sample_data";
import {
  EventPublicPageContent,
} from "@/components/internal/screens/events/event_public_page";
import { defaultPageDesign } from "@/components/internal/screens/events/page_design";
import { getEvent } from "@/lib/supabase/events";

// Standalone published event page, reachable at /e/<uuid>. This is the real,
// shareable page an attendee lands on — distinct from the in-editor preview
// overlay. Opening it in a new tab keeps the editor's state intact, so there's
// no "Back drops me on the home page" behaviour.
export default function PublishedEventPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  // Render bundled sample data instantly, then refine from the live table.
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
  const brandFavicon =
    design && design.mode !== "standard" ? design.theme?.favicon || "" : "";

  if (!event) {
    if (loading) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading event…
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
          <Link href="/home">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* An imported brand's favicon, so the tab matches the page. React hoists
          the tag into <head>; without one the app's own icon stands. */}
      {brandFavicon ? (
        <link rel="icon" href={brandFavicon} precedence="default" />
      ) : null}
      {/* Published-page chrome — brand + share, not the editor's preview bar. */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`}
              alt="Logo"
              width={20}
              height={20}
            />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            Geiger Studios
          </span>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={share}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </header>

      <EventPublicPageContent
        event={event}
        design={design || defaultPageDesign()}
        live
      />
    </div>
  );
}
