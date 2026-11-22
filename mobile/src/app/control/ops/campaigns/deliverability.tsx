import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsDeliverability } from "@/types/control_ops";

const stagger = (i: number) => Math.min(i, 8) * 50;

// A domain check: green when it's set up, amber when it still needs doing.
function CheckRow({ icon, title, detail, mono = false, ok, divider = true }: { icon: IconName; title: string; detail: string; mono?: boolean; ok: boolean; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <IconTile icon={icon} size={36} tone={ok ? "success" : "warning"} />
      <View style={styles.rowStack}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={mono ? styles.rowMono : styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Pill label={ok ? "Verified" : "Not set"} tone={ok ? "success" : "warning"} variant="outline" />
    </View>
  );
}

export default function DeliverabilityScreen() {
  const { project } = useControl();
  const query = useControlQuery<{ deliverability: OpsDeliverability }>(project ? `/api/control/ops/projects/${project.id}/deliverability` : null);
  const d = query.data?.deliverability;

  let body: React.ReactNode;
  if (query.error && !d) {
    body = <EmptyState icon="circle-alert" title="Couldn't load deliverability" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  } else if (!d) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else {
    const passed = [d.domainVerified, d.dkim, d.spf].filter(Boolean).length;
    let step = 0;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            items={[
              { label: "Domain checks", value: `${passed}/3`, tone: passed === 3 ? "success" : "warning" },
              { label: "Daily limit", value: d.dailyCap ? d.dailyCap.toLocaleString("en-US") : "None", hint: d.dailyCap ? "sends a day" : "no cap set" },
            ]}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Sender">
            <DetailRow icon="users" label="From name" value={d.fromName || "Not set"} />
            <DetailRow icon="mail" label="From email" value={d.fromEmail || "Not set"} mono={Boolean(d.fromEmail)} />
            <DetailRow icon="reply" label="Reply-to" value={d.replyTo || "The sender"} mono={Boolean(d.replyTo)} divider={false} />
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup
            title="Domain"
            footer={passed === 3 ? "Your domain is set up to send." : "Finish the DNS records on the dashboard so campaigns don't land in spam."}
          >
            <CheckRow icon="globe" title="Sending domain" detail={d.sendingDomain || "No sending domain"} mono={Boolean(d.sendingDomain)} ok={d.domainVerified} />
            <CheckRow icon="shield-check" title="DKIM" detail="Signs each message as yours" ok={d.dkim} />
            <CheckRow icon="shield" title="SPF" detail="Lets our servers send for your domain" ok={d.spf} divider={false} />
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Deliverability" />}>
      <Text style={styles.lede}>Who your campaigns come from and whether your domain is set up. Change these on the dashboard.</Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
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
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowMono: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  rowDetail: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
