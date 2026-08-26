import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing, spring, timing, type } from "@/theme/tokens";

const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 900;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapToContent?: boolean;
};

export function Sheet({ visible, onClose, title, children, snapToContent = true }: SheetProps) {
  const insets = useSafeAreaInsets();
  const translateYRef = useSharedValue(0);
  const overlayOpacityRef = useSharedValue(1);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationY > 0) translateYRef.value = e.translationY;
      overlayOpacityRef.value = interpolate(
        e.translationY,
        [0, DISMISS_DISTANCE],
        [1, 0],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateYRef.value = withSpring(0, spring);
        overlayOpacityRef.value = withTiming(1, { duration: timing.fast });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateYRef.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacityRef.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View entering={FadeIn.duration(timing.base)} style={[styles.overlay, overlayStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.overlayPressable}
            onPress={onClose}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            entering={FadeInUp.duration(timing.slow)}
            style={[
              styles.sheet,
              !snapToContent && styles.fixedHeight,
              sheetStyle,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <View style={styles.handle} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  overlayPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surfaceDialog,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "88%",
  },
  fixedHeight: {
    minHeight: "45%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceStrong,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.heading,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
});
