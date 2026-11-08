import { Redirect } from "expo-router";
import React from "react";

import { useControl } from "@/state/control";
import { useSession } from "@/state/session";

export default function Index() {
  const { status } = useSession();
  const { teamStatus, mode, modeReady } = useControl();
  if (status === "loading" || teamStatus === "loading" || !modeReady) return null;

  const team = teamStatus === "signedIn";
  // Control when it was the last mode, or when the team account is the only one signed in.
  if (team && (mode === "control" || status !== "authed")) return <Redirect href="/(control)" />;
  if (status === "authed") return <Redirect href="/(app)/home" />;
  return <Redirect href="/(auth)/sign-in" />;
}
