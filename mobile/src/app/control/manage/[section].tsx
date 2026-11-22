import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { pluralize } from "@/lib/format";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlSection } from "@/types/portal";

const stagger = (i: number) => i * 60;

function countLine(section: ControlSection): string {
  return [
    section.screens.length ? `${section.screens.length} ${pluralize(section.screens.length, "tool", "tools")}` : "",
    section.modules.length ? `${section.modules.length} ${pluralize(section.modules.length, "list", "lists")}` : "",
    section.settings.length ? `${section.settings.length} settings ${pluralize(section.settings.length, "page", "pages")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ManageSectionScreen() {
  const router = useRouter();
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const catalog = useControlCatalog();
  const section = catalog.data?.sections.find((s) => s.key === key);
  let step = 0;

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
          <View style={styles.head}>
            <IconTile icon={iconOf(section.icon)} size={52} />
            <View style={styles.headText}>
              <Text style={styles.title} numberOfLines={2}>
                {section.title}
              </Text>
              <Text style={styles.count}>{countLine(section)}</Text>
            </View>
          </View>

          {section.screens.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Tools">
                {section.screens.map((s, i) => (
                  <ListRow
                    key={s.id}
                    leading={<IconTile icon={iconOf(s.icon)} size={36} />}
                    title={s.title}
                    subtitle={s.description}
                    onPress={() => router.push(s.route as Href)}
                    divider={i < section.screens.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          {section.modules.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Lists">
                {section.modules.map((m, i) => (
                  <ListRow
                    key={m.id}
                    leading={<IconTile icon={iconOf(m.icon)} size={36} />}
                    title={m.title}
                    subtitle={m.description}
                    onPress={() => router.push({ pathname: "/control/records/[module]", params: { module: m.id } })}
                    divider={i < section.modules.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          {section.settings.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Settings">
                {section.settings.map((s, i) => (
                  <ListRow
                    key={s.id}
                    leading={<IconTile icon={iconOf(s.icon, "settings")} size={36} tone="outline" />}
                    title={s.title}
                    subtitle={s.description}
                    onPress={() => router.push({ pathname: "/control/settings/[setting]", params: { setting: s.id } })}
                    divider={i < section.settings.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    marginTop: spacing.sm,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    ...type.title,
    color: colors.foreground,
  },
  count: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
});
