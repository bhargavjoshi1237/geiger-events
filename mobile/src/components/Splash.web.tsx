import React, { Suspense, lazy } from "react";
import { StyleSheet, View } from "react-native";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

import { colors } from "@/theme/tokens";

type SplashProps = React.ComponentProps<
  // Type-only import keeps the Skia package out of module evaluation.
  typeof import("@/components/AnimatedSplash").AnimatedSplash
>;

// Web builds the Skia singleton from global.CanvasKit at import time, so the
// splash module (and its <Canvas>) must not load before the WASM is ready.
const Inner = lazy(async () => {
  await LoadSkiaWeb();
  return {
    default: (await import("@/components/AnimatedSplash")).AnimatedSplash,
  };
});

export function Splash(props: SplashProps) {
  return (
    <Suspense fallback={<View style={styles.hold} />}>
      <Inner {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  hold: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
});
