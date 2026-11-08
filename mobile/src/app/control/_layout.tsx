import { Redirect, Stack } from "expo-router";
import React from "react";

import { useControl } from "@/state/control";
import { colors } from "@/theme/tokens";

export default function ControlLayout() {
  const { teamStatus } = useControl();
  // Signing out of the team (here or on another device) drops back to whatever the entry route picks.
  if (teamStatus === "signedOut") return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
