import type { BottomTabBarProps } from "expo-router/js-tabs";
import React from "react";

import { TabBarFrame, TabButton } from "@/components/TabBar";
import type { IconName } from "@/components/ui/icons";
import { selectionFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";

const TABS: { name: string; label: string; icon: IconName; needs?: "orders" | "inbox" }[] = [
  { name: "index", label: "Today", icon: "house" },
  { name: "events", label: "Events", icon: "calendar" },
  { name: "orders", label: "Orders", icon: "shopping-bag", needs: "orders" },
  { name: "inbox", label: "Inbox", icon: "inbox", needs: "inbox" },
  { name: "more", label: "More", icon: "menu" },
];

// Orders and Inbox only appear when the active project's role grants them.
export function ControlTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { project } = useControl();
  const active = state.routes[state.index]?.name;

  return (
    <TabBarFrame bottomInset={insets.bottom}>
      {TABS.filter((tab) => !tab.needs || project?.can[tab.needs]).map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        return (
          <TabButton
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            focused={active === tab.name}
            badge={0}
            onPress={() => {
              selectionFeedback();
              navigation.navigate(route.name);
            }}
          />
        );
      })}
    </TabBarFrame>
  );
}
