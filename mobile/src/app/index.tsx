import { Redirect } from "expo-router";
import React from "react";

import { useSession } from "@/state/session";

export default function Index() {
  const { status } = useSession();
  if (status === "authed") return <Redirect href="/(app)/home" />;
  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;
  return null;
}
