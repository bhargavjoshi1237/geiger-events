import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { spacing } from "@/theme/tokens";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { token } = useSession();
  const { success, error } = useToast();
  const scrollY = useSharedValue(0);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 8) return error("New password must be at least 8 characters.");
    if (next !== confirm) return error("New passwords don't match.");
    if (!token) return;
    setBusy(true);
    const res = await api<{ ok?: boolean }>("/api/portal/change-password", {
      method: "POST",
      token,
      body: { currentPassword: current, newPassword: next },
    });
    setBusy(false);
    if (!res.ok) return error(res.error || "Couldn't update your password.");
    success("Password updated.");
    router.back();
  };

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="Change password" subtitle="Use at least 8 characters." scrollY={scrollY} />
      <View style={styles.form}>
        <Field label="Current password">
          <Input
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <Input
            value={next}
            onChangeText={setNext}
            secureTextEntry
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </Field>
        <Button title="Update password" onPress={submit} loading={busy} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
