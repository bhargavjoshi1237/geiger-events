import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { EventPicker } from "@/components/control/checkin_ops/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Meter } from "@/components/ui/Meter";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CapacityBoard, CapacityCard, CapacityLevel, ReentryRule } from "@/types/control_checkin_ops";
import type { ControlEvent } from "@/types/portal";

const POLL_MS = 10_000;

const LEVEL_META: Record<CapacityLevel, StatusMeta> = {
  none: { label: "No cap", tone: "neutral" },
  ok: { label: "OK", tone: "success" },
  warn: { label: "Near cap", tone: "warning" },
  full: { label: "Full", tone: "danger" },
  over: { label: "Over cap", tone: "danger" },
};

const REENTRY_OPTIONS = [
  { value: "inherit", label: "App default" },
  { value: "once", label: "Once" },
  { value: "multi", label: "Re-entry" },
];

export default function CapacityScreen() {
  const { project } = useControl();
  const [eventId, setEventId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CapacityCard | null>(null);
  const focused = useAppFocused();
  const board = useControlQuery<CapacityBoard>(eventId ? `/api/control/checkin_ops/events/${eventId}/capacity` : null);
  const { reload } = board;

  // Live like the dashboard's board: occupancy moves while the door is open.
  useEffect(() => {
    if (!focused || !eventId) return undefined;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [focused, eventId, reload]);

  const pick = useCallback((event: ControlEvent) => setEventId(event.id), []);
  const cards = board.data?.cards ?? [];
  const overrides = board.data?.overrides ?? [];

  let body: React.ReactNode;
  if (!eventId) {
    body = null;
  } else if (board.error && !board.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load capacity" message={board.error} actionLabel="Try again" onAction={() => void board.reload()} />;
  } else if (!board.data) {
    body = <SkeletonList rows={3} variant="card" />;
  } else {
    body = (
      <View style={styles.stack}>
        {cards.map((card) => (
          <ZoneCard key={card.key} card={card} onEdit={() => setEditing(card)} />
        ))}
        {overrides.length ? (
          <View>
            <SectionTitle variant="kicker">Overrides</SectionTitle>
            <View style={styles.group}>
              {overrides.map((o, i) => (
                <ListRow
                  key={o.id}
                  title={`${o.attendeeName || "Guest"}${o.partySize > 1 ? ` +${o.partySize - 1}` : ""} · ${o.zone || "Venue"}`}
                  subtitle={[o.reason, [o.roleName, o.staff].filter(Boolean).join(" · "), fmtTimeAgo(o.createdAt)].filter(Boolean).join(" — ")}
                  trailing={<Text style={styles.overrideCount}>{`${o.occupancy}/${o.cap}`}</Text>}
                  divider={i < overrides.length - 1}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Capacity" subtitle={board.data?.event.name} />}>
      <Text style={styles.lede}>Live occupancy per area against its cap. Scanners refuse entry at the cap unless someone overrides with a reason.</Text>
      {project ? (
        <View style={styles.picker}>
          <EventPicker projectId={project.id} value={eventId} onChange={pick} />
        </View>
      ) : null}
      {body}
      {eventId ? (
        <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `${editing.name} cap` : "Cap"}>
          {editing ? (
            <CapEditor
              card={editing}
              eventId={eventId}
              onClose={() => setEditing(null)}
              onSaved={(next) => {
                setEditing(null);
                board.setData(next);
              }}
            />
          ) : null}
        </Sheet>
      ) : null}
    </Screen>
  );
}

function ZoneCard({ card, onEdit }: { card: CapacityCard; onEdit: () => void }) {
  const meta = LEVEL_META[card.level];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}: ${card.occupancy} inside${card.cap !== null ? ` of ${card.cap}` : ""}. Edit cap`}
      onPress={() => {
        selectionFeedback();
        onEdit();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardName} numberOfLines={1}>
          {card.name}
          {card.unlisted ? <Text style={styles.cardMeta}> · not in the zone list</Text> : null}
        </Text>
        <Pill label={meta.label} tone={meta.tone} />
      </View>
      <Text style={styles.cardValue}>
        {card.occupancy.toLocaleString("en-US")}
        <Text style={styles.cardOf}>{card.cap !== null ? ` of ${card.cap.toLocaleString("en-US")}` : " inside"}</Text>
      </Text>
      {card.cap !== null ? <Meter value={card.occupancy} max={card.cap || 1} label={`${card.pct ?? 0}% of cap`} /> : null}
      <Text style={styles.cardMeta}>
        {[`${card.admitted} in`, `${card.exited} out`, card.overCapacityAdmits ? `${card.overCapacityAdmits} over cap` : "", card.lastMovementAt ? `moved ${fmtTimeAgo(card.lastMovementAt)}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Pressable>
  );
}

function CapEditor({ card, eventId, onClose, onSaved }: { card: CapacityCard; eventId: string; onClose: () => void; onSaved: (board: CapacityBoard) => void }) {
  const toast = useToast();
  const [cap, setCap] = useState(card.cap === null ? "" : String(card.cap));
  const [warn, setWarn] = useState(String(card.warnPct));
  const [reentry, setReentry] = useState<ReentryRule>(card.reentry);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const hardCap = cap.trim() === "" ? null : Number(cap);
    if (hardCap !== null && (!Number.isInteger(hardCap) || hardCap < 0)) return toast.error("The cap must be a whole number, or empty for no cap.");
    setBusy(true);
    const res = await controlApi<CapacityBoard>(`/api/control/checkin_ops/events/${eventId}/capacity`, {
      method: "POST",
      body: { zoneKey: card.saveKey, zoneName: card.venue ? "" : card.name, hardCap, warnPct: Number(warn) || 85, reentry },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(hardCap === null ? `${card.name} has no cap.` : `${card.name} capped at ${hardCap.toLocaleString("en-US")}.`);
    onSaved(res.data);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Hard cap" hint="People inside at once. Leave empty for no cap.">
          <Input value={cap} onChangeText={setCap} keyboardType="number-pad" placeholder="No cap" />
        </Field>
        <Field label="Warn at (%)" hint="The board turns amber past this share of the cap.">
          <Input value={warn} onChangeText={setWarn} keyboardType="number-pad" placeholder="85" />
        </Field>
        <Field label="Re-entry">
          <Segmented options={REENTRY_OPTIONS} value={reentry} onChange={(v) => setReentry(v as ReentryRule)} />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save cap" onPress={() => void save()} loading={busy} />
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
  picker: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardName: {
    ...type.labelStrong,
    flex: 1,
    color: colors.foreground,
  },
  cardValue: {
    ...type.title,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  cardOf: {
    ...type.body,
    color: colors.textSecondary,
  },
  cardMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  overrideCount: {
    ...type.captionStrong,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
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
