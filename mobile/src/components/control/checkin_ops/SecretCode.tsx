import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = { code: string; label?: string };

// An access code opens the scanner for anyone holding it, so it stays masked until asked for.
export function SecretCode({ code, label = "Access code" }: Props) {
  const [shown, setShown] = useState(false);
  const toast = useToast();

  return (
    <View style={styles.row}>
      <Text style={styles.code} accessibilityLabel={shown ? `${label} ${code.split("").join(" ")}` : `${label} hidden`}>
        {shown ? code : "•".repeat(Math.max(code.length, 6))}
      </Text>
      <IconButton
        icon={shown ? "lock" : "eye"}
        label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        variant="plain"
        size={36}
        iconSize={18}
        onPress={() => {
          selectionFeedback();
          setShown((s) => !s);
        }}
      />
      <IconButton
        icon="copy"
        label={`Copy ${label.toLowerCase()}`}
        variant="plain"
        size={36}
        iconSize={18}
        onPress={() => {
          void Clipboard.setStringAsync(code).then(() => toast.success("Code copied."));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    minHeight: 48,
  },
  code: {
    ...type.monoLarge,
    flex: 1,
    color: colors.foreground,
  },
});
