import { useRouter, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ToolGrid, ToolTile } from "@/components/control/ToolTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { pluralize } from "@/lib/format";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { IconName } from "@/components/ui/icons";
import type { ControlSection } from "@/types/portal";

type Hit = { id: string; title: string; icon: IconName; crumb: string; href: Href };

const stagger = (i: number) => Math.min(i, 10) * 30;

// Every screen, list and settings page in one flat index, so search can reach any of them in one step.
function indexOf(sections: ControlSection[]): (Hit & { haystack: string })[] {
  return sections.flatMap((section) => [
    ...section.screens.map((s) => ({
      id: `screen:${s.id}`,
      title: s.title,
      icon: iconOf(s.icon),
      crumb: `${section.title} · Tool`,
      href: s.route as Href,
      haystack: `${s.title} ${s.description ?? ""} ${section.title}`.toLowerCase(),
    })),
    ...section.modules.map((m) => ({
      id: `module:${m.id}`,
      title: m.title,
      icon: iconOf(m.icon),
      crumb: `${section.title} · List`,
      href: { pathname: "/control/records/[module]", params: { module: m.id } } as Href,
      haystack: `${m.title} ${m.description ?? ""} ${section.title}`.toLowerCase(),
    })),
    ...section.settings.map((s) => ({
      id: `setting:${s.id}`,
      title: s.title,
      icon: iconOf(s.icon, "settings"),
      crumb: `${section.title} · Settings`,
      href: { pathname: "/control/settings/[setting]", params: { setting: s.id } } as Href,
      haystack: `${s.title} ${s.description ?? ""} ${section.title} settings`.toLowerCase(),
    })),
  ]);
}

const areaCount = (s: ControlSection) => s.screens.length + s.modules.length + s.settings.length;

// Every dashboard area this role can open, in sidebar order.
export default function ManageScreen() {
  const router = useRouter();
  const { project } = useControl();
  const catalog = useControlCatalog();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => catalog.data?.sections ?? [], [catalog.data]);
  const index = useMemo(() => indexOf(sections), [sections]);
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? index.filter((hit) => hit.haystack.includes(q)) : []), [index, q]);

  let body: React.ReactNode;
  if (catalog.error && !catalog.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load what you can manage" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />;
  } else if (!catalog.data) {
    body = <SkeletonList rows={6} variant="card" />;
  } else if (!sections.length) {
    body = <EmptyState icon="shield" title="Nothing to manage here" message="Your role in this project doesn't open any of these areas. Ask a project admin for access." />;
  } else if (q) {
    body = hits.length ? (
      <ListGroup title={`${hits.length} ${pluralize(hits.length, "match", "matches")}`}>
        {hits.map((hit, i) => (
          <ListRow key={hit.id} leading={<IconTile icon={hit.icon} size={36} />} title={hit.title} subtitle={hit.crumb} onPress={() => router.push(hit.href)} divider={i < hits.length - 1} />
        ))}
      </ListGroup>
    ) : (
      <EmptyState icon="search-x" title="Nothing called that" message="Try the area's name as it reads in the dashboard sidebar." actionLabel="Clear search" onAction={() => setQuery("")} />
    );
  } else {
    body = (
      <ToolGrid>
        {sections.map((section, i) => (
          <Animated.View key={section.key} entering={FadeInDown.delay(stagger(i)).springify()} style={styles.cell}>
            <ToolTile
              icon={iconOf(section.icon)}
              title={section.title}
              detail={`${areaCount(section)} ${pluralize(areaCount(section), "area", "areas")}`}
              onPress={() => router.push({ pathname: "/control/manage/[section]", params: { section: section.key } })}
            />
          </Animated.View>
        ))}
      </ToolGrid>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Manage" subtitle={project?.name} />}>
      <View style={styles.head}>
        <Text style={styles.title}>Everything your role opens</Text>
        <Text style={styles.lede}>
          {sections.length ? `${sections.length} ${pluralize(sections.length, "section", "sections")} · ${index.length} ${pluralize(index.length, "area", "areas")}, in dashboard order.` : "The same areas as the dashboard sidebar."}
        </Text>
      </View>
      {sections.length ? (
        <View style={styles.search}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Find a tool, list or setting…" autoCapitalize="none" autoCorrect={false} />
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.title,
    color: colors.foreground,
  },
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  search: {
    marginBottom: spacing.lg,
  },
  cell: {
    flex: 1,
  },
});
