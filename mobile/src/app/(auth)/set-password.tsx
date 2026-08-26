import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import * as auth from "@/lib/auth";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

export default function SetPasswordScreen() {
  const router = useRouter();
  const session = useSession();
  const { error } = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!token) return error("This link is invalid or expired.");
    if (password.length < 8)
      return error("Password must be at least 8 characters.");
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
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.markTile}>
            <BrandMark size={24} />
          </View>
          <Text style={styles.title}>Choose a password</Text>
          <Text style={styles.subtitle}>Set one for your account to sign in anywhere.</Text>

          <View style={styles.form}>
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
              />
            </Field>
            <Button
              title="Set password & sign in"
              onPress={submit}
              loading={busy}
              fullWidth
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
              onPress={() => router.replace("/(auth)/sign-in")}
              hitSlop={8}
              style={styles.link}
            >
              <Text style={styles.linkText}>Back to sign in</Text>
            </Pressable>
          </View>
        </View>
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
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  markTile: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceCard,
    marginBottom: spacing.xs,
  },
  title: {
    ...type.title,
    color: colors.foreground,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  link: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
  },
  linkText: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
