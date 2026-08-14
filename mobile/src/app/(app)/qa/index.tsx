import React from "react";
import { useSharedValue } from "react-native-reanimated";

import { ChannelList } from "@/components/ChannelList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui/Screen";

export default function QaScreen() {
  const scrollY = useSharedValue(0);

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader
        title="Q&A"
        subtitle="Discussion threads for the events you're attending. Ask questions and join the conversation."
        scrollY={scrollY}
      />
      <ChannelList
        kind="qa"
        emptyTitle="No questions yet"
        emptyMessage="Ask the organiser anything during an event."
        routeBase="/qa"
      />
    </Screen>
  );
}
