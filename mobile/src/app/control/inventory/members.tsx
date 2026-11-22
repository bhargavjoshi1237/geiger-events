import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MEMBER_META } from "@/components/control/inventory/meta";
import { PickerField } from "@/components/control/inventory/PickerField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { Member, MembershipPlan, MemberStatus } from "@/types/control_inventory";

type Payload = { members: Member[]; plans: MembershipPlan[] };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "Active", label: "Active" },
  { value: "Expired", label: "Expired" },
  { value: "Cancelled", label: "Cancelled" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-12-31" or "" → the ISO the server stores (midnight UTC, as the dashboard's date input saves it), or null for lifetime.
function expiryBody(text: string): string | null | undefined {
  const value = text.trim();
  if (!value) return null;
  return DATE.test(value) ? new Date(value).toISOString() : undefined;
}

function timing(member: Member): string {
  if (member.expiresAt) return `${new Date(member.expiresAt) < new Date() ? "expired" : "expires"} ${fmtDate(member.expiresAt)}`;
  return member.startedAt ? `since ${fmtDate(member.startedAt)}` : "no expiry";
}

export default function MembersScreen() {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = [status !== "all" ? `status=${status}` : "", term ? `q=${encodeURIComponent(term)}` : ""].filter(Boolean).join("&");
  const list = useControlQuery<Payload>(project ? `/api/control/inventory/${project.id}/members${params ? `?${params}` : ""}` : null);
  const members = list.data?.members ?? [];
  const plans = list.data?.plans ?? [];
  const open = members.find((m) => m.id === openId) ?? null;
  const filtered = status !== "all" || Boolean(term);
  const tally = (s: MemberStatus) => members.filter((m) => m.status === s).length;

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load members" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!members.length) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title="No matching members"
        message="Try another name, email or status."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setStatus("all");
        }}
      />
    ) : (
      <EmptyState icon="award" title="No members yet" message="People who join a membership plan appear here." actionLabel="Add a member" onAction={() => setAdding(true)} />
    );
  } else {
    body = (
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <ListGroup title={filtered ? `${members.length} matching` : "Roster"}>
          {members.map((m, i) => {
            const meta = MEMBER_META[m.status] ?? { label: m.status, tone: "neutral" as const };
            return (
              <ListRow
                key={m.id}
                leading={<Avatar name={m.name} email={m.email} size={36} />}
                title={m.name || m.email || "Member"}
                subtitle={[m.planName || "No plan", m.email, timing(m)].filter(Boolean).join(" · ")}
                trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
                onPress={() => setOpenId(m.id)}
                divider={i < members.length - 1}
              />
            );
          })}
        </ListGroup>
      </Animated.View>
    );
  }

  const active = tally("Active");

  return (
    <Screen scroll header={<ScreenHeader title="Members" right={project ? <IconButton icon="plus" label="Add a member" variant="solid" onPress={() => setAdding(true)} /> : undefined} />}>
      {list.data ? (
        <View style={styles.controls}>
          {!filtered && members.length ? (
            <Animated.View entering={FadeInDown.springify()}>
              <Readout
                lead={{ label: "Active members", value: active.toLocaleString("en-US"), hint: `of ${members.length.toLocaleString("en-US")} on the roster` }}
                items={[
                  { label: "Expired", value: String(tally("Expired")), tone: tally("Expired") ? "warning" : "neutral" },
                  { label: "Cancelled", value: String(tally("Cancelled")) },
                  { label: "Plans", value: String(plans.length) },
                ]}
              >
                <TickMeter value={active} max={members.length} ticks={44} height={16} label={`${active} of ${members.length} members active`} />
              </Readout>
            </Animated.View>
          ) : null}
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search name or email…" autoCapitalize="none" />
          <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
        </View>
      ) : null}
      {body}
      {project ? (
        <>
          <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a member">
            <MemberForm
              projectId={project.id}
              plans={plans}
              onClose={() => setAdding(false)}
              onSaved={() => {
                setAdding(false);
                void list.reload();
              }}
            />
          </Sheet>
          <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title={open?.name || open?.email || "Member"}>
            {open ? (
              <MemberForm
                projectId={project.id}
                plans={plans}
                member={open}
                onClose={() => setOpenId(null)}
                onSaved={() => {
                  setOpenId(null);
                  void list.reload();
                }}
              />
            ) : null}
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

function MemberForm({ projectId, plans, member, onClose, onSaved }: { projectId: string; plans: MembershipPlan[]; member?: Member; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [planId, setPlanId] = useState(member?.membershipId ?? "");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "Active");
  const [expires, setExpires] = useState((member?.expiresAt ?? "").slice(0, 10));
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!email.trim()) return toast.error("Enter the member's email.");
    const expiresAt = expiryBody(expires);
    if (expiresAt === undefined) return toast.error("Enter the expiry as YYYY-MM-DD, or leave it empty.");
    const body: Record<string, unknown> = { name, email, membershipId: planId || null, status, expiresAt };
    setBusy("save");
    const res = member
      ? await controlApi<{ member: Member }>(`/api/control/inventory/${projectId}/members/${member.id}`, { method: "PATCH", body })
      : await controlApi<{ member: Member }>(`/api/control/inventory/${projectId}/members`, { method: "POST", body });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(member ? "Member saved." : "Member added.");
    onSaved();
  };

  const remove = async () => {
    if (!member) return;
    setBusy("delete");
    const res = await controlApi<{ deleted: boolean }>(`/api/control/inventory/${projectId}/members/${member.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Member removed.");
    onSaved();
  };

  // Extending moves the expiry a year on from today or the current expiry, whichever is later.
  const extendYear = () => {
    const current = expires && DATE.test(expires) ? new Date(expires) : null;
    const from = current && current > new Date() ? current : new Date();
    const next = new Date(Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), from.getUTCDate()));
    setExpires(next.toISOString().slice(0, 10));
    setStatus("Active");
  };

  const meta = member ? (MEMBER_META[member.status] ?? { label: member.status, tone: "neutral" as const }) : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        {member && meta ? (
          <View style={styles.metaRow}>
            <Pill label={meta.label} tone={meta.tone} />
            <Text style={styles.meta} numberOfLines={1}>
              {timing(member)}
            </Text>
          </View>
        ) : null}
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="jane@example.com" />
        </Field>
        <Field label="Plan">
          <PickerField
            label="Plan"
            placeholder="No plan"
            options={[{ value: "", label: "No plan" }, ...plans.map((p) => ({ value: p.id, label: p.name, detail: p.active ? undefined : "Off" }))]}
            value={planId}
            onChange={setPlanId}
          />
        </Field>
        <Field label="Status">
          <FilterChips
            options={[
              { value: "Active", label: "Active" },
              { value: "Expired", label: "Expired" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
            value={status}
            onChange={(v) => setStatus(v as MemberStatus)}
          />
        </Field>
        <Field label="Expires" hint={member?.startedAt ? `YYYY-MM-DD, or empty for lifetime. Member since ${fmtDate(member.startedAt)}.` : "YYYY-MM-DD. Leave empty for a lifetime membership."}>
          <Input value={expires} onChangeText={setExpires} keyboardType="numbers-and-punctuation" placeholder="2027-12-31" />
        </Field>
        {member ? <Button title="Extend a year" icon="calendar-clock" variant="secondary" onPress={extendYear} fullWidth /> : null}
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title={member ? "Save" : "Add member"} onPress={() => void save()} loading={busy === "save"} disabled={busy !== null} />
        </View>
        {member ? (
          confirmDelete ? (
            <View style={styles.actions}>
              <Button title="Keep" variant="ghost" onPress={() => setConfirmDelete(false)} />
              <Button title="Remove member" variant="destructive" onPress={() => void remove()} loading={busy === "delete"} />
            </View>
          ) : (
            <Button title="Remove from the roster" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
          )
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.lg,
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
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
