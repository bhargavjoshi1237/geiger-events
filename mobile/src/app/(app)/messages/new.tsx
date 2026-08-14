import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Thread } from "@/types/portal";

// Opens a new support thread, optionally prefilled from a ticket/order context.
export default function NewMessageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; subject?: string; contextLabel?: string }>();
  const { token } = useSession();
  const { refreshAll } = usePortalData();
  const { error: toastError, success } = useToast();
  const [subject, setSubject] = useState(params.subject || "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollY = useSharedValue(0);

  const send = async () => {
    if (!token || !body.trim() || busy) return;
    setBusy(true);
    const res = await api<{ thread: Thread }>("/api/portal/threads", {
      method: "POST",
      token,
      body: { subject, body, orderId: params.orderId || null },
    });
    setBusy(false);
    if (!res.ok) {
      toastError(res.error);
      return;
    }
    success("Message sent to the organiser.");
    await refreshAll();
    router.replace(`/messages/${res.data.thread.id}`);
  };

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="New message" scrollY={scrollY} />

      {params.contextLabel ? (
        <View style={styles.context}>
          <Feather name="tag" size={13} color={colors.textTertiary} />
          <Text style={styles.contextText} numberOfLines={1}>
            {params.contextLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <Field label="Subject">
          <Input
            value={subject}
            onChangeText={setSubject}
            placeholder="What's this about?"
          />
        </Field>
        <Field label="Message">
          <Input
            value={body}
            onChangeText={setBody}
            placeholder="Write your message to the organiser…"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={styles.bodyInput}
          />
        </Field>
      </View>

      <Button
        title="Send message"
        icon="send"
        loading={busy}
        disabled={!body.trim()}
        onPress={send}
        fullWidth
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  context: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  contextText: {
    flex: 1,
    ...type.caption,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  bodyInput: {
    minHeight: 5 * type.body.lineHeight + spacing.lg,
    paddingTop: spacing.md,
  },
});
