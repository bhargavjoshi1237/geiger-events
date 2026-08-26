import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, timing, type } from "@/theme/tokens";

type ChatComposerProps = {
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  accessory?: React.ReactNode;
};

const MAX_LINES = 5;

export function ChatComposer({
  onSend,
  placeholder = "Write a message…",
  disabled = false,
  disabledReason,
  accessory,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const reduced = useReducedMotion();
  const sendOpacity = useSharedValue(0);
  const sendScale = useSharedValue(0.5);

  const canSend = !disabled && !sending && text.trim().length > 0;

  const handleChange = (v: string) => {
    setText(v);
    const show = v.trim() ? 1 : 0;
    if (reduced) {
      sendOpacity.value = show;
      sendScale.value = show;
    } else {
      sendOpacity.value = withTiming(show, { duration: timing.fast });
      sendScale.value = withTiming(show === 1 ? 1 : 0.5, { duration: timing.base });
    }
  };

  const send = async () => {
    if (!canSend) return;
    selectionFeedback();
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) {
      setText("");
      handleChange("");
    }
  };

  const sendStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {accessory}
      {disabled ? (
        <View style={styles.disabledWrap}>
          <Text style={styles.disabled}>{disabledReason || placeholder}</Text>
        </View>
      ) : (
        <View style={styles.bar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            disabled={!canSend}
            onPress={send}
            hitSlop={4}
          >
            <Animated.View style={[styles.send, sendStyle]}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="arrow-up" size={20} color={colors.primaryForeground} />
              )}
            </Animated.View>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  disabledWrap: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  disabled: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs + 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: MAX_LINES * type.body.lineHeight + spacing.md,
    paddingTop: spacing.sm - 2,
    paddingBottom: spacing.sm - 2,
    paddingHorizontal: spacing.xs,
    ...type.body,
    color: colors.foreground,
    textAlignVertical: "center",
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
});
