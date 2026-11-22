import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { EventPicker } from "@/components/control/checkin_ops/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { BadgeStatus, BadgesResponse, SmartBadge } from "@/types/control_checkin_ops";
import type { ControlEvent } from "@/types/portal";

const STATUS_META: Record<BadgeStatus, StatusMeta> = {
  active: { label: "Active", tone: "success" },
  unassigned: { label: "Spare", tone: "neutral" },
  lost: { label: "Lost", tone: "warning" },
  revoked: { label: "Revoked", tone: "danger" },
  replaced: { label: "Replaced", tone: "neutral" },
};

type Target = "active" | "lost" | "revoked";

// The moves the dashboard's badge drawer offers for each status.
function targetsFor(status: BadgeStatus): Target[] {
  if (status === "active") return ["lost", "revoked"];
  if (status === "unassigned") return ["revoked"];
  if (status === "lost") return ["active", "revoked"];
  if (status === "revoked") return ["active"];
  return [];
}

const TARGET_LABEL: Record<Target, string> = { active: "Reactivate", lost: "Mark lost", revoked: "Revoke" };

export default function SmartBadgesScreen() {
  const { project } = useControl();
  const [eventId, setEventId] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<SmartBadge | null>(null);

  // Typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = [status !== "all" ? `status=${status}` : "", term ? `q=${encodeURIComponent(term)}` : ""].filter(Boolean).join("&");
  const list = useControlQuery<BadgesResponse>(eventId ? `/api/control/checkin_ops/events/${eventId}/badges${params ? `?${params}` : ""}` : null);
  const pick = useCallback((event: ControlEvent) => setEventId(event.id), []);
  const counts = list.data?.counts;
  const badges = list.data?.badges ?? [];

  const chips = [
    { value: "all", label: "All" },
    ...(Object.keys(STATUS_META) as BadgeStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label, count: counts?.[s] ?? null })),
  ];

  let body: React.ReactNode = null;
  if (!eventId) body = null;
  else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load badges" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!badges.length) {
    body =
      status !== "all" || term ? (
        <EmptyState
          icon="search"
          title="No matching badges"
          message="Try another status or search."
          actionLabel="Clear filters"
          onAction={() => {
            setStatus("all");
            setQuery("");
          }}
        />
      ) : (
        <EmptyState icon="id-card" title="No smart badges for this event" message="Import or bind NFC badges on the dashboard's Smart Badges screen." />
      );
  } else {
    body = (
      <View style={styles.group}>
        {badges.map((b, i) => (
          <ListRow
            key={b.id}
            title={b.holderName || b.label || b.serial || "Badge"}
            subtitle={[b.serial && `#${b.serial}`, b.holderEmail, b.uid ? `UID ${b.uid}` : "UID pending"].filter(Boolean).join(" · ")}
            trailing={<Pill label={STATUS_META[b.status].label} tone={STATUS_META[b.status].tone} variant="outline" />}
            onPress={() => setSelected(b)}
            divider={i < badges.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Smart badges" subtitle={list.data ? `${list.data.total} shown of the event's badges` : undefined} />}>
      {project ? (
        <View style={styles.controls}>
          <EventPicker projectId={project.id} value={eventId} onChange={pick} />
          {eventId ? (
            <>
              <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Serial, UID or holder…" autoCapitalize="none" />
              <FilterChips options={chips} value={status} onChange={setStatus} />
            </>
          ) : null}
        </View>
      ) : null}
      {body}
      <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.holderName || selected?.serial || "Badge"}>
        {selected ? (
          <BadgeDetail
            badge={selected}
            onChanged={(next) => {
              setSelected(null);
              list.setData((prev) => (prev ? { ...prev, badges: prev.badges.map((b) => (b.id === next.id ? next : b)) } : prev));
              void list.reload();
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function BadgeDetail({ badge, onChanged }: { badge: SmartBadge; onChanged: (badge: SmartBadge) => void }) {
  const toast = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const targets = targetsFor(badge.status);

  const submit = async (to: Target) => {
    setBusy(true);
    const res = await controlApi<{ badge: SmartBadge }>(`/api/control/checkin_ops/badges/${badge.id}/status`, { method: "POST", body: { status: to, reason: reason.trim() } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(to === "active" ? "Badge reactivated." : to === "lost" ? "Badge marked lost." : "Badge revoked.");
    onChanged(res.data.badge);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.detail}>
        <Pill label={STATUS_META[badge.status].label} tone={STATUS_META[badge.status].tone} />
        {[
          ["Serial", badge.serial],
          ["NFC UID", badge.uid || "Not captured yet"],
          ["Holder", [badge.holderName, badge.holderEmail].filter(Boolean).join(" · ")],
          ["Issued", fmtDateTime(badge.issuedAt)],
          ["Notes", badge.notes],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        {target ? (
          <>
            {target !== "active" ? (
              <Field label="Reason" hint="Kept in the badge's history.">
                <Input value={reason} onChangeText={setReason} placeholder={target === "lost" ? "e.g. Reported at the info desk" : "e.g. Badge sharing"} />
              </Field>
            ) : null}
            <View style={styles.actions}>
              <Button title="Back" variant="ghost" onPress={() => setTarget(null)} />
              <Button title={TARGET_LABEL[target]} variant={target === "active" ? "primary" : "destructive"} onPress={() => void submit(target)} loading={busy} />
            </View>
          </>
        ) : targets.length ? (
          <View style={styles.actions}>
            {targets.map((t) => (
              <Button key={t} title={TARGET_LABEL[t]} size="sm" variant={t === "active" ? "secondary" : "destructiveGhost"} onPress={() => setTarget(t)} />
            ))}
          </View>
        ) : (
          <Text style={styles.detailLabel}>Replaced badges can&apos;t change status.</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  detail: {
    gap: spacing.md,
    alignItems: "stretch",
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    ...type.micro,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  detailValue: {
    ...type.body,
    color: colors.foreground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
