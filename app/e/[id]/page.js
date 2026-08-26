import { findEventById } from "@/components/internal/screens/events/sample_data";
import { normalizeEvent } from "@/lib/supabase/events";
import PublishedEventPage from "./published_event_page";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
          "Accept-Profile": "events",
        },
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
