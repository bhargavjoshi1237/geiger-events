import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { StatusButton } from "@/components/control/StatusButton";
import { ToolGrid, ToolTile } from "@/components/control/ToolTile";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout, type ReadoutFigure } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { EventDetailSkeleton } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { EVENT_STATUSES, EVENT_STATUS_META, eventDateLine, eventDayNumeral, eventStatusMeta, moneyIn } from "@/lib/control_meta";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEventDetail, ControlEventStatus } from "@/types/portal";

const TOOL_ROUTES = {
  edit: "/control/event/[id]/edit",
  tickets: "/control/event/[id]/tickets",
  guests: "/control/event/[id]/guests",
  checkin: "/control/event/[id]/checkin",
  orders: "/control/event/[id]/orders",
  analytics: "/control/event/[id]/analytics",
  announce: "/control/event/[id]/announce",
  settings: "/control/event/[id]/settings",
} as const;

type ToolKey = keyof typeof TOOL_ROUTES;
type Row = { key: ToolKey; icon: IconName; title: string; subtitle: string };

const VISIBILITY_ICON: Record<string, IconName> = { Public: "globe", Unlisted: "link", Private: "lock" };
const stagger = (i: number) => Math.min(i, 8) * 50;

export default function ControlEventHubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { success, error } = useToast();
  const hub = useControlQuery<ControlEventDetail>(id ? `/api/control/events/${id}` : null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<ControlEventStatus | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = hub.data;
  const go = (key: ToolKey) => detail && router.push({ pathname: TOOL_ROUTES[key], params: { id: detail.event.id } });

  const changeStatus = async (status: ControlEventStatus) => {
    if (!detail || status === detail.event.status) {
      setStatusOpen(false);
      return;
    }
    setSavingStatus(status);
    const res = await controlApi<ControlEventDetail>(`/api/control/events/${id}`, { method: "PATCH", body: { status } });
    setSavingStatus(null);
    if (!res.ok) {
      errorFeedback();
      return error(res.error);
    }
    hub.setData(res.data);
    setStatusOpen(false);
    successFeedback();
    success(`Status set to ${EVENT_STATUS_META[status].label.toLowerCase()}.`);
  };

  const deleteEvent = async () => {
    setDeleting(true);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/events/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      errorFeedback();
      return error(res.error);
    }
    setConfirmDelete(false);
    successFeedback();
    success("Event deleted.");
    router.back();
  };

  const openDashboard = () => {
    setActionsOpen(false);
    if (detail) void Linking.openURL(`${SUITE_ORIGIN}/events/project/${detail.projectId}`);
  };

  let body: React.ReactNode;
  if (hub.error && !detail) {
    body = <EmptyState icon="circle-alert" title="Couldn't open this event" message={hub.error} actionLabel="Try again" onAction={() => void hub.reload()} />;
  } else if (!detail) {
    body = <EventDetailSkeleton />;
  } else {
    const { event, details, can, counts } = detail;
    const status = eventStatusMeta(event.status);
    const showRevenue = can.analytics || can.orders;
    const place = [event.venue, event.city].filter(Boolean).join(", ");
    const pct = event.capacity > 0 ? Math.round((event.sold / event.capacity) * 100) : null;

    const figures: ReadoutFigure[] = [
      ...(showRevenue ? [{ label: "Revenue", value: moneyIn(details.revenue, details.currency) }] : []),
      { label: "Inside", value: String(counts.checkedIn), hint: `of ${counts.guests} expected` },
      ...(can.guests ? [{ label: "Pending", value: String(counts.pending), tone: counts.pending ? ("warning" as const) : ("neutral" as const) }] : []),
    ];

    const tiles = [
      can.checkIn && (
        <ToolTile
          key="checkin"
          icon="scan-line"
          tone={event.when === "today" ? "success" : "neutral"}
          title="Check-in"
          detail={`${counts.checkedIn} of ${counts.guests} inside`}
          onPress={() => go("checkin")}
        />
      ),
      can.guests && (
        <ToolTile
          key="guests"
          icon="users"
          title="Guests"
          detail={`${counts.guests} expected`}
          badge={counts.pending ? String(counts.pending) : undefined}
          onPress={() => go("guests")}
        />
      ),
      can.orders && <ToolTile key="orders" icon="shopping-bag" title="Orders" detail="Refunds, cancellations and buyers" onPress={() => go("orders")} />,
      can.inbox && <ToolTile key="announce" icon="megaphone" title="Announce" detail="Message everyone with a ticket" onPress={() => go("announce")} />,
    ].filter(Boolean);

    const rows = (
      [
        can.edit && { key: "edit", icon: "square-pen", title: "Edit details", subtitle: "Name, date, venue, capacity and visibility" },
        can.events && { key: "tickets", icon: "ticket", title: "Tickets", subtitle: "Prices, quantities and sales windows" },
        can.events && { key: "settings", icon: "sliders-horizontal", title: "Event settings", subtitle: "FAQ, alerts, RSVP, checkout and the rest of the editor" },
        can.analytics && { key: "analytics", icon: "chart-column", title: "Analytics", subtitle: "Sales by day and ticket, attendance" },
      ] as (Row | false)[]
    ).filter((row): row is Row => Boolean(row));

    const facts = [
      { label: "Format", value: details.type, icon: "radio" as IconName },
      { label: "Visibility", value: `${details.visibility}${details.isListable ? "" : " · not listed"}`, icon: VISIBILITY_ICON[details.visibility] ?? "globe" },
      details.organizer ? { label: "Organiser", value: details.organizer, icon: "briefcase" as IconName } : null,
      details.address ? { label: "Address", value: details.address, icon: "map-pin" as IconName } : null,
      { label: "Time zone", value: event.timezone, icon: "clock" as IconName },
    ].filter((f): f is { label: string; value: string; icon: IconName } => Boolean(f));

    let step = 0;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            {event.coverUrl ? (
              <Image source={{ uri: event.coverUrl }} contentFit="cover" transition={200} style={styles.thumb} />
            ) : (
              <DateStub date={event.date} today={event.when === "today"} size="lg" />
            )}
            <View style={styles.heroWhen}>
              <Text style={[styles.when, event.when === "today" && styles.whenToday]} numberOfLines={1}>
                {eventDateLine(event)}
              </Text>
              {place ? (
                <Text style={styles.place} numberOfLines={2}>
                  {place}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.name}>{event.name}</Text>
          <View style={styles.chips}>
            <StatusButton label={status.label} tone={status.tone} onPress={can.publish ? () => setStatusOpen(true) : undefined} />
            <Pill label={details.visibility} tone="neutral" variant="outline" dot={false} />
            <Pill label={details.type} tone="neutral" variant="outline" dot={false} />
          </View>
          {details.summary ? (
            <Text style={styles.summary} numberOfLines={3}>
              {details.summary}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{
              label: "Sold",
              value: String(event.sold),
              hint: event.capacity > 0 ? `of ${event.capacity} · ${pct}%` : "no capacity set",
            }}
            items={figures}
          >
            {event.capacity > 0 ? <TickMeter value={event.sold} max={event.capacity} ticks={44} height={16} label={`${event.sold} of ${event.capacity} sold`} /> : null}
          </Readout>
        </Animated.View>

        {tiles.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <SectionTitle variant="kicker">Run the event</SectionTitle>
            <ToolGrid>{tiles}</ToolGrid>
          </Animated.View>
        ) : null}

        {rows.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Set up">
              {rows.map((row, i) => (
                <ListRow
                  key={row.key}
                  leading={<IconTile icon={row.icon} size={36} />}
                  title={row.title}
                  subtitle={row.subtitle}
                  onPress={() => go(row.key)}
                  divider={i < rows.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}

        {!tiles.length && !rows.length ? (
          <Card tone="subtle">
            <Text style={styles.note}>Your role can see this event but has no tools here yet.</Text>
          </Card>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Details">
            {facts.map((fact, i) => (
              <DetailRow key={fact.label} label={fact.label} value={fact.value} icon={fact.icon} divider={i < facts.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen
      scroll
      backdrop={detail ? <CoverWash uri={detail.event.coverUrl} numeral={eventDayNumeral(detail.event.date)} /> : undefined}
      header={<ScreenHeader title="Event" right={detail ? <IconButton icon="ellipsis" label="Event actions" variant="plain" onPress={() => setActionsOpen(true)} /> : undefined} />}
    >
      {body}

      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="Event status">
        <View style={styles.sheetList}>
          {EVENT_STATUSES.map((value, i) => {
            const meta = EVENT_STATUS_META[value];
            const current = detail?.event.status === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: current, busy: savingStatus === value }}
                accessibilityLabel={`${meta.label}: ${meta.detail}`}
                disabled={savingStatus !== null}
                onPress={() => {
                  selectionFeedback();
                  void changeStatus(value);
                }}
                style={({ pressed }) => [styles.statusRow, i < EVENT_STATUSES.length - 1 && styles.divided, pressed && styles.pressed]}
              >
                <View style={styles.statusStack}>
                  <Pill label={meta.label} tone={meta.tone} />
                  <Text style={styles.statusDetail}>{meta.detail}</Text>
                </View>
                {current ? <Icon name="check" size={18} color={colors.foreground} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title={detail?.event.name ?? "Event"}>
        <View style={styles.sheetList}>
          <ListRow leading={<IconTile icon="external-link" size={36} />} title="Open on the dashboard" subtitle="Page design, seating and the full editor" onPress={openDashboard} divider={Boolean(detail?.can.delete)} />
          {detail?.can.delete ? (
            <ListRow
              leading={<IconTile icon="trash-2" size={36} tone="danger" />}
              title="Delete event"
              subtitle="Removes it from every list and its public page"
              onPress={() => {
                setActionsOpen(false);
                setConfirmDelete(true);
              }}
              chevron={false}
              divider={false}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this event?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>It disappears from every list and its public page. Orders and guests are kept.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete event" variant="destructive" loading={deleting} disabled={deleting} onPress={() => void deleteEvent()} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  heroWhen: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  when: {
    ...type.mono,
    color: colors.foreground,
  },
  whenToday: {
    color: colors.success,
  },
  place: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  name: {
    ...type.display,
    color: colors.foreground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  summary: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  statusStack: {
    flex: 1,
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  statusDetail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
