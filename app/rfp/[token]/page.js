import { connection } from "next/server";

import { RfpResponsePage } from "@/components/rfp/rfp_response_page";
import { loadRfpPage } from "@/lib/sourcing/server";

export const metadata = {
  title: "Request for proposal · Geiger Events",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// A venue's private RFP link. The token is resolved server-side on every request (and marks the invite viewed).
export default async function RfpTokenPage({ params }) {
  await connection();
  const { token } = await params;
  const { data, serverNow } = await loadRfpPage(token);
  return <RfpResponsePage token={token} initial={data} serverNow={serverNow} />;
}
