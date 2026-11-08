import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { teamOrgsLabel } from "@/lib/control_hint";
import type { TeamAuthResult } from "@/lib/team_auth";
import { useControl } from "@/state/control";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";

export default function TeamSignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { member } = useSession();
  const control = useControl();
  const { error } = useToast();
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "browser" | null>(null);

  const orgs = control.hint ? teamOrgsLabel(control.hint) : "";

  const finish = async (result: TeamAuthResult) => {
    if (!result.ok) {
      if (result.error) error(result.error);
      return;
    }
    await control.setMode("control");
    router.replace("/(control)");
  };

  const submitPassword = async () => {
    if (!email.trim() || !password) return error("Enter your Geiger email and password.");
    setBusy("password");
    const result = await control.signInWithPassword(email, password);
    setBusy(null);
    await finish(result);
  };

  const continueInBrowser = async () => {
    setBusy("browser");
    const result = await control.signInWithBrowser();
    setBusy(null);
    await finish(result);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Control" />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.headline}>Run your events{"\n"}from your phone.</Text>
        <Text style={styles.lede}>
          {orgs ? `You're on the team at ${orgs}. ` : ""}
          Sign in with your Geiger account — the one you use for the dashboard.
        </Text>

        <View style={styles.form}>
          <Field label="Email">
            <Input
              leftIcon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <Input
              leftIcon="shield"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={submitPassword}
              returnKeyType="go"
            />
          </Field>
          <Button
            title="Sign in to Control"
            onPress={submitPassword}
            loading={busy === "password"}
            disabled={busy !== null}
            fullWidth
          />
          <Text style={styles.or}>or</Text>
          <Button
            title="Continue with Google, SSO or passkey"
            icon="external-link"
            variant="secondary"
            onPress={continueInBrowser}
            loading={busy === "browser"}
            disabled={busy !== null}
            fullWidth
          />
        </View>

        <Text style={styles.note}>
          Your tickets stay signed in. Control has its own sign-in, and you can switch back any time.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  headline: {
    ...type.hero,
    color: colors.foreground,
  },
  lede: {
    ...type.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  or: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
  },
});
