import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsDeliverability } from "@/types/control_ops";

function Check({ ok }: { ok: boolean }) {
  return <Pill label={ok ? "Verified" : "Not set"} tone={ok ? "success" : "warning"} variant="outline" />;
}

export default function DeliverabilityScreen() {
  const { project } = useControl();
  const query = useControlQuery<{ deliverability: OpsDeliverability }>(project ? `/api/control/ops/projects/${project.id}/deliverability` : null);
  const d = query.data?.deliverability;

  return (
    <Screen scroll header={<ScreenHeader title="Deliverability" />}>
      <Text style={styles.lede}>Who your campaigns come from and whether your domain is set up. Change these on the dashboard.</Text>
      {query.error && !d ? (
        <EmptyState icon="circle-alert" title="Couldn't load deliverability" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : !d ? (
        <SkeletonList rows={5} variant="divided" />
      ) : (
        <View style={styles.stack}>
          <View>
            <SectionTitle variant="kicker">Sender</SectionTitle>
            <View style={styles.group}>
              <ListRow leading={<IconTile icon="users" size={34} />} title={d.fromName || "No sender name"} subtitle="From name" />
              <ListRow leading={<IconTile icon="mail" size={34} />} title={d.fromEmail || "No sender email"} subtitle="From email" />
              <ListRow leading={<IconTile icon="reply" size={34} />} title={d.replyTo || "Replies go to the sender"} subtitle="Reply-to" divider={false} />
            </View>
          </View>
          <View>
            <SectionTitle variant="kicker">Domain</SectionTitle>
            <View style={styles.group}>
              <ListRow leading={<IconTile icon="globe" size={34} />} title={d.sendingDomain || "No sending domain"} subtitle="Sending domain" trailing={<Check ok={d.domainVerified} />} />
              <ListRow leading={<IconTile icon="shield-check" size={34} />} title="DKIM" trailing={<Check ok={d.dkim} />} />
              <ListRow leading={<IconTile icon="shield" size={34} />} title="SPF" trailing={<Check ok={d.spf} />} divider={false} />
            </View>
          </View>
          <View style={styles.group}>
            <ListRow
              leading={<IconTile icon="gauge" size={34} />}
              title={d.dailyCap ? `${d.dailyCap.toLocaleString("en-US")} a day` : "No daily cap"}
              subtitle="Sending limit"
              divider={false}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
