import { PortalApp } from "@/components/workspace_portal/shell/portal_app";
import { portalStore } from "@/lib/workspace/portal/store";

// Sessions are per visitor, so the portal is never cached.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function eventFor(id) {
  if (!UUID.test(String(id ?? ""))) return null;
  try {
    const row = await portalStore.eventRow(id.toLowerCase());
    if (!row) return null;
    return {
      id: row.id, name: row.name ?? "", timeZone: row.timezone || "UTC", design: row.metadata?.pageDesign ?? null,
      date: row.event_date ?? null, place: row.city || row.venue || null,
    };
  } catch (error) {
    console.error("[workspace portal] event read failed", error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await eventFor(id);
  return { title: event?.name ? `${event.name}` : "Portal", robots: { index: false, follow: false } };
}

export default async function WorkspacePortalLayout({ children, params }) {
  const { id } = await params;
  const event = await eventFor(id);
  return <PortalApp eventId={id} event={event}>{children}</PortalApp>;
}
