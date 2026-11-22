import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventPicker } from "@/components/control/checkin_ops/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout, type ReadoutFigure } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { CapacityBoard, CapacityCard, CapacityLevel, ReentryRule } from "@/types/control_checkin_ops";
import type { ControlEvent } from "@/types/portal";

const POLL_MS = 10_000;
const stagger = (i: number) => Math.min(i, 8) * 50;
const count = (n: number) => n.toLocaleString("en-US");

const LEVEL_META: Record<CapacityLevel, StatusMeta> = {
  none: { label: "No cap", tone: "neutral" },
  ok: { label: "OK", tone: "success" },
  warn: { label: "Near cap", tone: "warning" },
  full: { label: "Full", tone: "danger" },
  over: { label: "Over cap", tone: "danger" },
};

// The scale fills green until it nears the cap, amber when close, red once the cap is reached.
const LEVEL_TICK: Record<CapacityLevel, React.ComponentProps<typeof TickMeter>["tone"]> = {
  none: "neutral",
  ok: "success",
  warn: "warning",
  full: "danger",
  over: "danger",
};

// The lead figure stays neutral while there's room and takes the level's colour once it needs attention.
const LEVEL_FIGURE: Record<CapacityLevel, ReadoutFigure["tone"]> = {
  none: "neutral",
  ok: "neutral",
  warn: "warning",
  full: "danger",
  over: "danger",
};

