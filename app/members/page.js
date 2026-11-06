import { redirect } from "next/navigation";

import { getSessionMember } from "@/lib/portal/session";
import PortalShell from "@/components/portal/portal_shell";

export const metadata = { title: "Members · Geiger Events", robots: { index: false, follow: false } };

export default async function MembersPage() {
  const member = await getSessionMember();
  if (!member) redirect("/login");
  return <PortalShell member={member} />;
}
