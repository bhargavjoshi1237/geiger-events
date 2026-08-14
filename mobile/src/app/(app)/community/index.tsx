import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ChannelList } from "@/components/ChannelList";
import { Screen } from "@/components/ui/Screen";
import { colors, spacing, type } from "@/theme/tokens";

export default function CommunityScreen() {
  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          {"Group chats for the events you're attending. Say hi, ask questions, and hear from the organiser."}
        </Text>
      </View>
      <ChannelList
        kind="event"
        emptyTitle="No channels yet"
        emptyMessage="Event chats you're part of will appear here."
        routeBase="/community"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.title,
    color: colors.foreground,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
});
