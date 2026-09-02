import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { PortalDevice } from "@/types/portal";

export default function AccountScreen() {
  const router = useRouter();
  const { member, token, pushToken, refreshMember, signOut, signOutEverywhere } = useSession();
  const { success, error } = useToast();

  const storedPhone = typeof member?.metadata?.phone === "string" ? member.metadata.phone : "";
  const [name, setName] = useState(member?.name || "");
  const [phone, setPhone] = useState(storedPhone);
  const [saving, setSaving] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [devices, setDevices] = useState<PortalDevice[] | null>(null);

  const dirty = name !== (member?.name || "") || phone !== storedPhone;

  useEffect(() => {
    if (!token) return;
    const query = pushToken ? `?current=${encodeURIComponent(pushToken)}` : "";
    void api<{ devices: PortalDevice[] }>(`/api/portal/devices${query}`, { token }).then((res) => {
      if (res.ok) setDevices(res.data.devices);
    });
  }, [token, pushToken]);

  const deviceSummary = devices === null
    ? "Where you're signed in for push"
    : !devices.length
      ? "No devices registered yet"
      : devices.some((d) => d.current)
        ? `This device${devices.length > 1 ? ` · ${devices.length - 1} more` : ""}`
        : `${devices.length} ${pluralize(devices.length, "device", "devices")}`;

  const saveProfile = async () => {
    if (!token || !dirty) return;
    setSaving(true);
    const res = await api<{ ok?: boolean }>("/api/portal/profile", {
      method: "POST",
      token,
      body: { name: name.trim(), phone: phone.trim() },
    });
    setSaving(false);
    if (!res.ok) return error(res.error || "Couldn't save your profile.");
    success("Profile updated.");
    void refreshMember();
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title="Account"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: !dirty, busy: saving }}
            disabled={!dirty || saving}
            hitSlop={8}
            onPress={saveProfile}
            style={styles.saveHit}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Text style={[styles.save, !dirty && styles.saveIdle]}>Save</Text>
            )}
          </Pressable>
        }
      />

      <ProgressBar active={saving} />

      <View style={styles.identity}>
        <Avatar name={member?.name} email={member?.email} size={76} />
        <Text style={styles.identityHint}>Shown on your tickets and receipts</Text>
      </View>

      <SectionTitle variant="kicker">Profile</SectionTitle>
      <View style={[styles.card, styles.formCard]}>
        <Field label="Full name">
          <Input value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        </Field>
        <Field label="Phone" hint="Optional — used for event-day updates.">
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 000 0000"
            keyboardType="phone-pad"
          />
        </Field>
        <Field label="Email" hint="Tied to your purchases — it can't be changed here.">
          <Input value={member?.email || ""} editable={false} style={styles.readonly} />
        </Field>
      </View>

      <SectionTitle variant="kicker">Security</SectionTitle>
      <View style={styles.card}>
        <ListRow
          leading={<IconTile icon="shield" size={34} />}
          title="Change password"
          subtitle="Update the password you use to sign in"
          onPress={() => router.push("/account/change-password")}
        />
        <ListRow
          leading={<IconTile icon="smartphone" size={34} />}
          title="Devices"
          subtitle={deviceSummary}
          onPress={() => router.push("/account/devices")}
          divider={false}
        />
      </View>

      <SectionTitle variant="kicker">About</SectionTitle>
      <View style={styles.card}>
        <ListRow
          leading={<IconTile icon="external-link" size={34} />}
          title="Open web portal"
          subtitle="Manage your account in a browser"
          onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE}/members`)}
        />
        <ListRow
          leading={<IconTile icon="info" size={34} />}
          title="Version"
          subtitle={Constants.expoConfig?.version || "1.0.0"}
          chevron={false}
          divider={false}
        />
      </View>

      <View style={styles.card}>
        <ListRow
          leading={<IconTile icon="log-out" size={34} />}
          title="Sign out"
          onPress={() => setConfirmOut(true)}
          chevron={false}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out of all devices"
          subtitle="Ends every session using your account"
          onPress={() => setConfirmAll(true)}
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
  saveHit: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  save: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  saveIdle: {
    color: colors.textTertiary,
  },
  identity: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  identityHint: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  formCard: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  readonly: {
    opacity: 0.6,
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
