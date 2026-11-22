import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { AppSectionKey, BrandedAppConfig, ShortcutKey } from "@/types/control_final";

const APP_SECTIONS: { key: AppSectionKey; label: string; desc: string }[] = [
  { key: "memberships", label: "Memberships", desc: "Plans, perks and renewals — its own tab." },
  { key: "live", label: "Live rooms", desc: "Livestreams, webinars and breakouts." },
  { key: "watch", label: "Watch", desc: "Recordings, simulive premieres and replays." },
  { key: "orders", label: "Orders", desc: "Order history, receipts and refund status." },
  { key: "community", label: "Group chats", desc: "Event chat channels and polls." },
  { key: "qa", label: "Q&A", desc: "Session questions and upvotes." },
  { key: "messages", label: "Organiser messages", desc: "Attendee ↔ organiser support threads." },
  { key: "notifications", label: "Updates", desc: "Announcements you send." },
];

// Saved now so organisers decide early; the app renders them as each one ships.
const CONFERENCE_SECTIONS: { key: AppSectionKey; label: string; desc: string }[] = [
  { key: "agenda", label: "Agenda", desc: "The schedule and each attendee's picks." },
  { key: "speakers", label: "Speakers", desc: "Speaker profiles and their sessions." },
  { key: "sponsors", label: "Sponsors", desc: "Sponsors and their resources." },
  { key: "map", label: "Map", desc: "Venue map and the expo floor plan." },
  { key: "networking", label: "Networking", desc: "Attendee directory and meeting requests." },
  { key: "discussions", label: "Discussions", desc: "Discussion boards." },
];

const SHORTCUTS: { key: ShortcutKey; label: string }[] = [
  { key: "community", label: "Group chat" },
  { key: "watch", label: "Watch" },
  { key: "memberships", label: "Membership" },
  { key: "live", label: "Live" },
  { key: "orders", label: "Orders" },
  { key: "qa", label: "Q&A" },
];

const MAX_SHORTCUTS = 4;
const WELCOME_MAX = 280;

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

  const sectionGroup = (items: typeof APP_SECTIONS) => (
    <View style={styles.group}>
      {items.map((s, i) => (
        <ListRow
          key={s.key}
          title={s.label}
          subtitle={s.desc}
          trailing={<Switch value={config.sections[s.key]} onValueChange={(on) => setSection(s.key, on)} label={s.label} />}
          divider={i < items.length - 1}
        />
      ))}
    </View>
  );

  const wl = config.whiteLabel;

  return (
    <Screen
      scroll
      header={<ScreenHeader title="Branded App" right={<Button title="Save" size="sm" onPress={() => void save()} loading={busy} disabled={!dirty || busy} />} />}
    >
      <View style={styles.stack}>
        <Text style={styles.lede}>One app for every attendee. Choose what it shows for this project&apos;s events.</Text>

        <View>
          <SectionTitle variant="kicker">Sections</SectionTitle>
          {sectionGroup(APP_SECTIONS)}
        </View>

        <View>
          <SectionTitle variant="kicker">Conference sections</SectionTitle>
          <Text style={styles.note}>Saved now; the app shows each one as it ships.</Text>
          {sectionGroup(CONFERENCE_SECTIONS)}
        </View>

        <View>
          <SectionTitle variant="kicker">Home</SectionTitle>
          <View style={styles.card}>
            <Field label="Welcome note" hint={`${config.home.welcome.length}/${WELCOME_MAX} — shown at the top of Home when attendees only follow this project.`}>
              <Input
                value={config.home.welcome}
                onChangeText={(welcome) => setConfig((c) => ({ ...c, home: { ...c.home, welcome: welcome.slice(0, WELCOME_MAX) } }))}
                placeholder="Welcome to the festival!"
                multiline
                textAlignVertical="top"
                style={styles.multiline}
              />
            </Field>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Live strip</Text>
              <Switch value={config.home.liveStrip} onValueChange={(on) => setConfig((c) => ({ ...c, home: { ...c.home, liveStrip: on } }))} label="Live strip" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Recent orders</Text>
              <Switch
                value={config.home.recentOrders}
                onValueChange={(on) => setConfig((c) => ({ ...c, home: { ...c.home, recentOrders: on } }))}
                label="Recent orders"
              />
            </View>
          </View>
        </View>

        <View>
          <SectionTitle variant="kicker">{`Home shortcuts · ${config.home.shortcuts.length}/${MAX_SHORTCUTS}`}</SectionTitle>
          <View style={styles.group}>
            {SHORTCUTS.map((s, i) => {
              const on = config.home.shortcuts.includes(s.key);
              const available = config.sections[s.key];
              return (
                <ListRow
                  key={s.key}
                  title={s.label}
                  subtitle={available ? undefined : "Turn its section on first"}
                  trailing={<Switch value={on} onValueChange={(next) => toggleShortcut(s.key, next)} label={s.label} disabled={!available} />}
                  divider={i < SHORTCUTS.length - 1}
                />
              );
            })}
          </View>
          {config.home.shortcuts.length > 1 ? (
            <View style={[styles.group, styles.order]}>
              {config.home.shortcuts.map((key, i, list) => (
                <ListRow
                  key={key}
                  title={`${i + 1}. ${SHORTCUTS.find((s) => s.key === key)?.label ?? key}`}
                  trailing={
                    <View style={styles.moves}>
                      <IconButton icon="arrow-up" label="Move up" variant="plain" size={32} iconSize={16} onPress={() => i > 0 && moveShortcut(i, i - 1)} />
                      <IconButton icon="arrow-down" label="Move down" variant="plain" size={32} iconSize={16} onPress={() => i < list.length - 1 && moveShortcut(i, i + 1)} />
                    </View>
                  }
                  divider={i < list.length - 1}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View>
          <SectionTitle variant="kicker">White-label build</SectionTitle>
          <View style={styles.group}>
            <ListRow title="App name" subtitle={wl.appName || "Geiger Events"} />
            <ListRow title="Organisation" subtitle={wl.orgName || "Not set"} />
            <ListRow title="Version · theme" subtitle={`${wl.version} · ${wl.themeMode}`} divider={false} />
          </View>
          <Text style={styles.note}>Identity, theme and store builds are set on the dashboard.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  lede: {
    ...type.body,
    color: colors.textSecondary,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  order: {
    marginTop: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchLabel: {
    ...type.label,
    color: colors.foreground,
  },
  moves: {
    flexDirection: "row",
  },
});
