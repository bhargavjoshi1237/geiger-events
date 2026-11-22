import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import type { PushPermission } from "@/lib/push";
import { PUSH_CATEGORIES } from "@/lib/push_catalog";
import { usePushPermission, usePushPreferences, usePushToggle } from "@/lib/use_push_settings";
import { colors, radius, spacing, type } from "@/theme/tokens";

const stagger = (i: number) => Math.min(i, 11) * 40;

const PERMISSION_COPY: Record<
  PushPermission,
  { title: string; subtitle: string; icon: IconName; tone: "neutral" | "success" | "danger" | "outline" }
> = {
  granted: {
    title: "Allowed",
    subtitle: "Geiger Events can show notifications on this device",
    icon: "circle-check",
    tone: "success",
  },
  denied: {
    title: "Blocked",
    subtitle: "Turn notifications on for Geiger Events in system settings",
    icon: "circle-alert",
    tone: "danger",
  },
  undetermined: {
    title: "Not allowed yet",
    subtitle: "Allow notifications to hear about tickets and event changes",
    icon: "geiger",
    tone: "neutral",
  },
  unavailable: {
    title: "Not available",
    subtitle: "Notifications need the installed app, not Expo Go",
    icon: "smartphone",
    tone: "outline",
  },
};

export default function NotificationSettingsScreen() {
  const { pushOn, unsupported, busy, toggle } = usePushToggle();
  const { permission, refresh, request, openSettings } = usePushPermission();
  const { prefs, failed, retry, setCategory } = usePushPreferences();

  const togglePush = async (next: boolean) => {
    await toggle(next);
    void refresh();
  };

  // Turning push on asks for permission and registers in one step.
  const allow = async () => {
    if (pushOn) await request();
    else await togglePush(true);
  };

  const copy = permission ? PERMISSION_COPY[permission] : null;

  return (
    <Screen scroll>
      <ScreenHeader title="Notifications" subtitle="What reaches this device" />

      <SectionTitle variant="kicker">This device</SectionTitle>
      <View style={styles.card}>
        {copy ? (
          <ListRow
            leading={<IconTile icon={copy.icon} size={34} tone={copy.tone} />}
            title={copy.title}
            subtitle={copy.subtitle}
            trailing={
              permission === "denied" ? (
                <Button title="Open settings" size="sm" variant="secondary" onPress={openSettings} />
              ) : permission === "undetermined" ? (
                <Button
                  title="Allow"
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onPress={() => void allow()}
                />
              ) : null
            }
          />
        ) : (
          <ListRow
            leading={<IconTile icon="geiger" size={34} tone="outline" />}
            title="System permission"
            subtitle="Checking…"
          />
        )}
        <ListRow
          leading={<IconTile icon="geiger" size={34} tone={pushOn ? "neutral" : "outline"} />}
          title="Push notifications"
          subtitle={
            unsupported
              ? "Not available on this device or build"
              : pushOn
                ? "This device is registered for push"
                : "Off on this device"
          }
          trailing={
            <Switch
              value={pushOn}
              onValueChange={(next) => void togglePush(next)}
              label="Push notifications"
              disabled={busy || unsupported}
            />
          }
          divider={false}
        />
      </View>

      <SectionTitle variant="kicker">Notify me about</SectionTitle>
      {failed ? (
        <EmptyState
          icon="wifi-off"
          title="Couldn't load your settings"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
        />
      ) : !prefs ? (
        <SkeletonList rows={PUSH_CATEGORIES.length} variant="divided" />
      ) : (
        <Animated.View layout={LinearTransition} style={[styles.card, styles.categories]}>
          {PUSH_CATEGORIES.map((c, idx) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(stagger(idx)).springify()}>
              <ListRow
                title={c.label}
                subtitle={c.description}
                trailing={
                  <Switch
                    value={prefs[c.key]}
                    onValueChange={(next) => setCategory(c.key, next)}
                    label={c.label}
                  />
                }
                divider={idx < PUSH_CATEGORIES.length - 1}
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}

      <Text style={styles.note}>
        These choices follow your account to every device you sign in on.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  categories: {
    marginBottom: 0,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
