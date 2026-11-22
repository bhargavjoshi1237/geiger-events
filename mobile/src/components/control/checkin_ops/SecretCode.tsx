import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { selectionFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";

type Props = { code: string; label?: string };

// An access code opens the scanner for anyone holding it, so it stays masked until asked for; sits as a row in a ListGroup.
export function SecretCode({ code, label = "Access code" }: Props) {
  const [shown, setShown] = useState(false);
  const toast = useToast();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.code} numberOfLines={1} accessibilityLabel={shown ? `${label} ${code.split("").join(" ")}` : `${label} hidden`}>
          {shown ? code : "•".repeat(Math.max(code.length, 6))}
        </Text>
      </View>
      <IconButton
        icon={shown ? "lock" : "eye"}
        label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        variant="plain"
        size={40}
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
        size={40}
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
    paddingVertical: spacing.md,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  code: {
    ...type.figureSmall,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 3,
    color: colors.foreground,
  },
});
