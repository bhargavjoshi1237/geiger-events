import { getSessionMember } from "@/lib/portal/session";
import { OperationsPortal } from "@/components/portal/operations/operations_portal";

export const metadata = { title: "Event operations · Geiger Events", robots: { index: false, follow: false } };

export default async function OperationsPage({ params, searchParams }) {
  const [{ eventId }, query, member] = await Promise.all([params, searchParams, getSessionMember()]);
  return <OperationsPortal eventId={eventId} member={member}
    invitationToken={typeof query.invite === "string" ? query.invite : typeof query.token === "string" ? query.token : null}
    setupToken={typeof query.setup === "string" ? query.setup : null} />;
}
