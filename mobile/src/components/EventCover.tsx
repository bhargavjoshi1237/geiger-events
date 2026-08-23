import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { colors, radius, type } from "@/theme/tokens";

type EventCoverProps = {
  uri?: string | null;
  name?: string | null;
  height: number;
  radius?: number;
};

// Event artwork with a deterministic initial-letter fallback (web Cover port).
export function EventCover({ uri, name, height, radius: round = radius.lg }: EventCoverProps) {
  if (uri) {
    return (
      <View style={[styles.frame, { height, borderRadius: round }]}>
        <Image source={{ uri }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  // Prop-derived sizes are computed at render; everything else lives in styles.
  const initialSize = Math.max(28, Math.round(height * 0.42));
  const markWidth = Math.round(height * 0.3);
  return (
    <View style={[styles.frame, { height, borderRadius: round }]}>
      <LinearGradient
        colors={[colors.surfaceStrong, colors.muted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.fallback]}
      >
        {/* Oversized ghosted initial reads as artwork rather than an empty box. */}
        <Text
          style={[
            styles.initial,
            { fontSize: initialSize, lineHeight: Math.round(initialSize * 1.1) },
          ]}
          numberOfLines={1}
        >
          {(name || "E").slice(0, 1).toUpperCase()}
        </Text>
        <View style={[styles.markWrap, { marginTop: -Math.round(initialSize * 0.34) }]}>
          <BrandMark size={markWidth} color={colors.borderStrong} />
        </View>
      </LinearGradient>
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
    ...type.display,
    color: colors.surfaceDialog,
    opacity: 0.9,
  },
  markWrap: {
    alignItems: "center",
  },
});
