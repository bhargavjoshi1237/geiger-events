import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { TicketStub } from "@/components/TicketStub";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate, isUpcoming } from "@/lib/format";
import { ORDER_STATUS, REFUND_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, spacing, type } from "@/theme/tokens";
import type { Ticket } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function TicketsScreen() {
  const router = useRouter();
  const { data, refreshing, refreshAll } = usePortalData();
  const [segment, setSegment] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = useMemo(() => {
    const up: Ticket[] = [];
    const pa: Ticket[] = [];
    for (const t of data?.tickets || []) (isUpcoming(t.eventDate) ? up : pa).push(t);
    up.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    pa.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    return { upcoming: up, past: pa };
  }, [data]);

  const list = segment === "upcoming" ? upcoming : past;
  const loading = data === null;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll}>
      <View style={styles.head}>
        <Text style={styles.title}>Tickets</Text>
        <Text style={styles.subtitle}>
          Your tickets, ready to scan at the door — tap one for the QR, calendar and directions.
        </Text>
      </View>

      <Segmented
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Past" },
        ]}
        value={segment}
        onChange={(v) => setSegment(v as "upcoming" | "past")}
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : !list.length ? (
        <EmptyState
          icon="credit-card"
          title="No tickets yet"
          message="Tickets you buy will appear here."
        />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.list}>
          {list.map((t, idx) => {
            const dimmed = Boolean(t.refund) || t.status === "cancelled" || t.status === "refunded";
            const refundPill = dimmed
              ? (() => {
                  const pill = statusPill(
                    t.refund ? REFUND_STATUS : ORDER_STATUS,
                    t.refund ? t.refund.status : t.status,
                  );
                  return { label: pill.label, tone: pill.tone };
                })()
              : undefined;
            const meta = [
              { label: t.eventDate ? fmtDate(t.eventDate) : "Date TBA" },
              t.venue || t.city
                ? { label: [t.venue, t.city].filter(Boolean).join(", ") }
                : null,
              t.quantity > 1 ? { label: `${t.quantity} tickets` } : null,
            ].filter(Boolean) as { label: string }[];
            return (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(stagger(idx)).springify()}
                layout={LinearTransition}
                style={dimmed ? styles.dimmed : undefined}
              >
                <TicketStub
                  image={t.coverUrl}
                  name={t.eventName}
                  description={t.ticket || "Admission"}
                  meta={
                    refundPill
                      ? [...meta, { label: refundPill.label, pill: refundPill }]
                      : meta
                  }
                  stubValue={String(t.quantity)}
                  stubLabel="tickets"
                  onPress={() => router.push(`/tickets/${t.id}`)}
                />
              </Animated.View>
            );
          })}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.foreground,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dimmed: {
    opacity: 0.6,
  },
});
