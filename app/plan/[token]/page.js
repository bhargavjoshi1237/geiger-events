import { connection } from "next/server";

import { SharedPlanPage } from "@/components/plan_share/shared_plan_page";
import { fetchSharedPlan } from "@/lib/plan_sharing/server";

export const metadata = {
  title: "Shared floor plan · Geiger Events",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// A floor plan shared by link. The token is resolved server-side on every request; views are counted by the page itself.
export default async function SharedPlanTokenPage({ params }) {
  await connection();
  const { token } = await params;
  const data = await fetchSharedPlan(token);
  return <SharedPlanPage token={token} initial={data} />;
}
