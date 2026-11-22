import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { permSummary } from "@/components/control/checkin_ops/format";
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
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { StaffRole, StaffRolesResponse, StaffRoleType } from "@/types/control_checkin_ops";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "staff", label: "Door staff" },
  { value: "kiosk", label: "Kiosk" },
];

const TYPE_OPTIONS = [
  { value: "staff", label: "Door staff" },
  { value: "kiosk", label: "Kiosk" },
];

export default function StaffRolesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [tab, setTab] = useState("all");
  const [creating, setCreating] = useState(false);
  const list = useControlQuery<StaffRolesResponse>(project ? `/api/control/checkin_ops/projects/${project.id}/roles` : null);
  const roles = (list.data?.roles ?? []).filter((r) => tab === "all" || r.type === tab);

  const open = (role: StaffRole) => router.push({ pathname: "/control/checkin_ops/roles/[id]", params: { id: role.id } });

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load staff roles" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!list.data.roles.length) {
    body = (
      <EmptyState
        icon="key-round"
        title="No staff roles yet"
        message="A role gives door staff or a kiosk an access code for the scanner — no account needed."
        actionLabel="Add a role"
        onAction={() => setCreating(true)}
      />
    );
  } else if (!roles.length) {
    body = <EmptyState icon="search" title="No roles of this type" message="Roles of this type will show here." actionLabel="Show all" onAction={() => setTab("all")} />;
  } else {
    body = (
      <View style={styles.group}>
        {roles.map((role, i) => (
          <ListRow
            key={role.id}
            leading={<IconTile icon={role.type === "kiosk" ? "monitor" : "users"} size={34} tone={role.active ? "neutral" : "outline"} />}
            title={role.name}
            subtitle={permSummary(role.permissions)}
            trailing={<Pill label={role.active ? "Active" : "Off"} tone={role.active ? "success" : "neutral"} variant="outline" />}
            onPress={() => open(role)}
            divider={i < roles.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Staff scanning roles"
          right={project ? <IconButton icon="plus" label="Add a role" variant="solid" onPress={() => setCreating(true)} /> : undefined}
        />
      }
    >
      <Text style={styles.lede}>Staff open the scanner at /checkin with a role&apos;s code. Turn a role off to lock its code out at once.</Text>
      {list.data?.roles.length ? (
        <View style={styles.tabs}>
          <Segmented options={TYPE_TABS} value={tab} onChange={setTab} />
        </View>
      ) : null}
      {body}
      {project ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title="New role">
          <CreateRole
            projectId={project.id}
            onClose={() => setCreating(false)}
            onCreated={(role) => {
              setCreating(false);
              void list.reload();
              open(role);
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

// Inside the sheet's body, which remounts on every open, so each opening starts blank.
function CreateRole({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: (role: StaffRole) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<StaffRoleType>("staff");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the role a name.");
    setBusy(true);
    const res = await controlApi<{ role: StaffRole }>(`/api/control/checkin_ops/projects/${projectId}/roles`, { method: "POST", body: { name: name.trim(), type } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Role added with a new access code.");
    onCreated(res.data.role);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. North door" autoFocus />
        </Field>
        <Field label="Type" hint="Kiosk codes only open the self check-in kiosk.">
          <Segmented options={TYPE_OPTIONS} value={type} onChange={(v) => setType(v as StaffRoleType)} />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Create" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  tabs: {
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
});
