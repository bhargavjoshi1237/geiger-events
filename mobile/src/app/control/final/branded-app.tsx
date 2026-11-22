import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { capitalize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { AppSectionKey, BrandedAppConfig, ShortcutKey } from "@/types/control_final";

type Section = { key: AppSectionKey; label: string; desc: string; icon: IconName };

const APP_SECTIONS: Section[] = [
  { key: "memberships", label: "Memberships", desc: "Plans, perks and renewals — its own tab.", icon: "id-card" },
  { key: "live", label: "Live rooms", desc: "Livestreams, webinars and breakouts.", icon: "radio" },
  { key: "watch", label: "Watch", desc: "Recordings, simulive premieres and replays.", icon: "circle-play" },
  { key: "orders", label: "Orders", desc: "Order history, receipts and refund status.", icon: "receipt" },
  { key: "community", label: "Group chats", desc: "Event chat channels and polls.", icon: "messages-square" },
  { key: "qa", label: "Q&A", desc: "Session questions and upvotes.", icon: "message-circle-question-mark" },
  { key: "messages", label: "Organiser messages", desc: "Attendee ↔ organiser support threads.", icon: "inbox" },
  { key: "notifications", label: "Updates", desc: "Announcements you send.", icon: "bell" },
];

// Saved now so organisers decide early; the app renders them as each one ships.
const CONFERENCE_SECTIONS: Section[] = [
  { key: "agenda", label: "Agenda", desc: "The schedule and each attendee's picks.", icon: "calendar-clock" },
  { key: "speakers", label: "Speakers", desc: "Speaker profiles and their sessions.", icon: "mic" },
  { key: "sponsors", label: "Sponsors", desc: "Sponsors and their resources.", icon: "handshake" },
  { key: "map", label: "Map", desc: "Venue map and the expo floor plan.", icon: "map-pin" },
  { key: "networking", label: "Networking", desc: "Attendee directory and meeting requests.", icon: "users-round" },
  { key: "discussions", label: "Discussions", desc: "Discussion boards.", icon: "message-square" },
];

const SHORTCUTS: { key: ShortcutKey; label: string; icon: IconName }[] = [
  { key: "community", label: "Group chat", icon: "messages-square" },
  { key: "watch", label: "Watch", icon: "circle-play" },
  { key: "memberships", label: "Membership", icon: "id-card" },
  { key: "live", label: "Live", icon: "radio" },
  { key: "orders", label: "Orders", icon: "receipt" },
  { key: "qa", label: "Q&A", icon: "message-circle-question-mark" },
];

const MAX_SHORTCUTS = 4;
const WELCOME_MAX = 280;
const stagger = (i: number) => Math.min(i, 8) * 50;

// What the one attendee app shows for this project's events; changes reach phones the next time the app opens.
export default function BrandedAppScreen() {
  const { project } = useControl();
  const query = useControlQuery<{ config: BrandedAppConfig }>(project ? `/api/control/final/projects/${project.id}/branded-app` : null, {
    refetchOnFocus: false,
  });

  if (query.data && project) {
    // Keyed by the saved config so a save re-seeds the form from what the server stored.
    return (
      <BrandedAppForm
        key={JSON.stringify(query.data.config)}
        saved={query.data.config}
        path={`/api/control/final/projects/${project.id}/branded-app`}
        onSaved={(config) => query.setData({ config })}
      />
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Branded App" />}>
      {!project ? (
        <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />
      ) : query.error ? (
        <EmptyState icon="circle-alert" title="Couldn't load the app settings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : (
        <SkeletonList rows={6} variant="divided" />
      )}
    </Screen>
  );
}

function BrandedAppForm({ saved, path, onSaved }: { saved: BrandedAppConfig; path: string; onSaved: (config: BrandedAppConfig) => void }) {
  const toast = useToast();
  const [config, setConfig] = useState<BrandedAppConfig>(saved);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify({ s: config.sections, h: config.home }) !== JSON.stringify({ s: saved.sections, h: saved.home });

  const setSection = (key: AppSectionKey, on: boolean) =>
    setConfig((c) => {
      const sections = { ...c.sections, [key]: on };
      // A section switched off takes its home shortcut with it, as on the dashboard.
      return { ...c, sections, home: { ...c.home, shortcuts: c.home.shortcuts.filter((s) => sections[s]) } };
    });

  const toggleShortcut = (key: ShortcutKey, on: boolean) => {
    if (on && config.home.shortcuts.length >= MAX_SHORTCUTS) {
      toast.info(`Home fits ${MAX_SHORTCUTS} shortcuts — turn one off first.`);
      return;
    }
    setConfig((c) => ({
      ...c,
      home: { ...c.home, shortcuts: on ? [...c.home.shortcuts, key] : c.home.shortcuts.filter((s) => s !== key) },
    }));
  };

  const moveShortcut = (from: number, to: number) =>
    setConfig((c) => {
      const list = [...c.home.shortcuts];
      const [key] = list.splice(from, 1);
      list.splice(to, 0, key);
      return { ...c, home: { ...c.home, shortcuts: list } };
    });

  const save = async () => {
    setBusy(true);
    const res = await controlApi<{ config: BrandedAppConfig }>(path, { method: "PUT", body: { sections: config.sections, home: config.home } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("App settings saved.");
    onSaved(res.data.config);
  };

  const wl = config.whiteLabel;
  const all = [...APP_SECTIONS, ...CONFERENCE_SECTIONS];
  const on = all.filter((s) => config.sections[s.key]).length;
  const shortcutsUsed = config.home.shortcuts.length;
  let step = 0;

  const sectionRows = (items: Section[]) =>
    items.map((s, i) => {
      const enabled = config.sections[s.key];
      return (
        <ListRow
          key={s.key}
          leading={<IconTile icon={s.icon} size={36} tone={enabled ? "neutral" : "outline"} />}
          title={s.label}
          subtitle={s.desc}
          trailing={<Switch value={enabled} onValueChange={(next) => setSection(s.key, next)} label={s.label} />}
          divider={i < items.length - 1}
        />
      );
    });

  return (
    <Screen
      scroll
      header={<ScreenHeader title="Branded App" right={<Button title="Save" size="sm" onPress={() => void save()} loading={busy} disabled={!dirty || busy} />} />}
    >
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            <IconTile icon="smartphone" size={56} />
            <View style={styles.heroText}>
              <Text style={styles.name} numberOfLines={2}>
                {wl.appName || "Geiger Events"}
              </Text>
              <Text style={styles.org} numberOfLines={1}>
                {wl.orgName || "No organisation name set"}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            {dirty ? <Pill label="Unsaved changes" tone="warning" /> : <Pill label="Up to date" tone="neutral" />}
            <Text style={styles.fact}>{`${on}/${all.length} sections`}</Text>
            <Text style={styles.fact}>{`v${wl.version}`}</Text>
          </View>
          <Text style={styles.lede}>One app for every attendee. Choose what it shows for this project&apos;s events; phones pick it up next time the app opens.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Sections">{sectionRows(APP_SECTIONS)}</ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Conference sections" footer="Saved now; the app shows each one as it ships.">
            {sectionRows(CONFERENCE_SECTIONS)}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Home" footer="The welcome note shows at the top of Home when attendees only follow this project.">
            <View style={styles.welcome}>
              <View style={styles.welcomeHead}>
                <Text style={styles.welcomeLabel}>Welcome note</Text>
                <Text style={[styles.counter, config.home.welcome.length >= WELCOME_MAX && styles.counterFull]}>{`${config.home.welcome.length}/${WELCOME_MAX}`}</Text>
              </View>
              <Input
                value={config.home.welcome}
                onChangeText={(welcome) => setConfig((c) => ({ ...c, home: { ...c.home, welcome: welcome.slice(0, WELCOME_MAX) } }))}
                placeholder="Welcome to the festival!"
                multiline
                textAlignVertical="top"
                style={styles.multiline}
              />
            </View>
            <ListRow
              leading={<IconTile icon="radio" size={36} tone={config.home.liveStrip ? "neutral" : "outline"} />}
              title="Live strip"
              subtitle="What's streaming now, across the top of Home"
              trailing={<Switch value={config.home.liveStrip} onValueChange={(next) => setConfig((c) => ({ ...c, home: { ...c.home, liveStrip: next } }))} label="Live strip" />}
            />
            <ListRow
              leading={<IconTile icon="receipt" size={36} tone={config.home.recentOrders ? "neutral" : "outline"} />}
              title="Recent orders"
              subtitle="The attendee's latest purchases"
              trailing={<Switch value={config.home.recentOrders} onValueChange={(next) => setConfig((c) => ({ ...c, home: { ...c.home, recentOrders: next } }))} label="Recent orders" />}
              divider={false}
            />
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup
            title="Home shortcuts"
            action={<CountBadge value={`${shortcutsUsed}/${MAX_SHORTCUTS}`} tone={shortcutsUsed >= MAX_SHORTCUTS ? "warning" : "neutral"} />}
            footer={`Home fits ${MAX_SHORTCUTS}. A shortcut needs its section switched on.`}
          >
            {SHORTCUTS.map((s, i) => {
              const picked = config.home.shortcuts.includes(s.key);
              const available = config.sections[s.key];
              return (
                <ListRow
                  key={s.key}
                  leading={<IconTile icon={s.icon} size={36} tone={picked ? "neutral" : "outline"} />}
                  title={s.label}
                  subtitle={available ? undefined : "Turn its section on first"}
                  trailing={<Switch value={picked} onValueChange={(next) => toggleShortcut(s.key, next)} label={s.label} disabled={!available} />}
                  divider={i < SHORTCUTS.length - 1}
                />
              );
            })}
          </ListGroup>
        </Animated.View>

        {shortcutsUsed > 1 ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Shortcut order" footer="Left to right on Home.">
              {config.home.shortcuts.map((key, i, list) => {
                const shortcut = SHORTCUTS.find((s) => s.key === key);
                return (
                  <ListRow
                    key={key}
                    leading={<Text style={styles.position}>{String(i + 1).padStart(2, "0")}</Text>}
                    title={shortcut?.label ?? key}
                    trailing={
                      <View style={styles.moves}>
                        <IconButton icon="arrow-up" label={`Move ${shortcut?.label ?? key} up`} variant="plain" size={32} iconSize={16} onPress={() => i > 0 && moveShortcut(i, i - 1)} />
                        <IconButton
                          icon="arrow-down"
                          label={`Move ${shortcut?.label ?? key} down`}
                          variant="plain"
                          size={32}
                          iconSize={16}
                          onPress={() => i < list.length - 1 && moveShortcut(i, i + 1)}
                        />
                      </View>
                    }
                    divider={i < list.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="White-label build" footer="Identity, theme and store builds are set on the dashboard.">
            <DetailRow label="App name" value={wl.appName || "Geiger Events"} icon="smartphone" />
            <DetailRow label="Organisation" value={wl.orgName || "Not set"} icon="building-2" />
            <DetailRow label="Version" value={wl.version} icon="tag" mono />
            <DetailRow label="Theme" value={capitalize(wl.themeMode)} icon="palette" divider={Boolean(wl.accent)} />
            {wl.accent ? <DetailRow label="Accent" value={wl.accent} icon="sparkles" mono divider={false} /> : null}
          </ListGroup>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
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
  org: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  fact: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  lede: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  welcome: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  welcomeHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  welcomeLabel: {
    ...type.micro,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  counter: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  counterFull: {
    color: colors.warning,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  position: {
    ...type.mono,
    width: 28,
    color: colors.textSecondary,
  },
  moves: {
    flexDirection: "row",
  },
});
