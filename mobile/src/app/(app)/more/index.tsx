import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { teamOrgsLabel } from "@/lib/control_hint";
import { firstName, pluralize } from "@/lib/format";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useModeSwitch } from "@/lib/use_mode_switch";
import { usePushToggle } from "@/lib/use_push_settings";
import { useControl } from "@/state/control";
import { useAppConfig } from "@/state/app_config";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

type MoreRow = { key: string; icon: IconName; title: string; trailing?: React.ReactNode; href: Href };

const when = (on: boolean, row: MoreRow): MoreRow[] => (on ? [row] : []);

export default function MoreScreen() {
  const router = useRouter();
  const { counts, data } = usePortalData();
  const { isOn } = useAppConfig();
  const { member, signOut } = useSession();
  const push = usePushToggle();
  const [confirmOut, setConfirmOut] = useState(false);

  const activePlan = (data?.memberships || []).find((m) => m.status === "Active");

  const library: MoreRow[] = [
    ...when(isOn("memberships"), {
      key: "memberships",
      icon: "award",
      title: "Memberships",
      trailing: activePlan ? <Trailing label={activePlan.planName} /> : null,
      href: "/memberships",
    }),
    ...when(isOn("orders"), {
      key: "orders",
      icon: "shopping-bag",
      title: "Orders & receipts",
      trailing: counts.orders ? <Trailing label={String(counts.orders)} /> : null,
      href: "/orders",
    }),
    ...when(isOn("watch"), {
      key: "watch",
      icon: "circle-play",
      title: "Watch library",
      trailing: counts.watch ? <Trailing label={String(counts.watch)} /> : null,
      href: "/watch",
    }),
    ...when(isOn("qa"), { key: "qa", icon: "circle-question-mark", title: "Q&A threads", href: "/qa" }),
  ];

  const conversations: MoreRow[] = [
    ...when(isOn("community"), {
      key: "community",
      icon: "message-circle",
      title: "Group chats",
      trailing: counts.chats ? <Badge value={counts.chats} /> : null,
      href: "/community",
    }),
    ...when(isOn("messages"), {
      key: "messages",
      icon: "mail",
      title: "Organiser messages",
      trailing: counts.messages ? <Badge value={counts.messages} /> : null,
      href: "/messages",
    }),
    ...when(isOn("notifications"), {
      key: "notifications",
      icon: "geiger",
      title: "Updates",
      trailing: counts.notifications ? <Badge value={counts.notifications} /> : null,
      href: "/notifications",
    }),
  ];

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open account"
        onPress={() => router.push("/account")}
        style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
      >
        <Avatar name={member?.name} email={member?.email} size={60} />
        <View style={styles.profileStack}>
          <Text style={styles.profileName} numberOfLines={1}>
            {member?.name || firstName(member?.name, member?.email)}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {member?.email}
          </Text>
        </View>
        <Icon name="chevron-right" size={19} color={colors.textTertiary} />
      </Pressable>

      <TeamEntry />
      <RowGroup rows={library} onGo={(href) => router.push(href)} />
      <RowGroup rows={conversations} onGo={(href) => router.push(href)} />

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="geiger" size={34} tone={push.pushOn ? "neutral" : "outline"} />}
          title="Push notifications"
          subtitle={
            push.unsupported
              ? "Not available on this device or build"
              : "Gate changes, refunds and going-live alerts"
          }
          trailing={
            <Switch
              value={push.pushOn}
              onValueChange={(next) => void push.toggle(next)}
              label="Push notifications"
              disabled={push.busy || push.unsupported}
            />
          }
        />
        <ListRow
          leading={<IconTile icon="settings" size={34} />}
          title="Notification settings"
          subtitle="Choose what you're notified about"
          onPress={() => router.push("/account/notifications" as Href)}
          divider={false}
        />
      </View>

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="shield" size={34} />}
          title="Password & sessions"
          onPress={() => router.push("/account/change-password")}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out"
          onPress={() => setConfirmOut(true)}
          chevron={false}
          divider={false}
        />
      </View>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>You&apos;ll need to sign in again to get back in.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmOut(false)} />
            <Button
              title="Sign out"
              variant="destructive"
              onPress={() => {
                setConfirmOut(false);
                void signOut();
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

// Always present so an organiser can reach Control even when detection misses them (a different dashboard email, a failed check).
function TeamEntry() {
  const router = useRouter();
  const { teamStatus, hint, profile } = useControl();
  const { toControl } = useModeSwitch();

  const count = profile?.projects.length ?? 0;
  const signedIn = teamStatus === "signedIn";

  return (
    <>
      <SectionTitle variant="kicker">Event team</SectionTitle>
      <View style={styles.group}>
        {signedIn ? (
          <ListRow
            leading={<IconTile icon="shield" size={34} tone="success" />}
            title="Switch to Control"
            subtitle={count ? `Run ${count} ${pluralize(count, "project", "projects")} from your phone` : "Run your events from here"}
            onPress={() => void toControl()}
            divider={Boolean(hint?.team.invited)}
          />
        ) : (
          <ListRow
            leading={<IconTile icon="shield" size={34} />}
            title="Sign in to Control"
            subtitle={
              hint?.team.available
                ? `You're on the team at ${teamOrgsLabel(hint)}`
                : "For organisers and event staff — use your dashboard account"
            }
            onPress={() => router.push("/team-sign-in")}
            divider={Boolean(hint?.team.invited)}
          />
        )}
        {hint?.team.invited ? (
          <ListRow
            leading={<IconTile icon="mail" size={34} />}
            title="Team invitation waiting"
            subtitle="Accept it on geiger.studio, then sign in to Control here"
            onPress={() => void Linking.openURL(SUITE_ORIGIN)}
            divider={false}
          />
        ) : null}
      </View>
    </>
  );
}

// An organiser can switch every row of a group off, so an empty group renders nothing.
function RowGroup({ rows, onGo }: { rows: MoreRow[]; onGo: (href: Href) => void }) {
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <ListRow
          key={row.key}
          leading={<IconTile icon={row.icon} size={34} />}
          title={row.title}
          trailing={row.trailing}
          onPress={() => onGo(row.href)}
          divider={i < rows.length - 1}
        />
      ))}
    </View>
  );
}

function Trailing({ label }: { label: string }) {
  return (
    <Text style={styles.trailing} numberOfLines={1}>
      {label}
    </Text>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{value > 99 ? "99+" : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: spacing.md + 2,
    paddingBottom: 22,
  },
  pressed: {
    opacity: 0.7,
  },
  profileStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileName: {
    ...type.title,
    fontSize: 18,
    lineHeight: 22,
    color: colors.foreground,
  },
  profileEmail: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  trailing: {
    ...type.caption,
    fontSize: 13,
    maxWidth: 140,
    color: colors.textSecondary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
  },
  badgeText: {
    ...type.micro,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
