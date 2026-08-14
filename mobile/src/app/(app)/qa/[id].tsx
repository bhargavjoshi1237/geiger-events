import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ChannelRoom } from "@/components/ChannelRoom";

export default function QaThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChannelRoom channelId={id} routeBase="/qa" />;
}
