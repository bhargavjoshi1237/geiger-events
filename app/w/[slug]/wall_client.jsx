"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarX2, Loader2 } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@geiger/ui/button";
import { WallPublicPageContent } from "@/components/internal/screens/events/event_wall/wall_public_page";
import { getWallBySlug } from "@/lib/supabase/event_wall";
import { listListableEvents } from "@/lib/supabase/events";
import { getPublicProfile } from "@/lib/supabase/discovery";

const DASHBOARD_HREF = "/org";

// The public wall is a marketing surface, so it wears the same fixed header as
// the landing page. `pt-12` clears the header's 3rem height; the wall's own
// theming stays untouched inside.
function WallShell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Header dashboardHref={DASHBOARD_HREF} />
      <div className="pt-12">{children}</div>
    </div>
  );
}

export default function WallClient({ slug }) {
  const [wall, setWall] = useState(null);
  const [events, setEvents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
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
      <WallShell>
        <div className="flex min-h-[calc(100dvh-3rem)] items-center justify-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </WallShell>
    );
  }

  if (!wall) {
    return (
      <WallShell>
        <div className="flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center gap-4 px-6 text-center">
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
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </WallShell>
    );
  }

  return (
    <WallShell>
      <WallPublicPageContent wall={wall} events={events} profile={profile} />
    </WallShell>
  );
}
