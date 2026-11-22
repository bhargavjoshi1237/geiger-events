import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEventDetail } from "@/types/portal";

const BODY_MAX = 4000;

export default function AnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = body.trim().length > 0;

  const send = async () => {
    setBusy(true);
    const res = await controlApi<{ audience: number; reached: number }>(`/api/control/events/${id}/announce`, {
      method: "POST",
      body: { subject: subject.trim(), body: body.trim() },
    });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return;
    }
    successFeedback();
    toast.success(`Sent to ${res.data.reached} of ${res.data.audience} ticket holders`);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.headerPad, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Announce"
          subtitle={hub.data?.event.name}
          right={<Button title="Send" size="sm" icon="send" onPress={() => setConfirming(true)} disabled={!ready || busy} />}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.explainer}>
          <IconTile icon="megaphone" size={40} />
          <Text style={styles.explainerText}>
            Your message lands in every ticket holder&apos;s app inbox as a conversation they can reply to. Only buyers with a
            Geiger account receive it.
          </Text>
        </View>

        <View style={styles.form}>
          <Field label="Subject" hint="Optional">
            <Input value={subject} onChangeText={setSubject} placeholder="Doors open at 6pm" maxLength={160} />
          </Field>
          <Field label="Message" hint={`${body.length} / ${BODY_MAX}`}>
            <Input
              value={body}
              onChangeText={setBody}
              placeholder="What do ticket holders need to know?"
              multiline
              maxLength={BODY_MAX}
              style={styles.multiline}
            />
          </Field>
        </View>
      </ScrollView>

      <Sheet visible={confirming} onClose={() => (busy ? undefined : setConfirming(false))} title="Send to everyone holding a ticket?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>Each ticket holder gets this as a new conversation. It can&apos;t be unsent.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} disabled={busy} />
            <Button title="Send" icon="send" onPress={() => void send()} loading={busy} disabled={busy} />
          </View>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerPad: {
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  explainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  explainerText: {
    ...type.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  multiline: {
    minHeight: 180,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
