import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { initials } from "@/lib/format";
import { colors } from "@/theme/tokens";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  size?: number;
};

export function Avatar({ name, email, size = 40 }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.38) }]}>
        {initials(name, email)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
  },
  initial: {
    color: colors.mutedForeground,
    fontWeight: "600",
  },
});
