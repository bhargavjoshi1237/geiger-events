import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import * as auth from "@/lib/auth";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";

export default function SetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { error } = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!token) return error("This link is invalid or expired.");
    if (password.length < 8) return error("Password must be at least 8 characters.");
    setBusy(true);
    const res = await auth.setPassword(token, password);
    setBusy(false);
    if (!res.ok) return error(res.error);
    await session.signIn(res.data.token);
    router.replace("/(app)/home");
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandMark size={36} color={colors.foreground} />
        <Text style={styles.headline}>Choose a{"\n"}password.</Text>
        <Text style={styles.lede}>Set one for your account so you can sign in anywhere.</Text>

        <Field label="New password" hint="At least 8 characters.">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••"
            onSubmitEditing={submit}
            returnKeyType="go"
            style={styles.tallInput}
          />
        </Field>
        <Button title="Set password & sign in" onPress={submit} loading={busy} fullWidth />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          onPress={() => router.replace("/(auth)/sign-in")}
          hitSlop={8}
          style={styles.link}
        >
          <Text style={styles.linkText}>Back to sign in</Text>
        </Pressable>
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
    gap: spacing.md,
    paddingHorizontal: spacing.xl + 4,
  },
  headline: {
    ...type.hero,
    color: colors.foreground,
    marginTop: spacing.xxl,
  },
  lede: {
    ...type.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mutedForeground,
    marginBottom: spacing.xl,
  },
  tallInput: {
    minHeight: 56,
  },
  link: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  linkText: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
