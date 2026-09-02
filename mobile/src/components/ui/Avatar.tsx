import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { initials } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  size?: number;
  // "square" is the rounded tile the inbox and thread headers use.
  shape?: "circle" | "square";
  inverted?: boolean;
};

export function Avatar({ name, email, size = 40, shape = "circle", inverted = false }: AvatarProps) {
  return (
    <View
      style={[
        styles.tile,
        inverted && styles.inverted,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : radius.md,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          inverted && styles.initialInverted,
          { fontSize: Math.round(size * 0.34) },
        ]}
      >
        {initials(name, email)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
  },
  inverted: {
    backgroundColor: colors.foreground,
  },
  initial: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
  },
  initialInverted: {
    color: colors.primaryForeground,
  },
});
