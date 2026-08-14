import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import React from "react";

import { TabBar } from "@/components/TabBar";
import { useSession } from "@/state/session";

export default function AppLayout() {
  const { status } = useSession();
  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
      <Tabs.Screen name="watch" options={{ title: "Watch" }} />
      <Tabs.Screen name="community" options={{ title: "Community" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />

      {/* Route groups that live inside the shell without their own tab. */}
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="memberships" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="qa" options={{ href: null }} />
      <Tabs.Screen name="live" options={{ href: null }} />
    </Tabs>
  );
}