const REENTRY_LABEL: Record<ReentryRule, string> = { inherit: "App default re-entry", once: "Single entry", multi: "Re-entry allowed" };

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
    const venue = cards.find((c) => c.venue) ?? null;
    const zones = cards.filter((c) => c !== venue);
    let step = 0;

    body = (
      <View style={styles.stack}>
        {venue ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <SectionTitle variant="kicker" action={<EditCap name="the whole venue" onPress={() => setEditing(venue)} />}>
              Whole venue
            </SectionTitle>
            <Readout
              lead={{
                label: "Inside now",
                value: count(venue.occupancy),
                hint: venue.cap !== null ? `of ${count(venue.cap)} · ${venue.pct ?? 0}%` : "no cap set",
                tone: LEVEL_FIGURE[venue.level],
              }}
              items={[
                { label: "In", value: count(venue.admitted) },
                { label: "Out", value: count(venue.exited) },
                { label: "Over cap", value: count(venue.overCapacityAdmits), tone: venue.overCapacityAdmits ? "danger" : "neutral" },
              ]}
            >
              {venue.cap !== null ? (
                <TickMeter value={venue.occupancy} max={venue.cap || 1} ticks={44} height={16} tone={LEVEL_TICK[venue.level]} label={`${venue.pct ?? 0}% of the venue cap`} />
              ) : null}
            </Readout>
            <View style={styles.venueMeta}>
              <Pill label={LEVEL_META[venue.level].label} tone={LEVEL_META[venue.level].tone} />
              <Text style={styles.venueFacts} numberOfLines={1}>
                {[REENTRY_LABEL[venue.reentry], venue.lastMovementAt ? `moved ${fmtTimeAgo(venue.lastMovementAt)}` : ""].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          {zones.length ? (
            <ListGroup title="Zones" footer="Tap a zone to set its cap, warning level and re-entry.">
              {zones.map((card, i) => (
                <ZoneRow key={card.key} card={card} onEdit={() => setEditing(card)} divider={i < zones.length - 1} />
              ))}
            </ListGroup>
          ) : (
            <ListGroup title="Zones">
              <Text style={styles.quiet}>No zones yet. Add them under Multi-gate & Zones on the dashboard to cap areas separately.</Text>
            </ListGroup>
          )}
        </Animated.View>

        {overrides.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Overrides" action={<CountBadge value={overrides.length} tone="warning" />} footer="Guests let in past a full cap, with the reason staff gave.">
              {overrides.map((o, i) => (
                <ListRow
                  key={o.id}
                  leading={<IconTile icon="shield" size={36} tone="warning" />}
                  title={`${o.attendeeName || "Guest"}${o.partySize > 1 ? ` +${o.partySize - 1}` : ""} · ${o.zone || "Venue"}`}
                  subtitle={[o.reason, [o.roleName, o.staff].filter(Boolean).join(" · "), fmtTimeAgo(o.createdAt)].filter(Boolean).join(" — ")}
                  trailing={<Text style={styles.overrideCount}>{`${o.occupancy}/${o.cap}`}</Text>}
                  divider={i < overrides.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Capacity" subtitle={board.data?.event.name} />}>
      <Text style={styles.lede}>Live occupancy against each area&apos;s cap, updated every 10 seconds. Scanners refuse entry at the cap unless someone overrides with a reason.</Text>
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

function EditCap({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Set the cap for ${name}`}
      hitSlop={12}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon name="sliders-horizontal" size={13} color={colors.foreground} />
      <Text style={styles.linkText}>Set cap</Text>
    </Pressable>
  );
}

// One zone on the board: occupancy over its cap in mono, the tick scale, and the in/out tally underneath.
function ZoneRow({ card, onEdit, divider }: { card: CapacityCard; onEdit: () => void; divider: boolean }) {
  const meta = LEVEL_META[card.level];
  const facts = [
    `${count(card.admitted)} in`,
    `${count(card.exited)} out`,
    card.overCapacityAdmits ? `${count(card.overCapacityAdmits)} over cap` : "",
    card.lastMovementAt ? `moved ${fmtTimeAgo(card.lastMovementAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}: ${card.occupancy} inside${card.cap !== null ? ` of ${card.cap}` : ""}, ${meta.label}. Edit cap`}
      onPress={() => {
        selectionFeedback();
        onEdit();
      }}
      style={({ pressed }) => [styles.zone, divider && styles.divided, pressed && styles.pressed]}
    >
      <View style={styles.zoneStack}>
        <View style={styles.zoneHead}>
          <Text style={styles.zoneName} numberOfLines={1}>
            {card.name}
            {card.unlisted ? <Text style={styles.unlisted}> · not in the zone list</Text> : null}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        <View style={styles.figureRow}>
          <Text style={[styles.figure, card.level === "full" || card.level === "over" ? styles.figureDanger : card.level === "warn" && styles.figureWarn]}>
            {count(card.occupancy)}
            <Text style={styles.figureOf}>{card.cap !== null ? ` / ${count(card.cap)}` : " inside"}</Text>
          </Text>
          {card.cap !== null ? <Text style={styles.pct}>{`${card.pct ?? 0}%`}</Text> : null}
        </View>
        {card.cap !== null ? <TickMeter value={card.occupancy} max={card.cap || 1} ticks={36} height={10} tone={LEVEL_TICK[card.level]} label={`${card.pct ?? 0}% of cap`} /> : null}
        <Text style={styles.facts} numberOfLines={1}>
          {facts}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
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
        <Text style={styles.now}>{`${count(card.occupancy)} inside now${card.cap !== null ? ` · cap ${count(card.cap)}` : " · no cap"}`}</Text>
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
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  picker: {
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  pressed: {
    opacity: 0.6,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  linkText: {
    ...type.captionStrong,
    color: colors.foreground,
  },
  venueMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  venueFacts: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  zone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  zoneStack: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  zoneHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  zoneName: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  unlisted: {
    ...type.caption,
    color: colors.textSecondary,
  },
  figureRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  figure: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  figureWarn: {
    color: colors.warning,
  },
  figureDanger: {
    color: colors.danger,
  },
  figureOf: {
    ...type.monoSmall,
    color: colors.textTertiary,
  },
  pct: {
    ...type.mono,
    color: colors.textSecondary,
  },
  facts: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  quiet: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  overrideCount: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  now: {
    ...type.mono,
    color: colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
