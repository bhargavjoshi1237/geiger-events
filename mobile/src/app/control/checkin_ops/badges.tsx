import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventPicker } from "@/components/control/checkin_ops/EventPicker";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
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
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
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

// Only a badge that needs a decision tints its glyph; active and spare stay neutral.
const tileTone = (status: BadgeStatus) => (status === "lost" ? "warning" : status === "revoked" ? "danger" : "neutral");
const count = (n: number) => n.toLocaleString("en-US");

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
  const all = counts ? (Object.values(counts) as number[]).reduce((sum, n) => sum + n, 0) : 0;
  const total = list.data?.total ?? 0;

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
      <ListGroup title={total > badges.length ? `${count(badges.length)} of ${count(total)} badges` : `${count(total)} ${total === 1 ? "badge" : "badges"}`}>
        {badges.map((b, i) => (
          <ListRow
            key={b.id}
            leading={<IconTile icon="id-card" size={36} tone={tileTone(b.status)} />}
            title={b.holderName || b.label || b.serial || "Badge"}
            subtitle={[b.serial && `#${b.serial}`, b.holderEmail, b.uid ? `UID ${b.uid}` : "UID pending"].filter(Boolean).join(" · ")}
            trailing={<Pill label={STATUS_META[b.status].label} tone={STATUS_META[b.status].tone} variant="outline" />}
            onPress={() => setSelected(b)}
            divider={i < badges.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Smart badges" />}>
      {project ? (
        <View style={styles.controls}>
          <EventPicker projectId={project.id} value={eventId} onChange={pick} />
          {eventId && counts && all > 0 ? (
            <Animated.View entering={FadeInDown.springify()}>
              <Readout
                lead={{ label: "Active badges", value: count(counts.active), hint: `of ${count(all)} for this event` }}
                items={[
                  { label: "Spare", value: count(counts.unassigned) },
                  { label: "Lost", value: count(counts.lost), tone: counts.lost ? "warning" : "neutral" },
                  { label: "Revoked", value: count(counts.revoked), tone: counts.revoked ? "danger" : "neutral" },
                ]}
              >
                <TickMeter value={counts.active} max={all} ticks={44} height={16} label={`${counts.active} of ${all} badges active`} />
              </Readout>
            </Animated.View>
          ) : null}
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
  const meta = STATUS_META[badge.status];

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

  const facts = [
    { label: "Serial", value: badge.serial, mono: true },
    { label: "NFC UID", value: badge.uid || "Not captured yet", mono: Boolean(badge.uid) },
    { label: "Holder", value: badge.holderName, mono: false },
    { label: "Email", value: badge.holderEmail, mono: false },
    { label: "Issued", value: fmtDateTime(badge.issuedAt), mono: true },
  ].filter((f) => f.value);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.detail}>
        <View style={styles.head}>
          <Pill label={meta.label} tone={meta.tone} />
          {badge.label && badge.label !== badge.holderName ? (
            <Text style={styles.headMeta} numberOfLines={1}>
              {badge.label}
            </Text>
          ) : null}
        </View>
        {facts.length ? (
          <ListGroup>
            {facts.map((f, i) => (
              <DetailRow key={f.label} label={f.label} value={f.value} mono={f.mono} divider={i < facts.length - 1} />
            ))}
          </ListGroup>
        ) : null}
        {badge.notes ? <Text style={styles.notes}>{badge.notes}</Text> : null}
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
          <Text style={styles.notes}>Replaced badges can&apos;t change status.</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  detail: {
    gap: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headMeta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  notes: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
