import React from "react";

import { ChannelList } from "@/components/ChannelList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui/Screen";

export default function CommunityScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Group chats" subtitle="Every event chat you're in" />
      <ChannelList
        kind="event"
        emptyTitle="No group chats yet"
        emptyMessage="Event chats you're part of will appear here and in your inbox."
        routeBase="/community"
      />
    </Screen>
  );
}
