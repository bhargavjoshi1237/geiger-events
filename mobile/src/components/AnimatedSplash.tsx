import React, { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import {
  Canvas,
  Circle,
  RadialGradient,
} from "@shopify/react-native-skia";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BrandMark } from "@/components/BrandMark";
import { colors, spacing, spring, timing, type } from "@/theme/tokens";

const MIN_DURATION = 1400;
const FADE_OUT = 320;

type AnimatedSplashProps = {
  ready: boolean;
  onFinish: () => void;
};

// Full-screen first impression: a soft Skia glow, the mark drawing in, then a
// wordmark + rule, before the whole overlay cross-fades away once the session
// has resolved for at least MIN_DURATION.
export function AnimatedSplash({ ready, onFinish }: AnimatedSplashProps) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const startedAt = useRef(0);

  const fade = useSharedValue(0);
  const scale = useSharedValue(0.86);
  const lift = useSharedValue(6);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkOffset = useSharedValue(8);
  const ruleWidth = useSharedValue(0);
  const glowPulse = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);

  // Draw-in sequence (skipped under reduced motion).
  useEffect(() => {
    startedAt.current = Date.now();
    if (reduced) {
      fade.value = 1;
      scale.value = 1;
      lift.value = 0;
      wordmarkOpacity.value = 1;
      wordmarkOffset.value = 0;
      ruleWidth.value = 96;
      return;
    }
    fade.value = withTiming(1, { duration: timing.slow });
    scale.value = withSpring(1, spring);
    lift.value = withTiming(0, { duration: timing.slow });
    wordmarkOpacity.value = withDelay(260, withTiming(1, { duration: 260 }));
    wordmarkOffset.value = withDelay(260, withTiming(0, { duration: 260 }));
    ruleWidth.value = withDelay(
      520,
      withTiming(96, { duration: timing.slow, easing: Easing.out(Easing.cubic) }),
    );
    glowPulse.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lift the overlay once the session has resolved and the beat has elapsed.
  useEffect(() => {
    if (!ready) return;
    const elapsed = startedAt.current ? Date.now() - startedAt.current : 0;
    const wait = Math.max(0, MIN_DURATION - elapsed);
    const t = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: FADE_OUT }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkOffset.value }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({ width: ruleWidth.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const glowCenter = { x: width / 2, y: height * 0.35 };
  const glowRadius = useDerivedValue(
    () => Math.max(width, height) * 0.55 * glowPulse.value,
  );

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={glowCenter.x} cy={glowCenter.y} r={glowRadius}>
          <RadialGradient
            c={glowCenter}
            r={glowRadius}
            colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
          />
        </Circle>
      </Canvas>
      <Animated.View style={[styles.brandWrap, brandStyle]}>
        <BrandMark size={56} />
      </Animated.View>
      <Animated.Text style={[styles.wordmark, wordmarkStyle]}>
        Geiger Events
      </Animated.Text>
      <Animated.View style={[styles.rule, ruleStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  brandWrap: {
    marginBottom: spacing.lg,
  },
  wordmark: {
    ...type.title,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
  },
});
