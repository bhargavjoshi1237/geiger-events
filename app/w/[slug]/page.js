"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarX2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WallPublicPageContent } from "@/components/internal/screens/events/event_wall/wall_public_page";
import { getWallBySlug } from "@/lib/supabase/event_wall";
import { listListableEvents } from "@/lib/supabase/events";

// Standalone published Event Wall, reachable at /w/<slug> — the public hub
// listing every event an organizer has marked listable (see the Visibility
// section of the event editor). Mirrors app/e/[id]/page.js.
export default function EventWallPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [wall, setWall] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([getWallBySlug(slug), listListableEvents()]).then(
      ([wallRow, eventRows]) => {
        if (!alive) return;
        setWall(wallRow);
        setEvents(eventRows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!wall) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
          <CalendarX2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
          <p className="max-w-sm text-sm text-text-secondary">
            This events page may have moved, or the link is incorrect.
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
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
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
      </header>

      <WallPublicPageContent wall={wall} events={events} />
    </div>
  );
}
