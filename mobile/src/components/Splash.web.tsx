import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { colors, spacing, type } from "@/theme/tokens";

type SplashProps = React.ComponentProps<
  typeof import("@/components/AnimatedSplash").AnimatedSplash
>;

// Static mark + full wordmark, no animation.
function SplashHold() {
  return (
    <View style={styles.hold}>
      <BrandMark size={56} />
      <Text style={styles.wordmark} numberOfLines={1}>
        Geiger Studios
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

// Web never loads Skia (Metro can't serve canvaskit.wasm): static mark, dismissed when ready.
export function Splash({ ready, onFinish }: SplashProps) {
  useEffect(() => {
    if (ready) onFinish();
  }, [ready, onFinish]);
  return <SplashHold />;
}

const styles = StyleSheet.create({
  hold: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    ...type.title,
    color: colors.foreground,
    letterSpacing: 0.5,
    textAlign: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  rule: {
    height: 1,
    width: 96,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
  },
});
