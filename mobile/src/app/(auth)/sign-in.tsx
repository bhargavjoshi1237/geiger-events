import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import * as auth from "@/lib/auth";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Step = "email" | "password" | "setup-prompt" | "check-email" | "no-account";

const FEATURES = [
  { icon: "credit-card" as const, label: "All your tickets in one place" },
  { icon: "maximize" as const, label: "Scan to get in at the door" },
  { icon: "calendar" as const, label: "Add events to your calendar" },
];

export default function SignInScreen() {
  const router = useRouter();
  const session = useSession();
  const { error } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    setBusy(true);
    const res = await auth.lookupEmail(email.trim());
    setBusy(false);
    if (!res.ok) return error(res.error);
    if (res.data.exists && res.data.hasPassword) setStep("password");
    else if (res.data.exists) setStep("setup-prompt");
    else setStep("no-account");
  };

  const submitPassword = async () => {
    setBusy(true);
    const res = await auth.login(email.trim(), password);
    setBusy(false);
    if (!res.ok) return error(res.error);
    await session.signIn(res.data.token);
    router.replace("/(app)/home");
  };

  const sendSetup = async () => {
    setBusy(true);
    await auth.requestSetup(email.trim());
    setBusy(false);
    setStep("check-email");
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
          <View style={styles.header}>
            <View style={styles.markTile}>
              <BrandMark size={24} />
            </View>
            <Text style={styles.title}>Geiger Events</Text>
            <Text style={styles.subtitle}>Your tickets, orders, and memberships.</Text>
          </View>

          <Animated.View
            key={step}
            entering={FadeInRight.duration(220).withInitialValues({ translateX: 12 })}
            exiting={FadeOutLeft.duration(160).withTargetValues({ translateX: -12 })}
          >
            {step === "email" ? (
              <View style={styles.step}>
                <Field label="Email">
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                    onSubmitEditing={submitEmail}
                    returnKeyType="go"
                  />
                </Field>
                <Button title="Continue" onPress={submitEmail} loading={busy} fullWidth />
                <View style={styles.divider} />
                {FEATURES.map((f) => (
                  <View key={f.label} style={styles.feature}>
                    <Feather name={f.icon} size={16} color={colors.mutedForeground} />
                    <Text style={styles.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {step === "password" ? (
              <View style={styles.step}>
                <Text style={styles.emailText}>{email}</Text>
                <Field label="Password">
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    autoFocus
                    placeholder="••••••••"
                    onSubmitEditing={submitPassword}
                    returnKeyType="go"
                  />
                </Field>
                <Button title="Log in" onPress={submitPassword} loading={busy} fullWidth />
                <TextLink label="Forgot password?" onPress={sendSetup} />
              </View>
            ) : null}

            {step === "setup-prompt" ? (
              <View style={styles.step}>
                <Text style={styles.bodyText}>
                  Your account <Text style={styles.emphasis}>{email}</Text> needs a
                  password. We&apos;ll email you a secure link to set one.
                </Text>
                <Button
                  title="Email me a set-up link"
                  onPress={sendSetup}
                  loading={busy}
                  fullWidth
                />
              </View>
            ) : null}

            {step === "check-email" ? (
              <View style={styles.centeredStep}>
                <Feather name="mail" size={28} color={colors.textTertiary} />
                <Text style={styles.bodyText}>
                  If <Text style={styles.emphasis}>{email}</Text> has an account, a link
                  is on its way. Check your inbox to set your password.
                </Text>
              </View>
            ) : null}

            {step === "no-account" ? (
              <View style={styles.centeredStep}>
                <Text style={styles.bodyText}>
                  We couldn&apos;t find an account for{" "}
                  <Text style={styles.emphasis}>{email}</Text>. Buy a ticket to any event
                  and your account is created automatically.
                </Text>
                <TextLink
                  label="Try another email"
                  onPress={() => {
                    setStep("email");
                  }}
                />
              </View>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.link}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
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
    gap: spacing.xl,
  },
  header: {
    alignItems: "flex-start",
    gap: spacing.xs,
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
  step: {
    gap: spacing.lg,
  },
  centeredStep: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  featureLabel: {
    ...type.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emailText: {
    ...type.label,
    color: colors.textSecondary,
  },
  bodyText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emphasis: {
    color: colors.foreground,
    fontWeight: "600",
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
