import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { colors, spacing } from "@/theme/tokens";

type Props = {
  title: string;
  saving?: boolean;
  dirty?: boolean;
  onSave?: () => void;
  // Drawn full-bleed behind the header and the top of the form, e.g. a CoverWash of the banner.
  backdrop?: React.ReactNode;
  children: React.ReactNode;
};

// A pushed form with Save in the header; no tab bar sits under Control's pushed screens, so the keyboard gets the room.
export function FormFrame({ title, saving = false, dirty = false, onSave, backdrop, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {backdrop ? (
        <View pointerEvents="none" style={styles.backdrop}>
          {backdrop}
        </View>
      ) : null}
      <ScreenHeader
        title={title}
        right={onSave ? <Button title="Save" size="sm" onPress={onSave} loading={saving} disabled={!dirty || saving} /> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
});
