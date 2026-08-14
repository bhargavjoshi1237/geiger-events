import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, type } from "@/theme/tokens";

type EventCoverProps = {
  uri?: string | null;
  name?: string | null;
  height: number;
  radius?: number;
};

// Event artwork with a deterministic initial-letter fallback (web Cover port).
export function EventCover({ uri, name, height, radius: round = radius.lg }: EventCoverProps) {
  return (
    <View style={[styles.frame, { height, borderRadius: round }]}>
      {uri ? (
        <Image source={{ uri }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient
          colors={[colors.surfaceStrong, colors.surfaceCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <Text style={styles.initial}>{(name || "E").slice(0, 1).toUpperCase()}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.surfaceCard,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    ...type.label,
    fontSize: 18,
    color: colors.textSecondary,
  },
});
