import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ChannelRoom } from "@/components/ChannelRoom";

export default function CommunityChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChannelRoom channelId={id} routeBase="/community" />;
}
