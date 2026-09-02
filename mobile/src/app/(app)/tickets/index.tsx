import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenTitle } from "@/components/ScreenTitle";
import { TicketPassCard } from "@/components/TicketPassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate, fmtShortDay, isUpcoming, money, relativeDayLabel } from "@/lib/format";
import { ORDER_STATUS, REFUND_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { spacing } from "@/theme/tokens";
import type { Ticket } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

function ticketStatus(t: Ticket) {
  if (t.refund) {
    const pill = statusPill(REFUND_STATUS, t.refund.status);
    return { label: pill.label, tone: pill.tone };
  }
  if (t.status === "cancelled" || t.status === "refunded") {
    const pill = statusPill(ORDER_STATUS, t.status);
    return { label: pill.label, tone: pill.tone };
  }
  return null;
}

export default function TicketsScreen() {
  const router = useRouter();
  const { data } = usePortalData();
  const [segment, setSegment] = useState<"upcoming" | "past">("upcoming");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const { upcoming, past } = useMemo(() => {
    const up: Ticket[] = [];
    const pa: Ticket[] = [];
    for (const t of data?.tickets || []) (isUpcoming(t.eventDate) ? up : pa).push(t);
    up.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    pa.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    return { upcoming: up, past: pa };
  }, [data]);

  const list = segment === "upcoming" ? upcoming : past;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      `${t.eventName} ${t.venue} ${t.city} ${t.ticket} ${t.orderCode}`.toLowerCase().includes(q),
    );
  }, [list, query]);

  const loading = data === null;

  return (
    <Screen scroll>
      <ScreenTitle
        title="Tickets"
        right={
          <IconButton
            icon={searching ? "x" : "search"}
            label={searching ? "Close search" : "Search tickets"}
            onPress={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
          />
        }
      />

      {searching ? (
        <View style={styles.search}>
          <Input
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search events, venues, order codes…"
            autoCapitalize="none"
            autoFocus
          />
        </View>
      ) : null}

      <Segmented
        options={[
          { value: "upcoming", label: `Upcoming${upcoming.length ? ` ${upcoming.length}` : ""}` },
          { value: "past", label: `Past${past.length ? ` ${past.length}` : ""}` },
        ]}
        value={segment}
        onChange={(v) => setSegment(v as "upcoming" | "past")}
      />

      {loading ? (
        <View style={styles.list}>
          <SkeletonList rows={4} />
        </View>
      ) : !list.length ? (
        <EmptyState
          icon="credit-card"
          title={segment === "upcoming" ? "No upcoming tickets" : "No past tickets"}
          message={
            segment === "upcoming"
              ? "Tickets you buy will appear here, ready to scan at the door."
              : "Events you've been to will be kept here."
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon="search"
          title="No matches"
          message="Try a different event, venue or order code."
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.list}>
          {filtered.map((t, idx) => {
            const status = ticketStatus(t);
            const muted = segment === "past" || Boolean(status);
            const when = t.eventDate
              ? `${fmtShortDay(t.eventDate)}${t.eventTime ? `, ${t.eventTime}` : ""}`
              : "Date TBA";
            return (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(stagger(idx)).springify()}
                layout={LinearTransition}
              >
                <TicketPassCard
                  image={t.coverUrl}
                  name={t.eventName}
                  ticketLine={`${t.ticket || "Admission"}${t.quantity > 1 ? ` × ${t.quantity}` : ""} · ${when}`}
                  venue={[t.venue, t.city].filter(Boolean).join(", ")}
                  status={status}
                  timing={
                    segment === "past"
                      ? fmtDate(t.eventDate) || "Past"
                      : relativeDayLabel(t.eventDate) || "Scheduled"
                  }
                  price={money(t.total)}
                  muted={muted}
                  onPress={() => router.push(`/tickets/${t.id}`)}
                  onShowPass={
                    segment === "upcoming" ? () => router.push(`/pass/${t.id}` as Href) : undefined
                  }
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
  search: {
    marginBottom: spacing.md,
  },
  list: {
    gap: 14,
    marginTop: spacing.lg + 4,
  },
});
