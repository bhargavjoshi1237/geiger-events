import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme/tokens";

type Props = {
  uri?: string | null;
  // Shown huge and faint when there's no cover, e.g. the event's day of the month.
  numeral?: string | null;
  height?: number;
};

// The ambient header backdrop for Control's detail screens: the cover blurred into the canvas, or a giant mono numeral.
export function CoverWash({ uri, numeral, height = 360 }: Props) {
  return (
    <View style={[styles.frame, { height }]}>
      {uri ? (
        <Image source={{ uri }} blurRadius={32} contentFit="cover" transition={240} style={[StyleSheet.absoluteFill, styles.image]} />
      ) : numeral ? (
        <Text style={styles.numeral} numberOfLines={1}>
          {numeral}
        </Text>
      ) : null}
      <LinearGradient
        colors={[colors.canvasHalf, colors.canvasHalf, colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
  },
  image: {
    opacity: 0.6,
  },
  numeral: {
    position: "absolute",
    right: -14,
    top: 36,
    fontFamily: fonts.monoSemibold,
    fontSize: 230,
    lineHeight: 240,
    letterSpacing: -16,
    color: colors.surfaceActive,
  },
});
