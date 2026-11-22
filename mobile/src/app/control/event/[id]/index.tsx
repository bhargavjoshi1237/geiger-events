import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { EVENT_STATUSES, EVENT_STATUS_META, eventStatusMeta, moneyIn, whenLabel } from "@/lib/control_meta";
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

type Tool = {
  key: keyof typeof TOOL_ROUTES;
  icon: IconName;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
};

export default function ControlEventHubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { success, error } = useToast();
  const hub = useControlQuery<ControlEventDetail>(id ? `/api/control/events/${id}` : null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<ControlEventStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = hub.data;

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

  let body: React.ReactNode;
  if (hub.error && !detail) {
    body = (
      <EmptyState icon="circle-alert" title="Couldn't open this event" message={hub.error} actionLabel="Try again" onAction={() => void hub.reload()} />
    );
  } else if (!detail) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const { event, details, can, counts } = detail;
    const status = eventStatusMeta(event.status);
    const showRevenue = can.analytics || can.orders;
    const candidates: (Tool | false)[] = [
      can.edit && { key: "edit", icon: "square-pen", title: "Edit details", subtitle: "Name, date, venue and visibility" },
      can.events && { key: "tickets", icon: "ticket", title: "Tickets", subtitle: "Prices and quantities" },
      can.guests && {
        key: "guests",
        icon: "users",
        title: "Guests",
        subtitle: `${counts.guests} expected`,
        trailing: counts.pending ? <Pill label={`${counts.pending} pending`} tone="warning" variant="outline" /> : undefined,
      },
      can.checkIn && { key: "checkin", icon: "scan-line", title: "Check-in", subtitle: `${counts.checkedIn} of ${counts.guests} inside` },
      can.orders && { key: "orders", icon: "shopping-bag", title: "Orders", subtitle: "Refunds, cancellations and buyer details" },
      can.analytics && { key: "analytics", icon: "chart-column", title: "Analytics", subtitle: "Sales by day and ticket, attendance" },
      can.inbox && { key: "announce", icon: "megaphone", title: "Announce to buyers", subtitle: "Message everyone with a ticket" },
      can.events && { key: "settings", icon: "settings", title: "Event settings", subtitle: "FAQ, alerts, RSVP, checkout and the rest of the event editor" },
    ];
    const tools = candidates.filter((tool): tool is Tool => Boolean(tool));

    body = (
      <View style={styles.stack}>
        <Card>
          <View style={styles.headRow}>
            <Text style={styles.name} numberOfLines={3}>
              {event.name}
            </Text>
            <Pill label={status.label} tone={status.tone} />
          </View>
          <Text style={styles.meta}>{[whenLabel(event), event.venue, event.city].filter(Boolean).join(" · ")}</Text>
          <View style={styles.stats}>
            <StatTile label="Sold" value={event.capacity ? `${event.sold}/${event.capacity}` : String(event.sold)} />
            {showRevenue ? <StatTile label="Revenue" value={moneyIn(details.revenue, details.currency)} /> : null}
            <StatTile label="Inside" value={String(counts.checkedIn)} />
          </View>
        </Card>

        {can.publish ? (
          <View style={styles.group}>
            <ListRow
              leading={<IconTile icon="globe" size={34} tone={event.status === "On Sale" ? "success" : "neutral"} />}
              title="Status"
              subtitle={EVENT_STATUS_META[event.status as ControlEventStatus]?.detail ?? event.status}
              trailing={<Pill label={status.label} tone={status.tone} variant="outline" />}
              onPress={() => setStatusOpen(true)}
              divider={false}
            />
          </View>
        ) : null}

        {tools.length ? (
          <View>
            <SectionTitle variant="kicker">Manage</SectionTitle>
            <View style={styles.group}>
              {tools.map((tool, i) => (
                <ListRow
                  key={tool.key}
                  leading={<IconTile icon={tool.icon} size={34} />}
                  title={tool.title}
                  subtitle={tool.subtitle}
                  trailing={tool.trailing}
                  onPress={() => router.push({ pathname: TOOL_ROUTES[tool.key], params: { id: event.id } })}
                  divider={i < tools.length - 1}
                />
              ))}
            </View>
          </View>
        ) : (
          <Card tone="subtle">
            <Text style={styles.note}>Your role can see this event but has no tools here yet.</Text>
          </Card>
        )}

        <Button
          title="Open in dashboard"
          icon="external-link"
          variant="secondary"
          onPress={() => void Linking.openURL(`${SUITE_ORIGIN}/events/project/${detail.projectId}`)}
          fullWidth
        />
        {can.delete ? (
          <Button title="Delete event" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Event" />}>
      {body}

      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="Event status">
        <View style={styles.statusList}>
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

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this event?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>It disappears from every list and its public page. Orders and guests are kept.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="destructive" loading={deleting} disabled={deleting} onPress={() => void deleteEvent()} />
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
  headRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  name: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
  statusList: {
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
