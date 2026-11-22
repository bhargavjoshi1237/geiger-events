import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AreaChips } from "@/components/control/checkin_ops/AreaChips";
import { permSummary } from "@/components/control/checkin_ops/format";
import { SecretCode } from "@/components/control/checkin_ops/SecretCode";
import { SwitchRow } from "@/components/control/checkin_ops/SwitchRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { NamedArea, StaffRole, StaffRolePermissions, StaffRolesResponse, StaffRoleType } from "@/types/control_checkin_ops";

const TYPE_OPTIONS = [
  { value: "staff", label: "Door staff" },
  { value: "kiosk", label: "Kiosk" },
];

const ABILITIES: { key: "canScan" | "canSell" | "canOverride"; icon: IconName; title: string; detail: string }[] = [
  { key: "canScan", icon: "scan-line", title: "Scan & admit", detail: "Open the scanner and check attendees in." },
  { key: "canSell", icon: "banknote", title: "Sell at the door", detail: "Take walk-in door sales (needs Door Sales on)." },
  { key: "canOverride", icon: "shield", title: "Override capacity", detail: "Admit past a full area's cap, with a reason." },
];

// Six digits, like the dashboard's generator, so staff can type it on any keypad.
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));
const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const codeChanged = draft.accessCode !== role.accessCode;
  const scoped = draft.permissions.gates.length + draft.permissions.zones.length;

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

  let step = 0;
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Staff role" right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.head}>
            <IconTile icon={draft.type === "kiosk" ? "monitor" : "users"} size={56} tone={draft.active ? "neutral" : "outline"} />
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={2}>
                {draft.name.trim() || role.name}
              </Text>
              <View style={styles.metaRow}>
                <Pill label={draft.active ? "Active" : "Off"} tone={draft.active ? "success" : "neutral"} />
                <Text style={styles.meta} numberOfLines={1}>
                  {draft.type === "kiosk" ? "Kiosk" : "Door staff"}
                </Text>
              </View>
              <Text style={styles.summary} numberOfLines={1}>
                {permSummary(draft.permissions)}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Role">
              <View style={styles.fields}>
                <Field label="Name">
                  <Input value={draft.name} onChangeText={(name) => set({ name })} placeholder="e.g. North door" />
                </Field>
                <Field label="Type" hint="Kiosk codes only open the self check-in kiosk.">
                  <Segmented options={TYPE_OPTIONS} value={draft.type} onChange={(v) => set({ type: v as StaffRoleType })} />
                </Field>
              </View>
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup
              title="Access code"
              action={codeChanged ? <Pill label="Not saved yet" tone="warning" /> : undefined}
              footer={codeChanged ? "The new code takes effect when you save; anyone using the old one is locked out." : "Staff type this code to open the scanner. A new code locks the old one out once you save."}
            >
              <SwitchRow
                icon="key-round"
                title="Code works"
                detail="Off locks this code out of the scanner straight away."
                value={draft.active}
                onValueChange={(active) => set({ active })}
              />
              <SecretCode code={draft.accessCode} />
              <View style={styles.groupAction}>
                <Button title="Generate a new code" icon="refresh-cw" variant="secondary" size="sm" onPress={() => set({ accessCode: newCode() })} fullWidth />
              </View>
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="What they can do">
              {ABILITIES.map((a, i) => (
                <SwitchRow
                  key={a.key}
                  icon={a.icon}
                  title={a.title}
                  detail={a.detail}
                  value={draft.permissions[a.key]}
                  onValueChange={(v) => setPerm({ [a.key]: v })}
                  divider={i < ABILITIES.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Where they can work" footer={scoped ? `Limited to ${scoped} ${scoped === 1 ? "gate or zone" : "gates and zones"}.` : "None picked means every gate and every zone."}>
              <View style={styles.fields}>
                <Field label="Gates">
                  <AreaChips options={gates} selected={draft.permissions.gates} onChange={(next) => setPerm({ gates: next })} empty="No gates yet — add them under Multi-gate & Zones." />
                </Field>
                <Field label="Zones">
                  <AreaChips options={zones} selected={draft.permissions.zones} onChange={(next) => setPerm({ zones: next })} empty="No zones yet — add them under Multi-gate & Zones." />
                </Field>
              </View>
            </ListGroup>
          </Animated.View>

          <Button title="Delete role" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        </View>
      </ScrollView>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${role.name}?`}>
        <View style={styles.sheetBody}>
          <Text style={styles.hint}>Its code stops opening the scanner immediately.</Text>
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete role" variant="destructive" onPress={() => void remove()} loading={deleting} />
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
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs + 2,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  summary: {
    ...type.caption,
    color: colors.textSecondary,
  },
  fields: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  groupAction: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
    paddingVertical: spacing.md,
  },
  hint: {
    ...type.body,
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
