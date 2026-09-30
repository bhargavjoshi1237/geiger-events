import { findEventById } from "@/components/internal/screens/events/sample_data";
import { normalizeEvent } from "@/lib/supabase/events";
import { fetchEventRow } from "@/lib/events/fetch_event_row";
import { SponsorProspectusPage } from "@/components/internal/screens/events/sponsorship/prospectus/prospectus_page";

// The event's sponsorship prospectus, served via ISR like the event page itself.
export const revalidate = 10;

export async function generateStaticParams() {
  return [];
}

export default async function SponsorProspectusRoute({ params }) {
  const { id } = await params;
  const row = await fetchEventRow(id);
  const event = (row && normalizeEvent(row)) || findEventById(id);
  return <SponsorProspectusPage event={event} />;
}
