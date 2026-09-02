import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/components/TabBar";
import { colors, spacing } from "@/theme/tokens";

const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + spacing.lg;

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  header?: React.ReactNode;
  padded?: boolean;
  onScroll?: (y: number) => void;
};

export function Screen({
  children,
  scroll = false,
  header,
  padded = true,
  onScroll,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padStyle = padded ? styles.padded : null;
  const topPad = { paddingTop: insets.top + spacing.md };
  const bottomPad = { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE };

  if (scroll) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[padStyle, topPad, bottomPad]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={
            onScroll
              ? (e) => onScroll(e.nativeEvent.contentOffset.y)
              : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, padStyle, topPad, bottomPad]}>
      {header}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
