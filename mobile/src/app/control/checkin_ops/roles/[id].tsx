import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AreaChips } from "@/components/control/checkin_ops/AreaChips";
import { SecretCode } from "@/components/control/checkin_ops/SecretCode";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { NamedArea, StaffRole, StaffRolePermissions, StaffRolesResponse, StaffRoleType } from "@/types/control_checkin_ops";

const TYPE_OPTIONS = [
  { value: "staff", label: "Door staff" },
  { value: "kiosk", label: "Kiosk" },
];

const ABILITIES: { key: "canScan" | "canSell" | "canOverride"; title: string; detail: string }[] = [
  { key: "canScan", title: "Scan & admit", detail: "Open the scanner and check attendees in." },
  { key: "canSell", title: "Sell at the door", detail: "Take walk-in door sales (needs Door Sales on)." },
  { key: "canOverride", title: "Override capacity", detail: "Admit past a full area's cap, with a reason." },
];

// Six digits, like the dashboard's generator, so staff can type it on any keypad.
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

export default function StaffRoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { project } = useControl();
  const list = useControlQuery<StaffRolesResponse>(project ? `/api/control/checkin_ops/projects/${project.id}/roles` : null, { refetchOnFocus: false });
  const role = list.data?.roles.find((r) => r.id === id) ?? null;

  if (role && list.data) {
    // Keyed by the saved role so a save re-seeds the form from what the server stored.
    return (
      <RoleEditor
        key={JSON.stringify(role)}
        role={role}
        gates={list.data.gates}
        zones={list.data.zones}
        onSaved={(next) => list.setData((prev) => (prev ? { ...prev, roles: prev.roles.map((r) => (r.id === next.id ? next : r)) } : prev))}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Staff role" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {list.error && !list.data ? (
          <EmptyState icon="circle-alert" title="Couldn't load this role" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
        ) : list.data ? (
          <EmptyState icon="key-round" title="Role not found" message="It may have been deleted on the dashboard." />
        ) : (
          <SkeletonList rows={4} variant="card" />
        )}
      </ScrollView>
    </View>
  );
}

type Draft = { name: string; type: StaffRoleType; active: boolean; accessCode: string; permissions: StaffRolePermissions };

function RoleEditor({ role, gates, zones, onSaved }: { role: StaffRole; gates: NamedArea[]; zones: NamedArea[]; onSaved: (role: StaffRole) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({ name: role.name, type: role.type, active: role.active, accessCode: role.accessCode, permissions: role.permissions });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setPerm = (patch: Partial<StaffRolePermissions>) => setDraft((d) => ({ ...d, permissions: { ...d.permissions, ...patch } }));

  const body: Record<string, unknown> = {};
  if (draft.name.trim() !== role.name) body.name = draft.name.trim();
  if (draft.type !== role.type) body.type = draft.type;
  if (draft.active !== role.active) body.active = draft.active;
  if (draft.accessCode !== role.accessCode) body.accessCode = draft.accessCode;
  if (JSON.stringify(draft.permissions) !== JSON.stringify(role.permissions)) body.permissions = draft.permissions;
  const dirty = Object.keys(body).length > 0;

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Give the role a name.");
    setSaving(true);
    const res = await controlApi<{ role: StaffRole }>(`/api/control/checkin_ops/roles/${role.id}`, { method: "PATCH", body });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(body.accessCode ? "Saved. The old code no longer works." : "Role saved.");
    onSaved(res.data.role);
  };

  const remove = async () => {
    setDeleting(true);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/checkin_ops/roles/${role.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    setConfirmDelete(false);
    successFeedback();
    toast.success("Role deleted.");
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title={role.name} right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <View style={styles.card}>
            <Field label="Name">
              <Input value={draft.name} onChangeText={(name) => set({ name })} placeholder="e.g. North door" />
            </Field>
            <Field label="Type">
              <Segmented options={TYPE_OPTIONS} value={draft.type} onChange={(v) => set({ type: v as StaffRoleType })} />
            </Field>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Active</Text>
                <Text style={styles.hint}>Off locks this code out of the scanner straight away.</Text>
              </View>
              <Switch value={draft.active} onValueChange={(active) => set({ active })} label="Active" />
            </View>
          </View>

          <View style={styles.panel}>
            <SectionTitle variant="kicker">Access code</SectionTitle>
            <View style={styles.card}>
              <SecretCode code={draft.accessCode} />
              <Button title="Generate a new code" icon="refresh-cw" variant="secondary" size="sm" onPress={() => set({ accessCode: newCode() })} />
              <Text style={styles.hint}>A new code takes effect when you save; anyone using the old one is locked out.</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <SectionTitle variant="kicker">Abilities</SectionTitle>
            <View style={styles.card}>
              {ABILITIES.map((a) => (
                <View key={a.key} style={styles.switchRow}>
                  <View style={styles.switchText}>
                    <Text style={styles.switchTitle}>{a.title}</Text>
                    <Text style={styles.hint}>{a.detail}</Text>
                  </View>
                  <Switch value={draft.permissions[a.key]} onValueChange={(v) => setPerm({ [a.key]: v })} label={a.title} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <SectionTitle variant="kicker">Where they can work</SectionTitle>
            <View style={styles.card}>
              <Field label="Gates" hint="None picked means every gate.">
                <AreaChips options={gates} selected={draft.permissions.gates} onChange={(next) => setPerm({ gates: next })} empty="No gates yet — add them under Multi-gate & Zones." />
              </Field>
              <Field label="Zones" hint="None picked means every zone.">
                <AreaChips options={zones} selected={draft.permissions.zones} onChange={(next) => setPerm({ zones: next })} empty="No zones yet — add them under Multi-gate & Zones." />
              </Field>
            </View>
          </View>

          <Button title="Delete role" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        </View>
      </ScrollView>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${role.name}?`}>
        <View style={styles.sheetBody}>
          <Text style={styles.hint}>Its code stops opening the scanner immediately.</Text>
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="destructive" onPress={() => void remove()} loading={deleting} />
          </View>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  panel: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    ...type.label,
    color: colors.foreground,
  },
  hint: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
