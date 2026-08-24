import { findEventById } from "@/components/internal/screens/events/sample_data";
import { normalizeEvent } from "@/lib/supabase/events";

import PublishedEventPage from "./published_event_page";

// Server wrapper for the published event page, mirroring app/w/[slug].
//
// The interactive page is a client component, and used to fetch its own event
// after hydrating — so its HTML was a spinner and nothing else. Any deployment
// where a chunk fails to arrive (see components/asset-recovery.jsx) left that
// spinner on screen forever, because the fetch that would have replaced it lived
// in the code that never ran. Reading the event here instead means the shareable
// page an attendee lands on is complete in the HTML, and JavaScript is only ever
// what makes it interactive.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Plain PostgREST GET with the anon key — the same key and the same RLS policy
// the browser client reads through, so no server-only secret is involved.
// Degrades to null on any failure; the client child then falls back to its own
// fetch, exactly as it did before.
async function fetchEventRow(id) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !UUID.test(String(id || ""))) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/events?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          // Events live in the `events` schema, not `public`.
          "Accept-Profile": "events",
        },
        // Long enough to absorb a burst on a popular link, short enough that an
        // organizer's edit shows up on the next refresh.
        next: { revalidate: 10 },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (err) {
    console.error("[e/:id] server read failed", err);
    return null;
  }
}

export default async function PublishedEventRoute({ params }) {
  const { id } = await params;
  const row = await fetchEventRow(id);
  const event = (row && normalizeEvent(row)) || findEventById(id);
  return <PublishedEventPage id={id} initialEvent={event} />;
}
