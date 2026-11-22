import * as Clipboard from "expo-clipboard";
import React from "react";
import { StyleSheet, View } from "react-native";

import { successFeedback } from "@/lib/haptics";
import { colors, radius, spacing } from "@/theme/tokens";

// The bordered row group every Settings screen in Control stacks its rows in.
export function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export async function copyToClipboard(text: string, onCopied: (message: string) => void, message = "Copied.") {
  await Clipboard.setStringAsync(text);
  successFeedback();
  onCopied(message);
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
});
