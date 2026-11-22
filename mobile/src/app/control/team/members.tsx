import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamMember, TeamRoster } from "@/types/control_team";

const TABS = [
  { value: "members", label: "Members" },
  { value: "invites", label: "Invites" },
];

export default function TeamMembersScreen() {
  const { project } = useControl();
  const base = project ? `/api/control/team/${project.id}/members` : null;
  const roster = useControlQuery<TeamRoster>(base);
  const [tab, setTab] = useState("members");
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const data = roster.data;
  const members = (data?.members ?? []).filter((m) => (tab === "invites" ? m.status === "invited" : m.status !== "invited"));

  let body: React.ReactNode;
  if (roster.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load the team" message={roster.error} actionLabel="Try again" onAction={() => void roster.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!members.length) {
    body =
      tab === "invites" ? (
        <EmptyState
          icon="mail"
          title="No pending invitations"
          message="People you invite show here until they join."
          actionLabel={data.can.invite ? "Invite people" : undefined}
          onAction={data.can.invite ? () => setInviting(true) : undefined}
        />
      ) : (
        <EmptyState icon="users" title="No members yet" message="Your organisation's members appear here once they open this project." />
      );
  } else {
    body = (
      <Group>
        {members.map((m, i) => (
          <ListRow
            key={m.id}
            leading={<Avatar name={m.name} email={m.email} size={36} />}
            title={m.name || m.email}
            subtitle={m.status === "invited" ? `Invited ${fmtDate(m.invitedAt)}` : m.name ? m.email : undefined}
            trailing={
              <View style={styles.trailing}>
                {m.status === "suspended" ? <Pill label="Suspended" tone="warning" variant="outline" /> : null}
                <Pill label={m.roleName ?? "No role"} tone={m.roleName ? "neutral" : "warning"} variant="outline" dot={false} />
              </View>
            }
            onPress={data.can.assign ? () => setSelected(m) : undefined}
            divider={i < members.length - 1}
          />
        ))}
      </Group>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Team & Members"
          subtitle={data ? `${data.seats.used} of ${data.seats.limit} seats` : undefined}
          right={data?.can.invite ? <IconButton icon="user-plus" label="Invite people" variant="plain" onPress={() => setInviting(true)} /> : undefined}
        />
      }
    >
      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
      {body}
      {data && project ? (
        <>
          <Sheet visible={inviting} onClose={() => setInviting(false)} title="Invite people">
            <InviteForm
              data={data}
              path={`/api/control/team/${project.id}/members`}
              onClose={() => setInviting(false)}
              onDone={() => {
                setInviting(false);
                setTab("invites");
                void roster.reload();
              }}
            />
          </Sheet>
          <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || selected?.email || "Member"}>
            {selected ? (
              <MemberForm
                member={selected}
                data={data}
                path={`/api/control/team/${project.id}/members/${selected.id}`}
                onDone={() => {
                  setSelected(null);
                  void roster.reload();
                }}
              />
            ) : null}
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

// Rendered inside the sheet body, which remounts on each open, so the form always starts blank.
function InviteForm({ data, path, onClose, onDone }: { data: TeamRoster; path: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const fallback = data.roles.find((r) => r.name.toLowerCase() === "member") ?? data.roles.find((r) => !r.isOwner) ?? data.roles[0];
  const [emails, setEmails] = useState("");
  const [roleId, setRoleId] = useState(fallback?.id ?? "");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!emails.trim()) return toast.error("Enter at least one email.");
    setBusy(true);
    const res = await controlApi<{ invited: TeamMember[] }>(path, { method: "POST", body: { emails, roleId } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(res.data.invited.length === 1 ? "Invitation added." : `${res.data.invited.length} invitations added.`);
    onDone();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Emails" hint="Separate several with commas or new lines.">
          <Input
            value={emails}
            onChangeText={setEmails}
            placeholder="ada@company.com, grace@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={styles.multiline}
            textAlignVertical="top"
          />
        </Field>
        <Field label="Role">
          <FilterChips options={data.roles.map((r) => ({ value: r.id, label: r.name }))} value={roleId} onChange={setRoleId} />
        </Field>
        <Text style={styles.note}>{`${data.seats.limit - data.seats.used} seats left.`}</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Invite" onPress={() => void send()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MemberForm({ member, data, path, onDone }: { member: TeamMember; data: TeamRoster; path: string; onDone: () => void }) {
  const toast = useToast();
  const [roleId, setRoleId] = useState(member.roleId ?? "");
  const [busy, setBusy] = useState<"role" | "remove" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const invited = member.status === "invited";

  const saveRole = async () => {
    setBusy("role");
    const res = await controlApi<{ member: TeamMember }>(path, { method: "PATCH", body: { roleId } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Now ${res.data.member.roleName ?? "updated"}.`);
    onDone();
  };

  const remove = async () => {
    setBusy("remove");
    const res = await controlApi<{ removed: boolean }>(path, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(invited ? "Invitation withdrawn." : "Removed from the team.");
    onDone();
  };

  return (
    <View style={styles.form}>
      <Text style={styles.note}>{member.email}</Text>
      <Field label="Role" hint={member.userId === data.me ? "This is you — changing it changes what you can do." : undefined}>
        <FilterChips options={data.roles.map((r) => ({ value: r.id, label: r.name }))} value={roleId} onChange={setRoleId} />
      </Field>
      <Button title="Save role" onPress={() => void saveRole()} loading={busy === "role"} disabled={busy !== null || roleId === member.roleId} fullWidth />
      {confirm ? (
        <View style={styles.confirm}>
          <Text style={styles.note}>
            {invited ? "Withdraw this invitation?" : "They lose access to this project straight away."}
          </Text>
          <View style={styles.actions}>
            <Button title="Keep" variant="ghost" onPress={() => setConfirm(false)} />
            <Button title={invited ? "Withdraw" : "Remove"} variant="destructive" onPress={() => void remove()} loading={busy === "remove"} />
          </View>
        </View>
      ) : (
        <Button title={invited ? "Withdraw invitation" : "Remove from team"} icon="trash-2" variant="destructiveGhost" onPress={() => setConfirm(true)} fullWidth />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  confirm: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
