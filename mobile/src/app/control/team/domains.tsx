import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { copyToClipboard, Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamDomains } from "@/types/control_team";

// Read-only: claiming a subdomain or pointing a custom domain needs DNS work, which stays on the dashboard.
export default function DomainsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const domains = useControlQuery<TeamDomains>(project ? `/api/control/team/${project.id}/domains` : null);
  const data = domains.data;

  return (
    <Screen scroll header={<ScreenHeader title="Custom Domains" />}>
      {domains.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load domains" message={domains.error} actionLabel="Try again" onAction={() => void domains.reload()} />
      ) : !data ? (
        <SkeletonList rows={3} variant="divided" />
      ) : !data.organization ? (
        <EmptyState icon="globe" title="No organisation" message="Domains belong to an organisation, and this project isn't in one." />
      ) : (
        <View>
          <Group>
            <ListRow
              leading={<IconTile icon="globe" size={34} tone={data.subdomain?.verified ? "success" : "neutral"} />}
              title={data.subdomain ? data.subdomain.address : "No subdomain yet"}
              subtitle={
                data.subdomainAddon
                  ? data.subdomain
                    ? `Your events at ${data.subdomain.address}`
                    : `Claim one like yourname.${data.rootDomain} on the dashboard.`
                  : "Subdomains aren't in this organisation's plan."
              }
              trailing={
                data.subdomain ? (
                  <View style={styles.trailing}>
                    <Pill label={data.subdomain.status} tone={data.subdomain.status === "active" ? "success" : "warning"} variant="outline" />
                    <IconButton icon="copy" label="Copy the address" variant="plain" size={36} iconSize={16} onPress={() => void copyToClipboard(`https://${data.subdomain?.address}`, toast.success)} />
                  </View>
                ) : undefined
              }
              divider
            />
            <ListRow
              leading={<IconTile icon="link" size={34} />}
              title="Custom domain"
              subtitle={
                data.customDomainAddon
                  ? `Point a CNAME at ${data.cnameTarget}, then connect it on the dashboard.`
                  : "Custom domains aren't in this organisation's plan."
              }
              divider={false}
            />
          </Group>
          <Text style={styles.note}>{`Organisation: ${data.organization.name}`}</Text>
          <Button
            title="Manage on the dashboard"
            icon="external-link"
            variant="secondary"
            onPress={() => void Linking.openURL(`${SUITE_ORIGIN}/events/project/${project?.id ?? ""}`)}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
