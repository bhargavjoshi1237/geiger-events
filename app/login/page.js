import { redirect } from "next/navigation";

import { getSessionMember } from "@/lib/portal/session";
import LoginScreen from "@/components/portal/login_screen";

export const metadata = { title: "Sign in · Geiger Events" };

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const workspace = sp?.workspace === "1" || sp?.workspace === "true";
  const member = await getSessionMember();
  if (member && !workspace) redirect("/members");
  const setupToken = typeof sp?.setup === "string" ? sp.setup : null;
  return <LoginScreen setupToken={setupToken} workspace={workspace} />;
}
