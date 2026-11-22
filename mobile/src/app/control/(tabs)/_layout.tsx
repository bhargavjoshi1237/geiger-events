import { Tabs } from "expo-router/js-tabs";
import React from "react";

import { ControlTabBar } from "@/components/control/ControlTabBar";

export default function ControlTabsLayout() {
  return (
    <Tabs tabBar={(props) => <ControlTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
