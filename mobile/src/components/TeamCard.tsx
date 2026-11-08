import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { teamOrgsLabel } from "@/lib/control_hint";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";

const DISMISSED_KEY = "geiger.team.hint.dismissed";

// Shown once to an attendee the server recognises as a teammate; "Not now" is remembered on this device.
export function TeamCard() {
  const router = useRouter();
  const { hint, teamStatus } = useControl();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    void SecureStore.getItemAsync(DISMISSED_KEY)
      .catch(() => null)
      .then((value) => setDismissed(value === "1"));
  }, []);

  if (dismissed !== false || teamStatus !== "signedOut" || !hint?.team.available) return null;

  const dismiss = () => {
    setDismissed(true);
    void SecureStore.setItemAsync(DISMISSED_KEY, "1").catch(() => undefined);
  };

  return (
    <Card tone="subtle">
      <Text style={styles.title}>You&apos;re on the team at {teamOrgsLabel(hint)}</Text>
      <Text style={styles.body}>
        Open Control to see your events and your role. Your tickets stay right here.
      </Text>
      <View style={styles.actions}>
        <Button title="Not now" size="sm" variant="ghost" onPress={dismiss} />
        <Button title="Open Control" size="sm" onPress={() => router.push("/team-sign-in")} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
