import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { pluralize } from "@/lib/format";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { colors, radius, spacing, type } from "@/theme/tokens";

// Every dashboard area this role can open, in sidebar order.
export default function ManageScreen() {
  const router = useRouter();
  const catalog = useControlCatalog();
  const sections = catalog.data?.sections ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Manage" />}>
      <Text style={styles.lede}>Everything your role can manage on the dashboard, from your phone.</Text>
      {catalog.error && !catalog.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load what you can manage" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />
      ) : !catalog.data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !sections.length ? (
        <EmptyState icon="shield" title="Nothing to manage here" message="Your role in this project doesn't open any of these areas. Ask a project admin for access." />
      ) : (
        <View style={styles.group}>
          {sections.map((section, i) => (
            <ListRow
              key={section.key}
              leading={<IconTile icon={iconOf(section.icon)} size={34} />}
              title={section.title}
              subtitle={`${section.screens.length + section.modules.length + section.settings.length} ${pluralize(section.screens.length + section.modules.length + section.settings.length, "area", "areas")}`}
              onPress={() => router.push({ pathname: "/control/manage/[section]", params: { section: section.key } })}
              divider={i < sections.length - 1}
            />
          ))}
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
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
