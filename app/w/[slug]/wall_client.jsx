"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarX2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WallPublicPageContent } from "@/components/internal/screens/events/event_wall/wall_public_page";
import { getWallBySlug } from "@/lib/supabase/event_wall";
import { listListableEvents } from "@/lib/supabase/events";
import { getPublicProfile } from "@/lib/supabase/discovery";

// Interactive body of the published Event Wall (/w/<slug>). The server page.js
// wrapper owns SEO/OG metadata and passes the resolved slug in; this component
// fetches the wall + its listable events client-side (the app's browser
// Supabase client is window-bound, so the render stays on the client).
export default function WallClient({ slug }) {
  const [wall, setWall] = useState(null);
  const [events, setEvents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Public page (outside ProjectProvider): resolve the wall by slug first,
    // then scope its listable events + organiser profile to that wall's project.
    getWallBySlug(slug).then(async (wallRow) => {
      if (!alive) return;
      setWall(wallRow);
      const [eventRows, profileRow] = wallRow
        ? await Promise.all([
            listListableEvents(wallRow.projectId),
            getPublicProfile(wallRow.projectId),
          ])
        : [[], null];
      if (!alive) return;
      setEvents(eventRows ?? []);
      setProfile(profileRow);
      setLoading(false);
    });
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

      <WallPublicPageContent wall={wall} events={events} profile={profile} />
    </div>
  );
}
