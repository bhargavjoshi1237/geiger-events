import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CodeRow } from "@/components/control/team/CodeRow";
import { copyToClipboard } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { capitalize } from "@/lib/format";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamDomains } from "@/types/control_team";

const stagger = (i: number) => Math.min(i, 8) * 50;

// Read-only: claiming a subdomain or pointing a custom domain needs DNS work, which stays on the dashboard.
export default function DomainsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const domains = useControlQuery<TeamDomains>(project ? `/api/control/team/${project.id}/domains` : null);
  const data = domains.data;

  let body: React.ReactNode;
  if (domains.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load domains" message={domains.error} actionLabel="Try again" onAction={() => void domains.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={3} variant="divided" />;
  } else if (!data.organization) {
    body = <EmptyState icon="globe" title="No organisation" message="Domains belong to an organisation, and this project isn't in one." />;
  } else {
    const sub = data.subdomain;
    const active = sub?.status === "active";
    let step = 0;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <IconTile icon="building-2" size={52} />
          <View style={styles.heroText}>
            <Text style={styles.name} numberOfLines={2}>
              {data.organization.name}
            </Text>
            <Text style={styles.root} numberOfLines={1}>
              {data.rootDomain}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup
            title="Subdomain"
            footer={
              data.subdomainAddon
                ? sub
                  ? `Your events live at ${sub.address}.`
                  : `Claim one like yourname.${data.rootDomain} on the dashboard.`
                : "Subdomains aren't in this organisation's plan."
            }
          >
            {sub ? (
              <CodeRow
                icon="globe"
                tone={sub.verified ? "success" : "warning"}
                label={sub.verified ? "Verified address" : "Not verified yet"}
                value={sub.address}
                trailing={<Pill label={capitalize(sub.status)} tone={active ? "success" : "warning"} />}
                onCopy={() => void copyToClipboard(`https://${sub.address}`, toast.success)}
                copyLabel="Copy the address"
                divider={false}
              />
            ) : (
              <ListRow
                leading={<IconTile icon="globe" size={36} tone="outline" />}
                title="No subdomain yet"
                subtitle={data.subdomainAddon ? "Claim it on the dashboard" : "Not in your plan"}
                divider={false}
              />
            )}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup
            title="Custom domain"
            footer={data.customDomainAddon ? "Point a CNAME record at this target, then connect the domain on the dashboard." : "Custom domains aren't in this organisation's plan."}
          >
            {data.customDomainAddon ? (
              <CodeRow icon="link" label="CNAME target" value={data.cnameTarget} divider={false} />
            ) : (
              <ListRow leading={<IconTile icon="link" size={36} tone="outline" />} title="Custom domain" subtitle="Not in your plan" divider={false} />
            )}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Button
            title="Manage on the dashboard"
            icon="external-link"
            variant="secondary"
            onPress={() => void Linking.openURL(`${SUITE_ORIGIN}/events/project/${project?.id ?? ""}`)}
            fullWidth
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Custom Domains" />}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingTop: spacing.sm,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  root: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
});
