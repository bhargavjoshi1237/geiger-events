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
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icons";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import * as auth from "@/lib/auth";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Step = "email" | "password" | "setup-prompt" | "check-email" | "no-account";

// A percentage margin in RN resolves against parent width, so take it off height.
const INTRO_TOP_RATIO = 0.1;

const PROMISES = [
  { icon: "qr-code" as const, label: "Scan To Get In At The Door" },
  { icon: "bell" as const, label: "Push For Gate Changes & Refunds" },
  { icon: "wifi-off" as const, label: "Passes Work With No Signal" },
];

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const session = useSession();
  const { error } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    if (!email.trim()) return error("Enter the email you bought with.");
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 44, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.intro, { marginTop: height * INTRO_TOP_RATIO }]}>
          <BrandMark size={36} color={colors.foreground} />

          <Text style={styles.headline}>
            Your tickets,{"\n"}ready at the door.
          </Text>
          <Text style={styles.lede}>
            Sign in with the email you bought with — your account already exists.
          </Text>

          <Animated.View
            key={step}
            entering={FadeInRight.duration(220).withInitialValues({ translateX: 12 })}
            exiting={FadeOutLeft.duration(160).withTargetValues({ translateX: -12 })}
            style={styles.step}
          >
          {step === "email" ? (
            <>
              <Input
                leftIcon="mail"
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                onSubmitEditing={submitEmail}
                returnKeyType="go"
                style={styles.tallInput}
              />
              <Button
                title="Continue"
                icon="arrow-right"
                iconPosition="trailing"
                onPress={submitEmail}
                loading={busy}
                fullWidth
              />
            </>
          ) : null}

          {step === "password" ? (
            <>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  autoFocus
                  placeholder="Password"
                  onSubmitEditing={submitPassword}
                  returnKeyType="go"
                  style={styles.tallInput}
                />
              <Button title="Log in" onPress={submitPassword} loading={busy} fullWidth />
              <TextLink label="Forgot password?" onPress={sendSetup} />
            </>
          ) : null}

          {step === "setup-prompt" ? (
            <>
              <Text style={styles.body}>
                Your account <Text style={styles.emphasis}>{email}</Text> needs a password.
                We&apos;ll email you a secure link to set one.
              </Text>
              <Button title="Email me a set-up link" onPress={sendSetup} loading={busy} fullWidth />
              <TextLink label="Use another email" onPress={() => setStep("email")} />
            </>
          ) : null}

          {step === "check-email" ? (
            <>
              <View style={styles.noticeIcon}>
                <Icon name="mail" size={22} color={colors.mutedForeground} />
              </View>
              <Text style={styles.body}>
                If <Text style={styles.emphasis}>{email}</Text> has an account, a link is on its
                way. Check your inbox to set your password.
              </Text>
              <TextLink label="Use another email" onPress={() => setStep("email")} />
            </>
          ) : null}

          {step === "no-account" ? (
            <>
              <Text style={styles.body}>
                We couldn&apos;t find an account for <Text style={styles.emphasis}>{email}</Text>.
                Buy a ticket to any event and your account is created automatically.
              </Text>
              <TextLink label="Try another email" onPress={() => setStep("email")} />
            </>
            ) : null}
          </Animated.View>
        </View>

        <View style={styles.promises}>
          {PROMISES.map((p) => (
            <View key={p.label} style={styles.promise}>
              <Icon name={p.icon} size={18} color={colors.mutedForeground} />
              <Text style={styles.promiseLabel}>{p.label}</Text>
            </View>
          ))}
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
    paddingHorizontal: spacing.xl + 4,
  },
  // Top offset only — set at render from window height, see INTRO_TOP_RATIO.
  intro: {
    marginTop: 0,
  },
  headline: {
    ...type.hero,
    color: colors.foreground,
    marginTop: spacing.xxl + spacing.lg,
  },
  lede: {
    ...type.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mutedForeground,
    marginTop: 14,
  },
  step: {
    gap: spacing.md,
    marginTop: 40,
  },
  tallInput: {
    minHeight: 56,
  },
  emailEcho: {
    ...type.label,
    color: colors.textSecondary,
  },
  body: {
    ...type.body,
    color: colors.mutedForeground,
  },
  emphasis: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  noticeIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceActive,
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
  promises: {
    gap: 14,
    marginTop: "auto",
    paddingTop: 40,
  },
  promise: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  promiseLabel: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
