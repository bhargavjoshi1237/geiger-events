import { redirect } from "next/navigation";

import { getSessionMember } from "@/lib/portal/session";
import LoginScreen from "@/components/portal/login_screen";

export const metadata = { title: "Sign in · Geiger Events" };

// /login is the members auth screen. A signed-in member normally goes straight
// to /members — EXCEPT when arriving from the internal workspace (?workspace=1),
// where that bounce would wrongly send a would-be suite user to the portal; there
// we show the sign-in in workspace context instead. A `?setup=<token>` link enters
// the set-password step.
export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const workspace = sp?.workspace === "1" || sp?.workspace === "true";
  const member = await getSessionMember();
  if (member && !workspace) redirect("/members");
  const setupToken = typeof sp?.setup === "string" ? sp.setup : null;
  return <LoginScreen setupToken={setupToken} workspace={workspace} />;
}
