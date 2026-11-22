import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { MessageComposer } from "@/components/control/forms/MessageComposer";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventDateLine } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEventDetail } from "@/types/portal";

const BODY_MAX = 4000;
const SUBJECT_MAX = 160;

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function AnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = body.trim().length > 0;
  const detail = hub.data;

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

  let step = 0;
  return (
    <>
      <FormScreen
        title="Announce"
        subtitle={detail?.event.name}
        footer={
          <SaveBar
            title="Send"
            icon="send"
            note={ready ? "Arrives as a new conversation in each inbox." : "Write a message to send it."}
            onPress={() => setConfirming(true)}
            disabled={!ready || busy}
          />
        }
      >
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <FormHeader
            leading={<IconTile icon="megaphone" size={52} tone="info" />}
            title="Message ticket holders"
            meta={detail ? <MetaText>{eventDateLine(detail.event)}</MetaText> : undefined}
            description="It lands in every ticket holder's app inbox as a conversation they can reply to."
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <SectionTitle variant="kicker">Who gets it</SectionTitle>
          {detail ? (
            <Readout
              lead={{ label: "Expected guests", value: String(detail.counts.guests), hint: "tickets and confirmed places" }}
              items={[
                { label: "Tickets sold", value: String(detail.event.sold) },
                { label: "Checked in", value: String(detail.counts.checkedIn) },
              ]}
            />
          ) : hub.error ? (
            <ListGroup>
              <Text style={styles.audienceError}>{"Couldn't load the audience. Sending still works."}</Text>
            </ListGroup>
          ) : (
            <Skeleton height={148} radius={radius.lg} />
          )}
          <Text style={styles.footnote}>Each buyer and confirmed guest gets it once. Only people with a Geiger account receive it.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <MessageComposer
            subject={subject}
            onSubjectChange={setSubject}
            subjectMax={SUBJECT_MAX}
            subjectPlaceholder="Doors open at 6pm"
            body={body}
            onBodyChange={setBody}
            bodyMax={BODY_MAX}
            bodyPlaceholder="What do ticket holders need to know?"
          />
        </Animated.View>
      </FormScreen>

      <Sheet visible={confirming} onClose={() => (busy ? undefined : setConfirming(false))} title="Send to everyone holding a ticket?">
        <View style={styles.sheetBody}>
          <ListGroup>
            <View style={styles.preview}>
              {subject.trim() ? (
                <Text style={styles.previewSubject} numberOfLines={1}>
                  {subject.trim()}
                </Text>
              ) : null}
              <Text style={styles.previewBody} numberOfLines={4}>
                {body.trim()}
              </Text>
            </View>
          </ListGroup>
          <Text style={styles.sheetText}>Each ticket holder gets this as a new conversation. It can&apos;t be unsent.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} disabled={busy} />
            <Button title="Send announcement" icon="send" onPress={() => void send()} loading={busy} disabled={busy} />
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  audienceError: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    paddingVertical: spacing.md + 2,
  },
  footnote: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  preview: {
    gap: spacing.xs,
    paddingVertical: spacing.md + 2,
  },
  previewSubject: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  previewBody: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
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
