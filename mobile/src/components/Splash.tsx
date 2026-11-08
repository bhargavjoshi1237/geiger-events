import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { BRAND_ASPECT, BRAND_BARS, BRAND_VIEW_BOX } from "@/components/BrandMark";
import { colors } from "@/theme/tokens";

// Same width as the native splash image (app.json imageWidth) so the hand-off doesn't jump.
const MARK_WIDTH = 96;
const MARK_HEIGHT = MARK_WIDTH * BRAND_ASPECT;
const MIN_DURATION = 1400;
const FADE_OUT = 320;

// The suite LogoLoading "relay pulse": bars dim and relight in turn, starting lit to match the native splash.
const DIM = 0.14;
const FALL = 1020;
const RISE = 480;
const STAGGER = 180;
const EASE = Easing.inOut(Easing.ease);

type SplashProps = {
  ready: boolean;
  onFinish: () => void;
};

function PulseBar({ d, index, animate }: { d: string; index: number; animate: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    opacity.value = withDelay(
      index * STAGGER,
      withRepeat(
        withSequence(
          withTiming(DIM, { duration: FALL, easing: EASE }),
          withTiming(1, { duration: RISE, easing: EASE }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [animate, index, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // One layer per bar: each needs its own opacity, and the bars' boxes overlap.
  return (
    <Animated.View style={[styles.layer, style]}>
      <Svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox={BRAND_VIEW_BOX}>
        <Path d={d} fill={colors.foreground} />
      </Svg>
    </Animated.View>
  );
}

export function Splash({ ready, onFinish }: SplashProps) {
  const reduced = useReducedMotion();
  const startedAt = useRef(0);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = reduced ? 0 : Math.max(0, MIN_DURATION - elapsed);
    const t = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: FADE_OUT }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <View style={styles.mark}>
        {BRAND_BARS.map((d, i) => (
          <PulseBar key={i} d={d} index={i} animate={!reduced} />
        ))}
      </View>
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
  mark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
