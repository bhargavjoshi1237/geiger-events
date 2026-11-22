import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { CAMPAIGN_STATUS, CHANNEL_ICON, CHANNEL_LABEL, campaignMoment, campaignWhen } from "@/components/control/ops/CampaignList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsCampaign, OpsCampaignDetail } from "@/types/control_ops";

type Action = "send" | "schedule" | "unschedule" | "draft";

const STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;
const stagger = (i: number) => Math.min(i, 8) * 50;
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const num = (n: number) => n.toLocaleString("en-US");

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
  const moment = data ? campaignMoment(data.campaign) : null;

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
    let step = 0;

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            {moment ? <DateStub date={moment} size="lg" /> : <IconTile icon={CHANNEL_ICON[c.channel] ?? "send"} size={56} />}
            <View style={styles.heroText}>
              <Text style={styles.when} numberOfLines={1}>
                {campaignWhen(c)}
              </Text>
              <Text style={styles.kind} numberOfLines={1}>
                {[CHANNEL_LABEL[c.channel] ?? c.channel, c.type].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{c.name}</Text>
          <Pill label={pill.label} tone={pill.tone} />
        </Animated.View>

        {c.status === "sent" ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Results campaign={c} />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Audience">
            <View style={styles.audience}>
              <IconTile icon="users" size={36} />
              <View style={styles.audienceText}>
                <Text style={styles.value}>{data.audience}</Text>
                <Text style={styles.reach}>{`≈ ${num(data.estimate)} ${pluralize(data.estimate, "contact", "contacts")} right now`}</Text>
              </View>
            </View>
          </ListGroup>
        </Animated.View>

        {c.subject || c.body ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Message">
              <View style={styles.message}>
                {c.subject ? (
                  <View style={styles.subjectBlock}>
                    <Text style={styles.subjectLabel}>Subject</Text>
                    <Text style={styles.value}>{c.subject}</Text>
                  </View>
                ) : null}
                {c.body ? (
                  <Text style={styles.body} numberOfLines={12}>
                    {c.body}
                  </Text>
                ) : null}
              </View>
            </ListGroup>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <SectionTitle variant="kicker">{c.status === "draft" ? "Send it" : c.status === "scheduled" ? "Before it goes out" : "Make changes"}</SectionTitle>
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
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll backdrop={moment ? <CoverWash numeral={moment.slice(8, 10)} /> : undefined} header={<ScreenHeader title="Campaign" />}>
      {body}

      <Sheet visible={confirm === "send"} onClose={() => setConfirm(null)} title="Send this campaign?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {`This marks it sent to about ${num(data?.estimate ?? 0)} ${pluralize(data?.estimate ?? 0, "contact", "contacts")} — the same as Send now on the dashboard. It can't be unsent.`}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
            <Button title="Send" onPress={() => void run("send")} loading={busy} />
          </View>
        </View>
      </Sheet>

      <Sheet visible={confirm === "draft"} onClose={() => setConfirm(null)} title="Back to draft?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>Its status returns to Draft so it can be changed and sent again. Its figures are kept.</Text>
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

// How a sent campaign landed: sent leads, then opens and clicks on the tick scale against what was delivered.
function Results({ campaign: c }: { campaign: OpsCampaign }) {
  const { recipients, delivered, opened, clicked } = c.metrics;
  const base = delivered || recipients;
  return (
    <Readout
      lead={{ label: "Sent", value: num(recipients), hint: `${num(delivered)} delivered` }}
      items={[
        { label: "Delivered", value: `${pct(delivered, recipients)}%` },
        { label: "Open rate", value: `${pct(opened, base)}%` },
        { label: "Click rate", value: `${pct(clicked, base)}%` },
      ]}
    >
      <View style={styles.meters}>
        <MeterLine label="Opened" value={opened} max={base} tone="success" />
        <MeterLine label="Clicked" value={clicked} max={base} tone="neutral" />
      </View>
    </Readout>
  );
}

function MeterLine({ label, value, max, tone }: { label: string; value: number; max: number; tone: "success" | "neutral" }) {
  return (
    <View style={styles.meterLine}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>
          {num(value)}
          <Text style={styles.meterOf}>{` / ${num(max)}`}</Text>
        </Text>
      </View>
      <TickMeter value={value} max={max} ticks={44} height={12} tone={tone} label={`${value} of ${max} ${label.toLowerCase()}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  when: {
    ...type.mono,
    color: colors.foreground,
  },
  kind: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  name: {
    ...type.display,
    color: colors.foreground,
  },
  meters: {
    gap: spacing.md,
  },
  meterLine: {
    gap: spacing.xs + 2,
  },
  meterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  meterLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  meterValue: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  meterOf: {
    color: colors.textTertiary,
  },
  audience: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  audienceText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  value: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  reach: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  message: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  subjectBlock: {
    gap: 3,
  },
  subjectLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  body: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  caption: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.sm,
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
