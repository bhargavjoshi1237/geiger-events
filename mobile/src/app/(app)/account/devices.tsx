import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { fmtTimeAgo } from "@/lib/format";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { PortalDevice } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

function platformLabel(platform: string): string {
  if (platform === "ios") return "iPhone or iPad";
  if (platform === "android") return "Android device";
  if (platform === "web") return "Web browser";
  return "Unknown device";
}

function deviceIcon(platform: string): "smartphone" | "monitor" {
  return platform === "web" ? "monitor" : "smartphone";
}

export default function DevicesScreen() {
  const { token, pushToken, signOutEverywhere } = useSession();
  const [devices, setDevices] = useState<PortalDevice[] | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const fetchDevices = useCallback(() => {
    if (!token) return Promise.resolve<PortalDevice[]>([]);
    const query = pushToken ? `?current=${encodeURIComponent(pushToken)}` : "";
    return api<{ devices: PortalDevice[] }>(`/api/portal/devices${query}`, { token }).then((res) =>
      res.ok ? res.data.devices : [],
    );
  }, [token, pushToken]);

  useEffect(() => {
    let active = true;
    void fetchDevices().then((list) => {
      if (active) setDevices(list);
    });
    return () => {
      active = false;
    };
  }, [fetchDevices]);

  return (
    <Screen scroll>
      <ScreenHeader title="Devices" subtitle="Where you're signed in for push" />

      {devices === null ? (
        <SkeletonList rows={3} />
      ) : !devices.length ? (
        <EmptyState
          icon="smartphone"
          title="No devices registered"
          message="Turn on push notifications in More and this device will show up here."
        />
      ) : (
        <>
          <Animated.View layout={LinearTransition} style={styles.card}>
            {devices.map((d, idx) => (
              <Animated.View key={d.id} entering={FadeInDown.delay(stagger(idx)).springify()}>
                <ListRow
                  leading={<IconTile icon={deviceIcon(d.platform)} size={34} />}
                  title={platformLabel(d.platform)}
                  subtitle={[
                    d.appVersion ? `App ${d.appVersion}` : null,
                    d.lastSeenAt ? `last seen ${fmtTimeAgo(d.lastSeenAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={d.current ? <Pill label="This device" tone="success" /> : null}
                  divider={idx < devices.length - 1}
                />
              </Animated.View>
            ))}
          </Animated.View>

          <Text style={styles.note}>
            Each device registers once for push. Signing out of a device removes it from this list.
          </Text>
        </>
      )}

      <View style={styles.footer}>
        <Button
          title="Sign out of all devices"
          variant="destructive"
          icon="log-out"
          onPress={() => setConfirmAll(true)}
          fullWidth
        />
      </View>

      <Sheet visible={confirmAll} onClose={() => setConfirmAll(false)} title="Sign out everywhere?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            This signs every device using your account out at once.
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmAll(false)} />
            <Button
              title="Sign out all"
              variant="destructive"
              onPress={() => {
                setConfirmAll(false);
                void signOutEverywhere();
              }}
            />
          </View>
        </View>
      </Sheet>
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
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  footer: {
    marginTop: spacing.xl,
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
