import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { DeskRole } from "@/types/control_inventory";

const mask = (code: string) => (code ? `${"•".repeat(Math.max(0, code.length - 2))}${code.slice(-2)}` : "No code");

function abilities(role: DeskRole): string {
  const list = [role.canIssue && "Issue", role.canReturn && "Undo", role.canOverride && "Override"].filter(Boolean);
  const scope = role.allocationCount ? `${role.allocationCount} allocations` : "all allocations";
  return `${list.length ? list.join(" · ") : "No abilities"} · ${scope}`;
}

// Codes that open the inventory issuing desk (/issue) — separate from door and kiosk codes.
export default function IssuingStaffScreen() {
  const { project } = useControl();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useControlQuery<{ roles: DeskRole[] }>(project ? `/api/control/inventory/${project.id}/staff` : null);
  const roles = list.data?.roles ?? [];
  const open = roles.find((r) => r.id === openId) ?? null;

  const create = async () => {
    if (!project) return;
    if (!name.trim()) return toast.error("Give the role a name.");
    setBusy(true);
    const res = await controlApi<{ role: DeskRole }>(`/api/control/inventory/${project.id}/staff`, { method: "POST", body: { name } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Desk role created.");
    setCreating(false);
    setName("");
    void list.reload();
    setOpenId(res.data.role.id);
  };

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load desk roles" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={4} variant="divided" />;
  } else if (!roles.length) {
    body = <EmptyState icon="key-round" title="No desk roles yet" message="Create a role to give staff a code for the issuing desk." actionLabel="Create a role" onAction={() => setCreating(true)} />;
  } else {
    body = (
      <View style={styles.group}>
        {roles.map((role, i) => (
          <ListRow
            key={role.id}
            leading={<IconTile icon="key-round" size={34} tone={role.active ? "neutral" : "outline"} />}
            title={role.name}
            subtitle={`${mask(role.accessCode)} · ${abilities(role)}`}
            trailing={<Pill label={role.active ? "Active" : "Off"} tone={role.active ? "success" : "neutral"} variant="outline" />}
            onPress={() => setOpenId(role.id)}
            divider={i < roles.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Issuing staff" right={project ? <IconButton icon="plus" label="Create a desk role" variant="solid" onPress={() => setCreating(true)} /> : undefined} />}>
      <Text style={styles.lede}>Each role&apos;s code opens the issuing desk for any event. Which allocations a role covers is set on the dashboard.</Text>
      {body}

      <Sheet visible={creating} onClose={() => setCreating(false)} title="New desk role">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.form}>
            <Field label="Name" hint="It gets a fresh six-digit code that can issue items.">
              <Input value={name} onChangeText={setName} placeholder="e.g. Merch desk" />
            </Field>
            <View style={styles.actions}>
              <Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} />
              <Button title="Create" onPress={() => void create()} loading={busy} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Sheet>

      {project ? (
        <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title={open?.name ?? "Desk role"}>
          {open ? (
            <RoleEditor
              projectId={project.id}
              role={open}
              onChanged={() => void list.reload()}
              onDeleted={() => {
                setOpenId(null);
                void list.reload();
              }}
            />
          ) : null}
        </Sheet>
      ) : null}
    </Screen>
  );
}

function RoleEditor({ projectId, role, onChanged, onDeleted }: { projectId: string; role: DeskRole; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const path = `/api/control/inventory/${projectId}/staff/${role.id}`;

  const patch = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    const res = await controlApi<{ role: DeskRole }>(path, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    if (done) toast.success(done);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const res = await controlApi<{ deleted: boolean }>(path, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Deleted ${role.name}.`);
    onDeleted();
  };

  const copy = async () => {
    await Clipboard.setStringAsync(role.accessCode);
    successFeedback();
    toast.success("Code copied.");
  };

  return (
    <View style={styles.form}>
      <View style={styles.codeRow}>
        <Text style={styles.code} accessibilityLabel={revealed ? `Code ${role.accessCode.split("").join(" ")}` : "Code hidden"}>
          {revealed ? role.accessCode : mask(role.accessCode)}
        </Text>
        <IconButton icon="eye" label={revealed ? "Hide code" : "Show code"} variant="plain" onPress={() => setRevealed((r) => !r)} />
        <IconButton icon="copy" label="Copy code" variant="plain" onPress={() => void copy()} />
      </View>
      <ToggleRow label="Active" hint="An inactive code stops opening the desk." value={role.active} disabled={busy} onChange={(v) => void patch({ active: v })} />
      <ToggleRow label="Issue items" hint="Look up an attendee and hand over what they're entitled to." value={role.canIssue} disabled={busy} onChange={(v) => void patch({ canIssue: v })} />
      <ToggleRow label="Undo a hand-out" hint="Reverse a mistake, writing a return movement back into stock." value={role.canReturn} disabled={busy} onChange={(v) => void patch({ canReturn: v })} />
      <ToggleRow label="Override & walk-up" hint="Issue again, outside a window, or with no attendee. Every override is logged." value={role.canOverride} disabled={busy} onChange={(v) => void patch({ canOverride: v })} />
      <Button title="New code" icon="refresh-cw" variant="secondary" onPress={() => void patch({ regenerate: true }, "New code issued. The old one stops working.")} disabled={busy} fullWidth />
      {confirmDelete ? (
        <View style={styles.actions}>
          <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
          <Button title="Delete role" variant="destructive" onPress={() => void remove()} loading={busy} />
        </View>
      ) : (
        <Button title="Delete role" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
      )}
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} label={label} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingLeft: spacing.lg,
  },
  code: {
    ...type.monoLarge,
    flex: 1,
    color: colors.foreground,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...type.label,
    color: colors.foreground,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
