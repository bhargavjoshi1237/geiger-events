import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { colors, spacing } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  // Drawn behind the header and form without scrolling, e.g. a CoverWash.
  backdrop?: React.ReactNode;
  // Pinned under the scroll area (usually a SaveBar), so the keyboard lifts it with the form.
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// The frame for Control's forms: a padded nav header, a keyboard-aware body of spaced blocks and an optional pinned action bar.
export function FormScreen({ title, subtitle, right, backdrop, footer, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {backdrop ? (
        <View pointerEvents="none" style={styles.backdrop}>
          {backdrop}
        </View>
      ) : null}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ScreenHeader title={title} subtitle={subtitle} right={right} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: footer ? spacing.xl : insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
