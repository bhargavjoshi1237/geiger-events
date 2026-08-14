import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE } from "@/lib/api";
import { registerForPush } from "@/lib/push";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";

export default function AccountScreen() {
  const router = useRouter();
  const { member, token, refreshMember, signOut, signOutEverywhere } = useSession();
  const { refreshing, refreshAll } = usePortalData();
  const { success, error } = useToast();
  const scrollY = useSharedValue(0);

  const [name, setName] = useState(member?.name || "");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushUnavailable, setPushUnavailable] = useState(false);
  const [registering, setRegistering] = useState(false);

  const storedPhone =
    typeof member?.metadata?.phone === "string" ? member.metadata.phone : "";
  const dirty = name !== (member?.name || "") || phone !== storedPhone;

  const saveProfile = async () => {
    if (!token) return;
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

  const enablePush = async () => {
    if (!token) return;
    setRegistering(true);
    const t = await registerForPush(token);
    setRegistering(false);
    if (t) {
      setPushEnabled(true);
      success("Push notifications enabled.");
    } else {
      setPushUnavailable(true);
    }
  };

  const openPortal = () => WebBrowser.openBrowserAsync(`${API_BASE}/members`);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="Account" subtitle="Manage your profile, password, and sessions." scrollY={scrollY} />

      <View style={styles.head}>
        <Avatar name={member?.name} email={member?.email} size={56} />
        <View style={styles.headStack}>
          <Text style={styles.headName} numberOfLines={1}>
            {member?.name || "Your account"}
          </Text>
          <Text style={styles.headEmail} numberOfLines={1}>
            {member?.email}
          </Text>
        </View>
      </View>

      <SectionTitle>Profile</SectionTitle>
      <Card style={styles.formCard}>
        <Field label="Full name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />
        </Field>
        <Field label="Phone" hint="Optional — used for event updates.">
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 000 0000"
            keyboardType="phone-pad"
          />
        </Field>
        <Field label="Email">
          <Input value={member?.email || ""} editable={false} style={styles.readonly} />
        </Field>
        <Button
          title="Save changes"
          onPress={saveProfile}
          loading={saving}
          disabled={!dirty}
          icon="user"
          fullWidth
        />
      </Card>

      <SectionTitle>Security</SectionTitle>
      <Card style={styles.rowsCard}>
        <ListRow
          title="Change password"
          subtitle="Update the password you use to sign in."
          onPress={() => router.push("/account/change-password")}
          divider={false}
        />
      </Card>
      <Button
        title="Sign out of all devices"
        variant="destructiveGhost"
        icon="log-out"
        onPress={() => setConfirmAll(true)}
        fullWidth
      />

      <SectionTitle>Notifications</SectionTitle>
      <Card style={styles.rowsCard}>
        {pushEnabled ? (
          <ListRow
            title="Push notifications"
            subtitle="Enabled on this device"
            trailing={<Pill label="On" tone="success" />}
            divider={false}
          />
        ) : pushUnavailable ? (
          <Text style={styles.mutedLine}>Push isn&apos;t available on this device yet.</Text>
        ) : (
          <Button
            title="Enable push notifications"
            variant="secondary"
            onPress={enablePush}
            loading={registering}
            fullWidth
          />
        )}
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card style={styles.rowsCard}>
        <ListRow title="Version" subtitle={Constants.expoConfig?.version || "1.0.0"} />
        <ListRow
          title="Open web portal"
          subtitle="Manage your account in a browser"
          onPress={() => void openPortal()}
          divider={false}
        />
      </Card>

      <Button title="Sign out" variant="destructive" icon="log-out" onPress={() => setConfirmOut(true)} fullWidth />

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
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headName: {
    ...type.heading,
    color: colors.foreground,
  },
  headEmail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  formCard: {
    gap: spacing.md,
  },
  readonly: {
    opacity: 0.6,
  },
  rowsCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  mutedLine: {
    ...type.caption,
    color: colors.textTertiary,
    paddingVertical: spacing.sm,
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
