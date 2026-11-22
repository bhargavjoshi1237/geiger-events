import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsCampaign, OpsCampaignLens } from "@/types/control_ops";

export const CAMPAIGN_STATUS: Record<OpsCampaign["status"], StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "warning" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
};

const CHANNEL_LABEL: Record<string, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp", push: "Push" };

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

  return (
    <Screen scroll header={<ScreenHeader title={meta.title} />}>
      <Text style={styles.lede}>{meta.lede}</Text>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load campaigns" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !campaigns.length ? (
        status !== "all" ? (
          <EmptyState icon="search" title={`No ${status} campaigns`} message="Campaigns with this status will show up here." actionLabel="Show all" onAction={() => setStatus("all")} />
        ) : (
          <EmptyState icon={meta.icon} title={`No ${meta.title.toLowerCase()} yet`} message={meta.empty} />
        )
      ) : (
        <View style={styles.group}>
          {campaigns.map((c, i) => {
            const pill = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
            return (
              <ListRow
                key={c.id}
                leading={<IconTile icon={meta.icon} size={34} />}
                title={c.name}
                subtitle={[CHANNEL_LABEL[c.channel] ?? c.channel, campaignWhen(c)].join(" · ")}
                trailing={<Pill label={pill.label} tone={pill.tone} variant="outline" />}
                onPress={() => router.push({ pathname: "/control/ops/campaigns/[id]", params: { id: c.id } })}
                divider={i < campaigns.length - 1}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  filters: {
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
