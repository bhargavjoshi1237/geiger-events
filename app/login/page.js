import { redirect } from "next/navigation";

import { getSessionMember } from "@/lib/portal/session";
import LoginScreen from "@/components/portal/login_screen";

export const metadata = { title: "Sign in · Geiger Events" };

// /login is the members auth screen only. If already signed in, go straight to
// the portal at /members. A `?setup=<token>` link enters the set-password step.
export default async function LoginPage({ searchParams }) {
  const member = await getSessionMember();
  if (member) redirect("/members");
  const sp = await searchParams;
  const setupToken = typeof sp?.setup === "string" ? sp.setup : null;
  return <LoginScreen setupToken={setupToken} />;
}
