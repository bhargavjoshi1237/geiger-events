import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { colors, radius, spacing } from "@/theme/tokens";

export default function ManageSectionScreen() {
  const router = useRouter();
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const catalog = useControlCatalog();
  const section = catalog.data?.sections.find((s) => s.key === key);

  return (
    <Screen scroll header={<ScreenHeader title={section?.title ?? "Manage"} />}>
      {catalog.error && !catalog.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load this area" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />
      ) : !catalog.data ? (
        <SkeletonList rows={4} variant="divided" />
      ) : !section ? (
        <EmptyState icon="shield" title="Not available" message="Your role can't open this area in this project." />
      ) : (
        <View style={styles.stack}>
          {section.screens.length ? (
            <View style={styles.group}>
              {section.screens.map((s, i) => (
                <ListRow
                  key={s.id}
                  leading={<IconTile icon={iconOf(s.icon)} size={34} />}
                  title={s.title}
                  subtitle={s.description}
                  onPress={() => router.push(s.route as Href)}
                  divider={i < section.screens.length - 1}
                />
              ))}
            </View>
          ) : null}
          {section.modules.length ? (
            <View style={styles.group}>
              {section.modules.map((m, i) => (
                <ListRow
                  key={m.id}
                  leading={<IconTile icon={iconOf(m.icon)} size={34} />}
                  title={m.title}
                  subtitle={m.description}
                  onPress={() => router.push({ pathname: "/control/records/[module]", params: { module: m.id } })}
                  divider={i < section.modules.length - 1}
                />
              ))}
            </View>
          ) : null}
          {section.settings.length ? (
            <View>
              <SectionTitle variant="kicker">Settings</SectionTitle>
              <View style={styles.group}>
                {section.settings.map((s, i) => (
                  <ListRow
                    key={s.id}
                    leading={<IconTile icon={iconOf(s.icon, "settings")} size={34} />}
                    title={s.title}
                    subtitle={s.description}
                    onPress={() => router.push({ pathname: "/control/settings/[setting]", params: { setting: s.id } })}
                    divider={i < section.settings.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
