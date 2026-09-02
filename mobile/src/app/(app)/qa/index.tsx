import React from "react";

import { ChannelList } from "@/components/ChannelList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui/Screen";

export default function QaScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Q&A" subtitle="Threads for the events you're attending" />
      <ChannelList
        kind="qa"
        emptyTitle="No threads yet"
        emptyMessage="Organisers open a thread per event — you'll get a push when they do."
        routeBase="/qa"
      />
    </Screen>
  );
}
