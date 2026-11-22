import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon, type IconName } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtClock, fmtDateTime, pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsCampaign, OpsCampaignLens } from "@/types/control_ops";

export const CAMPAIGN_STATUS: Record<OpsCampaign["status"], StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "warning" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
};

export const CHANNEL_LABEL: Record<string, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp", push: "Push" };

export const CHANNEL_ICON: Record<string, IconName> = { email: "mail", sms: "message-square", whatsapp: "message-circle", push: "bell" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sent", label: "Sent" },
];

const LENSES: Record<OpsCampaignLens, { title: string; icon: IconName; lede: string; empty: string }> = {
  newsletters: {
    title: "Newsletters",
    icon: "mail",
    lede: "Broadcast email updates — announcements, recaps and regular sends.",
    empty: "Write newsletters on the dashboard; send or schedule them from here.",
  },
  invites: {
    title: "Email Invites",
    icon: "send",
    lede: "Invite contacts to an event by email with a personal RSVP link.",
    empty: "Compose invites on the dashboard; send or schedule them from here.",
  },
  reminders: {
    title: "Automated Reminders",
    icon: "bell",
    lede: "Scheduled reminders that go out before an event, on any channel.",
    empty: "Set up reminders on the dashboard; manage when they go out from here.",
  },
};

export function campaignWhen(c: OpsCampaign): string {
  if (c.status === "sent") return c.sentAt ? `Sent ${fmtDateTime(c.sentAt)}` : "Sent";
  if (c.status === "scheduled" && c.scheduledAt) return `Scheduled for ${fmtDateTime(c.scheduledAt)}`;
  return "Not sent";
}

// The moment a campaign went or goes out, as the phone's local calendar day for DateStub.
export function campaignMoment(c: OpsCampaign): string | null {
  const at = c.status === "sent" ? c.sentAt : c.status === "scheduled" ? c.scheduledAt : null;
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// One of the dashboard's campaign lenses over the project's campaigns table.
export function CampaignList({ lens }: { lens: OpsCampaignLens }) {
  const router = useRouter();
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const meta = LENSES[lens];
  const list = useControlQuery<{ campaigns: OpsCampaign[] }>(
    project ? `/api/control/ops/projects/${project.id}/campaigns?lens=${lens}${status !== "all" ? `&status=${status}` : ""}` : null,
  );
  const campaigns = list.data?.campaigns ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load campaigns" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!campaigns.length) {
    body =
      status !== "all" ? (
        <EmptyState icon="search" title={`No ${status} campaigns`} message="Campaigns with this status will show up here." actionLabel="Show all" onAction={() => setStatus("all")} />
      ) : (
        <EmptyState icon={meta.icon} title={`No ${meta.title.toLowerCase()} yet`} message={meta.empty} />
      );
  } else {
    body = (
      <ListGroup title={`${campaigns.length} ${pluralize(campaigns.length, "campaign", "campaigns")}`}>
        {campaigns.map((c, i) => (
          <CampaignRow
            key={c.id}
            campaign={c}
            onPress={() => router.push({ pathname: "/control/ops/campaigns/[id]", params: { id: c.id } })}
            divider={i < campaigns.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title={meta.title} />}>
      <View style={styles.controls}>
        <Text style={styles.lede}>{meta.lede}</Text>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      <Animated.View entering={FadeInDown.springify()}>
        {body}
      </Animated.View>
    </Screen>
  );
}

// A campaign led by the day it went or goes out, its channel and time in mono, and how it landed once sent.
function CampaignRow({ campaign: c, onPress, divider }: { campaign: OpsCampaign; onPress: () => void; divider: boolean }) {
  const pill = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
  const at = c.status === "sent" ? c.sentAt : c.status === "scheduled" ? c.scheduledAt : null;
  const channel = CHANNEL_LABEL[c.channel] ?? c.channel;
  const when = at ? `${c.status === "sent" ? "Sent" : "Goes out"} ${fmtClock(at)}` : "Not sent";
  const openRate = c.metrics.delivered > 0 ? Math.round((c.metrics.opened / c.metrics.delivered) * 100) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${pill.label}, ${campaignWhen(c)}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <DateStub date={campaignMoment(c)} muted={c.status === "draft" || c.status === "paused"} />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          <Pill label={pill.label} tone={pill.tone} variant="outline" />
        </View>
        <View style={styles.lineRow}>
          <Icon name={CHANNEL_ICON[c.channel] ?? "send"} size={12} color={colors.textSecondary} />
          <Text style={styles.line} numberOfLines={1}>{`${channel} · ${when}`}</Text>
        </View>
        {c.status === "sent" && c.metrics.recipients > 0 ? (
          <Text style={styles.metrics} numberOfLines={1}>
            {`${c.metrics.recipients.toLocaleString("en-US")} sent${openRate != null ? ` · ${openRate}% opened` : ""}`}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  line: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  metrics: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
