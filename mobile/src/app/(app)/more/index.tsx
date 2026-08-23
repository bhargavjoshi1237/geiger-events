import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { firstName } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

export default function MoreScreen() {
  const router = useRouter();
  const { counts } = usePortalData();
  const { member, signOut } = useSession();
  const scrollY = useSharedValue(0);
  const [confirmOut, setConfirmOut] = useState(false);

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="More" subtitle="Everything that's not a tab." scrollY={scrollY} />

      {/* Identity card doubles as the account entry point. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open account"
        onPress={() => router.push("/account")}
        style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
      >
        <Avatar name={member?.name} email={member?.email} size={44} />
        <View style={styles.profileStack}>
          <Text style={styles.profileName} numberOfLines={1}>
            {member?.name || firstName(member?.name, member?.email)}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {member?.email}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      <SectionTitle>Purchases</SectionTitle>
      <Card style={styles.groupCard}>
        <ListRow
          leading={<IconTile icon="shopping-bag" />}
          title="Orders"
          trailing={counts.orders ? <Count value={counts.orders} /> : null}
          onPress={() => router.push("/orders")}
        />
        <ListRow
          leading={<IconTile icon="check-circle" />}
          title="Memberships"
          trailing={counts.memberships ? <Count value={counts.memberships} /> : null}
          onPress={() => router.push("/memberships")}
          divider={false}
        />
      </Card>

      <SectionTitle>Community</SectionTitle>
      <Card style={styles.groupCard}>
        <ListRow
          leading={<IconTile icon="help-circle" />}
          title="Q&A"
          onPress={() => router.push("/qa")}
        />
        <ListRow
          leading={<IconTile icon="message-circle" />}
          title="Messages"
          trailing={counts.messages ? <Count value={counts.messages} /> : null}
          onPress={() => router.push("/messages")}
          divider={false}
        />
      </Card>

      <SectionTitle>Updates</SectionTitle>
      <Card style={styles.groupCard}>
        <ListRow
          leading={<IconTile icon="bell" />}
          title="Notifications"
          trailing={counts.notifications ? <Count value={counts.notifications} /> : null}
          onPress={() => router.push("/notifications")}
          divider={false}
        />
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card style={styles.groupCard}>
        <ListRow
          leading={<IconTile icon="log-out" danger />}
          title="Sign out"
          onPress={() => setConfirmOut(true)}
          divider={false}
        />
      </Card>

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

function IconTile({
  icon,
  danger,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  danger?: boolean;
}) {
  return (
    <View style={[styles.iconTile, danger && styles.iconTileDanger]}>
      <Feather name={icon} size={18} color={danger ? colors.danger : colors.textSecondary} />
    </View>
  );
}

function Count({ value }: { value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
  profileStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileName: {
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  profileEmail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  groupCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  iconTile: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.md,
  },
  iconTileDanger: {
    backgroundColor: `${colors.danger}14`,
  },
  count: {
    minWidth: 22,
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countText: {
    ...type.caption,
    color: colors.mutedForeground,
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
