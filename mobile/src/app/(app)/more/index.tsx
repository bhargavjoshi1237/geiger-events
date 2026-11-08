import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { firstName } from "@/lib/format";
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
  const { member, signOut, pushStatus, setPushEnabled } = useSession();
  const { success, error } = useToast();
  const [confirmOut, setConfirmOut] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const activePlan = (data?.memberships || []).find((m) => m.status === "Active");
  const pushOn = pushStatus === "on";

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    const ok = await setPushEnabled(next);
    setPushBusy(false);
    if (!ok) {
      error("This device can't register for push notifications.");
      return;
    }
    success(next ? "Push notifications on." : "Push notifications off.");
  };

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
      icon: "bell",
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

      <RowGroup rows={library} onGo={(href) => router.push(href)} />
      <RowGroup rows={conversations} onGo={(href) => router.push(href)} />

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon={pushOn ? "bell" : "bell-off"} size={34} />}
          title="Push notifications"
          subtitle={
            pushStatus === "unsupported"
              ? "Not available on this device or build"
              : "Gate changes, refunds and going-live alerts"
          }
          trailing={
            <Switch
              value={pushOn}
              onValueChange={(next) => void togglePush(next)}
              label="Push notifications"
              disabled={pushBusy || pushStatus === "unsupported"}
            />
          }
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
