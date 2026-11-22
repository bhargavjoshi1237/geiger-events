import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { SwitchRow } from "@/components/control/checkin_ops/SwitchRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { DeskRole } from "@/types/control_inventory";

const mask = (code: string) => (code ? `${"•".repeat(Math.max(0, code.length - 2))}${code.slice(-2)}` : "No code");
const stagger = (i: number) => Math.min(i, 8) * 50;

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
    // Live codes first; switched-off roles sit apart so a locked-out code is obvious.
    const groups = [
      { title: "Codes that work", rows: roles.filter((r) => r.active), tone: "success" as const },
      { title: "Switched off", rows: roles.filter((r) => !r.active), tone: "neutral" as const },
    ].filter((g) => g.rows.length);
    body = (
      <View style={styles.stack}>
        {groups.map((g, gi) => (
          <Animated.View key={g.title} entering={FadeInDown.delay(stagger(gi)).springify()}>
            <ListGroup title={g.title} action={<CountBadge value={g.rows.length} tone={g.tone} />}>
              {g.rows.map((role, i) => (
                <ListRow
                  key={role.id}
                  leading={<IconTile icon="key-round" size={36} tone={role.active ? "neutral" : "outline"} />}
                  title={role.name}
                  subtitle={`${mask(role.accessCode)} · ${abilities(role)}`}
                  trailing={<Pill label={role.active ? "Active" : "Off"} tone={role.active ? "success" : "neutral"} variant="outline" />}
                  onPress={() => setOpenId(role.id)}
                  divider={i < g.rows.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
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
              <Button title="Create role" onPress={() => void create()} loading={busy} />
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
      <ListGroup>
        <View style={styles.codeRow}>
          <View style={styles.codeText}>
            <Text style={styles.codeLabel}>Desk code</Text>
            <Text style={styles.code} numberOfLines={1} accessibilityLabel={revealed ? `Code ${role.accessCode.split("").join(" ")}` : "Code hidden"}>
              {revealed ? role.accessCode : mask(role.accessCode)}
            </Text>
          </View>
          <IconButton icon={revealed ? "lock" : "eye"} label={revealed ? "Hide code" : "Show code"} variant="plain" onPress={() => setRevealed((r) => !r)} />
          <IconButton icon="copy" label="Copy code" variant="plain" onPress={() => void copy()} />
        </View>
      </ListGroup>
      <ListGroup>
        <SwitchRow title="Code works" detail="An inactive code stops opening the desk." value={role.active} disabled={busy} onValueChange={(v) => void patch({ active: v })} />
        <SwitchRow title="Issue items" detail="Look up an attendee and hand over what they're entitled to." value={role.canIssue} disabled={busy} onValueChange={(v) => void patch({ canIssue: v })} />
        <SwitchRow title="Undo a hand-out" detail="Reverse a mistake, writing a return movement back into stock." value={role.canReturn} disabled={busy} onValueChange={(v) => void patch({ canReturn: v })} />
        <SwitchRow
          title="Override & walk-up"
          detail="Issue again, outside a window, or with no attendee. Every override is logged."
          value={role.canOverride}
          disabled={busy}
          onValueChange={(v) => void patch({ canOverride: v })}
          divider={false}
        />
      </ListGroup>
      <Button title="Issue a new code" icon="refresh-cw" variant="secondary" onPress={() => void patch({ regenerate: true }, "New code issued. The old one stops working.")} disabled={busy} fullWidth />
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

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  codeText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  codeLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  code: {
    ...type.figureSmall,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 3,
    color: colors.foreground,
  },
});
