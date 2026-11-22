import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MemberRow } from "@/components/control/team/MemberRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { TeamMember, TeamRoster } from "@/types/control_team";

const TABS = [
  { value: "members", label: "Members" },
  { value: "invites", label: "Invites" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function TeamMembersScreen() {
  const { project } = useControl();
  const base = project ? `/api/control/team/${project.id}/members` : null;
  const roster = useControlQuery<TeamRoster>(base);
  const [tab, setTab] = useState("members");
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const data = roster.data;
  const all = data?.members ?? [];
  const members = all.filter((m) => (tab === "invites" ? m.status === "invited" : m.status !== "invited"));
  const invitedCount = all.filter((m) => m.status === "invited").length;
  let step = 0;

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
      <ListGroup
        title={tab === "invites" ? `${members.length} pending ${pluralize(members.length, "invitation", "invitations")}` : `${members.length} ${pluralize(members.length, "member", "members")}`}
        footer={data.can.assign ? "Tap someone to change their role or remove them." : undefined}
      >
        {members.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            isMe={Boolean(m.userId) && m.userId === data.me}
            onPress={data.can.assign ? () => setSelected(m) : undefined}
            divider={i < members.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Team & Members"
          right={data?.can.invite ? <IconButton icon="user-plus" label="Invite people" variant="plain" onPress={() => setInviting(true)} /> : undefined}
        />
      }
    >
      <View style={styles.stack}>
        {data ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <SeatsReadout data={data} invited={invitedCount} />
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Segmented options={TABS} value={tab} onChange={setTab} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>{body}</Animated.View>
      </View>
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

// Seats are the plan's hard limit, so they lead; the meter warns once the team is full.
function SeatsReadout({ data, invited }: { data: TeamRoster; invited: number }) {
  const { used, limit } = data.seats;
  const left = Math.max(0, limit - used);
  return (
    <Readout
      lead={{ label: "Seats used", value: String(used), hint: limit > 0 ? `of ${limit}` : undefined }}
      items={[
        { label: "Members", value: String(data.members.length - invited) },
        { label: "Invited", value: String(invited) },
        { label: "Seats left", value: String(left), tone: limit > 0 && left === 0 ? "warning" : "neutral" },
      ]}
    >
      {limit > 0 ? (
        <TickMeter value={used} max={limit} ticks={44} height={16} tone={used >= limit ? "warning" : "success"} label={`${used} of ${limit} seats used`} />
      ) : null}
    </Readout>
  );
}

// Rendered inside the sheet body, which remounts on each open, so the form always starts blank.
function InviteForm({ data, path, onClose, onDone }: { data: TeamRoster; path: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const fallback = data.roles.find((r) => r.name.toLowerCase() === "member") ?? data.roles.find((r) => !r.isOwner) ?? data.roles[0];
  const [emails, setEmails] = useState("");
  const [roleId, setRoleId] = useState(fallback?.id ?? "");
  const [busy, setBusy] = useState(false);
  const left = data.seats.limit - data.seats.used;

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
        <View style={styles.seatLine}>
          <Text style={styles.seatLabel}>Seats left</Text>
          <Text style={[styles.seatValue, left <= 0 && styles.seatValueOut]}>{left}</Text>
        </View>
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
  const since = invited ? (member.invitedAt ? `Invited ${fmtDate(member.invitedAt)}` : "Invited") : member.joinedAt ? `Joined ${fmtDate(member.joinedAt)}` : "";

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
      <View style={styles.identity}>
        <Avatar name={member.name} email={member.email} size={44} />
        <View style={styles.identityText}>
          <Text style={styles.identityEmail} numberOfLines={1}>
            {member.email}
          </Text>
          {since ? <Text style={styles.identityMeta}>{since}</Text> : null}
        </View>
      </View>
      <Field label="Role" hint={member.userId === data.me ? "This is you — changing it changes what you can do." : undefined}>
        <FilterChips options={data.roles.map((r) => ({ value: r.id, label: r.name }))} value={roleId} onChange={setRoleId} />
      </Field>
      <Button title="Save role" onPress={() => void saveRole()} loading={busy === "role"} disabled={busy !== null || roleId === member.roleId} fullWidth />
      {confirm ? (
        <View style={styles.confirm}>
          <Text style={styles.note}>{invited ? "Withdraw this invitation?" : "They lose access to this project straight away."}</Text>
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
  stack: {
    gap: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
  seatLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.md,
  },
  seatLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  seatValue: {
    ...type.figureSmall,
    color: colors.foreground,
  },
  seatValueOut: {
    color: colors.warning,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityEmail: {
    ...type.label,
    color: colors.foreground,
  },
  identityMeta: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
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
