import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DockedPlayer } from "@/components/DockedPlayer";
import { TAB_BAR_HEIGHT, TabBar } from "@/components/TabBar";
import { useSession } from "@/state/session";
import { spacing } from "@/theme/tokens";

export default function AppLayout() {
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;

  return (
    <>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
        <Tabs.Screen name="live" options={{ title: "Live" }} />
        <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
        <Tabs.Screen name="more" options={{ title: "More" }} />

        <Tabs.Screen name="watch" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="orders" options={{ href: null }} />
        <Tabs.Screen name="memberships" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="account" options={{ href: null }} />
        <Tabs.Screen name="qa" options={{ href: null }} />
      </Tabs>
      <DockedPlayer bottom={insets.bottom + TAB_BAR_HEIGHT + spacing.sm} />
    </>
  );
}
