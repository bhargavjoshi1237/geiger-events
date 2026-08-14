import { Redirect } from "expo-router";
import React from "react";

import { useSession } from "@/state/session";

// The gate: authed members land in the shell, guests in sign-in, and the splash
// covers the brief loading state.
export default function Index() {
  const { status } = useSession();
  if (status === "authed") return <Redirect href="/(app)/home" />;
  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;
  return null;
}
