"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarX2, Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { findEventById } from "@/components/internal/screens/events/sample_data";
import { PackagesPublicPage } from "@/components/internal/screens/events/packages_page/packages_public_page";
import { TicketCheckout } from "@/components/internal/screens/events/public_page/checkout/ticket_checkout";
import { usePageTheme } from "@/components/internal/screens/events/public_page/use_page_theme";
import { getEvent } from "@/lib/supabase/events";
import {
  normalizePackagesPage,
  packageAsTicket,
} from "@/lib/events/packages";

export default function PublishedPackagesPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [event, setEvent] = useState(() => findEventById(id));
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

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

  const { accent } = usePageTheme({
    design: event?.packagesDesign,
    live: true,
  });

  const page = normalizePackagesPage(event?.packagesPage);

  if (!event || !page.enabled) {
    if (loading) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading packages…
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
            Packages aren&apos;t available
          </h1>
          <p className="max-w-sm text-sm text-text-secondary">
            This event has no packages page, or it hasn&apos;t been published yet.
          </p>
        </div>
        {event ? (
          <Button
            asChild
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Link href={`/e/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back to the event
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PackagesPublicPage event={event} live onBuy={setBuying} />

      
      {buying ? (
        <TicketCheckout
          open
          onClose={() => setBuying(null)}
          event={event}
          ticket={packageAsTicket(buying)}
          remaining={buying.stock}
          live
          accent={accent}
        />
      ) : null}
    </>
  );
}
