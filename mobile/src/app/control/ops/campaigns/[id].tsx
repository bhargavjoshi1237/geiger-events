import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { CAMPAIGN_STATUS, campaignWhen } from "@/components/control/ops/CampaignList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsCampaignDetail } from "@/types/control_ops";

type Action = "send" | "schedule" | "unschedule" | "draft";

const STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

// "YYYY-MM-DD HH:MM" in the phone's time zone → ISO, or null when it isn't a real moment.
function stampToIso(text: string): string | null {
  const m = STAMP.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const detail = useControlQuery<OpsCampaignDetail>(`/api/control/ops/campaigns/${id}`);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [stamp, setStamp] = useState("");
  const [busy, setBusy] = useState(false);
  const data = detail.data;

  const run = async (action: Action, scheduledAt?: string) => {
    setBusy(true);
    const res = await controlApi<OpsCampaignDetail>(`/api/control/ops/campaigns/${id}/status`, { method: "POST", body: { action, scheduledAt } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(
      action === "send" ? "Marked as sent." : action === "schedule" ? "Scheduled." : action === "unschedule" ? "Unscheduled." : "Back to draft.",
    );
    setConfirm(null);
    setScheduling(false);
    detail.setData(res.data);
  };

  const schedule = () => {
    const iso = stampToIso(stamp);
    if (!iso) return toast.error("Use YYYY-MM-DD HH:MM, for example 2026-12-01 09:00.");
    if (Date.parse(iso) <= Date.now()) return toast.error("Pick a time in the future.");
    void run("schedule", iso);
  };

  let body: React.ReactNode;
  if (detail.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't open this campaign" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const c = data.campaign;
    const pill = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
    body = (
      <View style={styles.stack}>
        <Card>
          <View style={styles.head}>
            <Text style={styles.name}>{c.name}</Text>
            <Pill label={pill.label} tone={pill.tone} />
          </View>
          <Text style={styles.meta}>{[c.channel.toUpperCase(), c.type, campaignWhen(c)].join(" · ")}</Text>
        </Card>

        <View>
          <SectionTitle variant="kicker">Audience</SectionTitle>
          <Card tone="subtle">
            <Text style={styles.value}>{data.audience}</Text>
            <Text style={styles.meta}>{`About ${data.estimate.toLocaleString("en-US")} ${pluralize(data.estimate, "contact", "contacts")} right now`}</Text>
          </Card>
        </View>

        {c.subject || c.body ? (
          <View>
            <SectionTitle variant="kicker">Message</SectionTitle>
            <Card tone="subtle">
              {c.subject ? <Text style={styles.value}>{c.subject}</Text> : null}
              {c.body ? (
                <Text style={styles.body} numberOfLines={12}>
                  {c.body}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        {c.status === "sent" ? (
          <View style={styles.stats}>
            <StatTile label="Recipients" value={c.metrics.recipients.toLocaleString("en-US")} />
            <StatTile label="Delivered" value={c.metrics.delivered.toLocaleString("en-US")} />
            <StatTile label="Opened" value={c.metrics.opened.toLocaleString("en-US")} />
          </View>
        ) : null}

        <View style={styles.actions}>
          {c.status === "draft" ? (
            <>
              <Button title="Send now" icon="send" onPress={() => setConfirm("send")} fullWidth />
              <Button title="Schedule for later" icon="calendar-clock" variant="secondary" onPress={() => setScheduling(true)} fullWidth />
            </>
          ) : c.status === "scheduled" ? (
            <>
              <Button title="Mark as sent" icon="send" onPress={() => setConfirm("send")} fullWidth />
              <Button title="Unschedule" icon="undo-2" variant="secondary" onPress={() => void run("unschedule")} loading={busy} fullWidth />
            </>
          ) : (
            <Button title="Back to draft" icon="undo-2" variant="secondary" onPress={() => setConfirm("draft")} fullWidth />
          )}
        </View>
        <Text style={styles.caption}>The message, audience and A/B tests are edited on the dashboard.</Text>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Campaign" />}>
      {body}

      <Sheet visible={confirm === "send"} onClose={() => setConfirm(null)} title="Send this campaign?">
        <View style={styles.sheetBody}>
          <Text style={styles.body}>
            {`This marks it sent to about ${(data?.estimate ?? 0).toLocaleString("en-US")} ${pluralize(data?.estimate ?? 0, "contact", "contacts")} — the same as Send now on the dashboard. It can't be unsent.`}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
            <Button title="Send" onPress={() => void run("send")} loading={busy} />
          </View>
        </View>
      </Sheet>

      <Sheet visible={confirm === "draft"} onClose={() => setConfirm(null)} title="Back to draft?">
        <View style={styles.sheetBody}>
          <Text style={styles.body}>Its status returns to Draft so it can be changed and sent again. Its figures are kept.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
            <Button title="Back to draft" onPress={() => void run("draft")} loading={busy} />
          </View>
        </View>
      </Sheet>

      <Sheet visible={scheduling} onClose={() => setScheduling(false)} title="Schedule for later">
        <View style={styles.sheetBody}>
          <Field label="Send at" hint="Your local time, as YYYY-MM-DD HH:MM.">
            <Input value={stamp} onChangeText={setStamp} placeholder="2026-12-01 09:00" keyboardType="numbers-and-punctuation" autoFocus />
          </Field>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setScheduling(false)} />
            <Button title="Schedule" onPress={schedule} loading={busy} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  value: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    borderRadius: radius.lg,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
