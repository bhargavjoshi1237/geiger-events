import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips, type FilterChip } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { GUEST_STATUS_META } from "@/lib/control_meta";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAdmitResult, ControlEventDetail, ControlGuest } from "@/types/portal";

type GuestPage = { guests: ControlGuest[]; nextOffset: number | null };

const block = (i: number) => Math.min(i, 8) * 50;
const stagger = (i: number) => Math.min(i, 11) * 35;
const count = (n: number) => n.toLocaleString("en-US");

const ADMITTABLE = new Set(["Confirmed", "Checked-in"]);

// What the list under each filter holds, so its title says what's inside.
const GROUP_TITLE: Record<string, string> = {
  all: "Everyone",
  Pending: "Waiting for approval",
  in: "Inside now",
  Confirmed: "Confirmed",
  Waitlisted: "Waitlist",
  Declined: "Declined",
};

function guestsPath(eventId: string, filter: string, term: string, offset = 0): string {
  const parts = [`offset=${offset}`];
  if (filter !== "all") parts.push(`status=${encodeURIComponent(filter)}`);
  if (term) parts.push(`q=${encodeURIComponent(term)}`);
  return `/api/control/events/${eventId}/guests?${parts.join("&")}`;
}

export default function ControlGuestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduced = useReducedMotion();
  const toast = useToast();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`);
  const can = hub.data?.can;
  const counts = hub.data?.counts;

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const listPath = guestsPath(id, filter, term);
  const list = useControlQuery<GuestPage>(listPath);
  const listPathRef = useRef(listPath);
  useEffect(() => {
    listPathRef.current = listPath;
  }, [listPath]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const guests = useMemo(() => list.data?.guests ?? [], [list.data]);
  const selected = guests.find((g) => g.id === selectedId) ?? null;

  const chips: FilterChip[] = [
    { value: "all", label: "All" },
    { value: "Pending", label: "Pending", count: counts?.pending || null },
    { value: "in", label: "Inside", count: counts?.checkedIn || null },
    { value: "Confirmed", label: "Confirmed" },
    { value: "Waitlisted", label: "Waitlisted" },
    { value: "Declined", label: "Declined" },
  ];

  const replaceGuest = (next: ControlGuest) =>
    list.setData((prev) => (prev ? { ...prev, guests: prev.guests.map((g) => (g.id === next.id ? next : g)) } : prev));

  const loadMore = async () => {
    const offset = list.data?.nextOffset;
    if (offset == null || loadingMore) return;
    const base = listPath;
    setLoadingMore(true);
    const res = await controlApi<GuestPage>(guestsPath(id, filter, term, offset));
    setLoadingMore(false);
    if (listPathRef.current !== base) return;
    if (!res.ok) return toast.error(res.error);
    list.setData((prev) =>
      prev ? { guests: [...prev.guests, ...res.data.guests.filter((g) => !prev.guests.some((p) => p.id === g.id))], nextOffset: res.data.nextOffset } : res.data,
    );
  };

  const filtered = filter !== "all" || Boolean(term);
  const chipLabel = chips.find((c) => c.value === filter)?.label.toLowerCase() ?? "";
  const pct = counts && counts.guests > 0 ? Math.round((counts.checkedIn / counts.guests) * 100) : 0;
  const groupTitle = term ? `Matching “${term}”` : GROUP_TITLE[filter] ?? "Guests";

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load guests" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (list.loading || !list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!guests.length) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title={term ? "No matching guests" : `No ${chipLabel} guests`}
        message={term ? "Try another name or email." : "Guests with this status will show up here."}
        actionLabel="Show everyone"
        onAction={() => {
          setQuery("");
          setTerm("");
          setFilter("all");
        }}
      />
    ) : (
      <EmptyState
        icon="users"
        title="No guests yet"
        message="People who register will appear here. Ticket buyers are under Orders."
        actionLabel={can?.edit ? "Add a guest" : undefined}
        onAction={can?.edit ? () => setAdding(true) : undefined}
      />
    );
  } else {
    body = (
      <View style={styles.listBlock}>
        <ListGroup title={groupTitle}>
          <Animated.View layout={reduced ? undefined : LinearTransition}>
            {guests.map((guest, i) => (
              <Animated.View key={guest.id} entering={reduced ? FadeIn : FadeInDown.delay(stagger(i)).springify()}>
                <GuestRow guest={guest} divided={i < guests.length - 1} onPress={() => setSelectedId(guest.id)} />
              </Animated.View>
            ))}
          </Animated.View>
        </ListGroup>
        {list.data.nextOffset != null ? (
          <Button title="Load more guests" variant="secondary" onPress={() => void loadMore()} loading={loadingMore} fullWidth />
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Guests"
          subtitle={hub.data?.event.name}
          right={can?.edit ? <IconButton icon="user-plus" label="Add a guest" variant="plain" onPress={() => setAdding(true)} /> : undefined}
        />
      }
    >
      <View style={styles.stack}>
        {counts ? (
          <Animated.View entering={FadeInDown.delay(block(0)).springify()}>
            <Readout
              lead={{
                label: "Inside",
                value: count(counts.checkedIn),
                hint: counts.guests > 0 ? `of ${count(counts.guests)} · ${pct}%` : "no guests yet",
                tone: counts.checkedIn > 0 ? "success" : "neutral",
              }}
              items={[
                { label: "Expected", value: count(counts.guests) },
                { label: "To arrive", value: count(Math.max(0, counts.guests - counts.checkedIn)) },
                { label: "Pending", value: count(counts.pending), tone: counts.pending ? "warning" : "neutral", hint: counts.pending ? "to approve" : undefined },
              ]}
            >
              {counts.guests > 0 ? (
                <TickMeter value={counts.checkedIn} max={counts.guests} ticks={44} height={16} label={`${counts.checkedIn} of ${counts.guests} inside`} />
              ) : null}
            </Readout>
          </Animated.View>
        ) : !hub.error ? (
          <Skeleton height={168} radius={radius.lg} />
        ) : null}

        <Animated.View entering={FadeInDown.delay(block(1)).springify()} style={styles.controls}>
          <Input
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search names or emails"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <FilterChips options={chips} value={filter} onChange={setFilter} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(block(2)).springify()}>{body}</Animated.View>
      </View>

      <GuestSheet
        eventId={id}
        guest={selected}
        canEdit={Boolean(can?.edit)}
        canCheckIn={Boolean(can?.checkIn)}
        onClose={() => setSelectedId(null)}
        onChanged={(next) => {
          replaceGuest(next);
          void hub.reload();
        }}
      />

      <AddGuestSheet
        eventId={id}
        visible={adding}
        onClose={() => setAdding(false)}
        onAdded={(guest) => {
          list.setData((prev) => (prev ? { ...prev, guests: [guest, ...prev.guests] } : { guests: [guest], nextOffset: null }));
          void hub.reload();
        }}
      />
    </Screen>
  );
}

function statusOf(guest: ControlGuest) {
  return GUEST_STATUS_META[guest.status] ?? { label: guest.status, tone: "neutral" as const };
}

function GuestRow({ guest, divided, onPress }: { guest: ControlGuest; divided: boolean; onPress: () => void }) {
  const status = statusOf(guest);
  const party = guest.partySize > 1 ? `party of ${guest.partySize}, ` : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${guest.name || "Guest"}, ${party}${guest.checkedIn ? "inside" : status.label}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      <Avatar name={guest.name} email={guest.email} size={36} />
      <View style={styles.rowStack}>
        <Text style={styles.rowName} numberOfLines={1}>
          {guest.name || "Unnamed guest"}
        </Text>
        {guest.email ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {guest.email}
          </Text>
        ) : null}
      </View>
      {guest.partySize > 1 ? <CountBadge value={`×${guest.partySize}`} /> : null}
      {guest.checkedIn ? <Pill label="Inside" tone="success" /> : <Pill label={status.label} tone={status.tone} variant="outline" />}
    </Pressable>
  );
}

// Like DetailRow, but selectable and two lines so codes, emails and phone numbers can be copied whole.
function Fact({ label, value, mono, divider }: { label: string; value: string; mono?: boolean; divider: boolean }) {
  return (
    <View style={[styles.fact, divider && styles.divided]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, mono && styles.mono]} numberOfLines={2} selectable>
        {value}
      </Text>
    </View>
  );
}

type GuestSheetProps = {
  eventId: string;
  guest: ControlGuest | null;
  canEdit: boolean;
  canCheckIn: boolean;
  onClose: () => void;
  onChanged: (guest: ControlGuest) => void;
};

function GuestSheet({ eventId, guest, canEdit, canCheckIn, onClose, onChanged }: GuestSheetProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "decline" | "checkin" | null>(null);
  const [override, setOverride] = useState<{ guestId: string; reason: string } | null>(null);
  const overriding = Boolean(guest && override?.guestId === guest.id);

  const close = () => {
    setOverride(null);
    onClose();
  };

  const decide = async (approve: boolean) => {
    if (!guest) return;
    setBusy(approve ? "approve" : "decline");
    const res = await controlApi<{ guest: ControlGuest }>(`/api/control/registrations/${guest.id}/decision`, {
      method: "POST",
      body: { approve },
    });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(approve ? `${res.data.guest.name || "Guest"} approved` : `${res.data.guest.name || "Guest"} declined`);
    onChanged(res.data.guest);
  };

  const checkIn = async (overrideReason?: string) => {
    if (!guest) return;
    setBusy("checkin");
    const res = await controlApi<ControlAdmitResult>(`/api/control/events/${eventId}/checkin`, {
      method: "POST",
      body: { registrationId: guest.id, method: "manual", clientId: Crypto.randomUUID(), overrideReason },
    });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    const result = res.data;
    if (result.status === "admitted" || result.status === "already") {
      if (result.status === "admitted") {
        successFeedback();
        toast.success(`${guest.name || "Guest"}: ${result.message}`);
      } else {
        errorFeedback();
        toast.info(`${guest.name || "Guest"} is already checked in`);
      }
      setOverride(null);
      onChanged({ ...guest, checkedIn: true });
      return;
    }
    errorFeedback();
    if (result.status === "capacity" && result.canOverride) {
      setOverride({ guestId: guest.id, reason: "" });
      return;
    }
    toast.error(result.message);
  };

  const pending = guest?.status === "Pending";
  const admittable = guest ? !guest.checkedIn && ADMITTABLE.has(guest.status) : false;
  const status = guest ? statusOf(guest) : null;
  const details = guest
    ? [
        { label: "Code", value: guest.code, mono: true },
        { label: "Email", value: guest.email },
        { label: "Phone", value: guest.phone, mono: true },
        { label: "Party", value: guest.partySize > 1 ? `${guest.partySize} people` : "1 person" },
        { label: "Source", value: guest.source },
        { label: "Dietary", value: guest.dietary },
        { label: "Access", value: guest.accessibility },
      ].filter((d) => d.value)
    : [];

  return (
    <Sheet visible={Boolean(guest)} onClose={close}>
      {guest && status ? (
        <View style={styles.sheetBody}>
          <View style={styles.head}>
            <Avatar name={guest.name} email={guest.email} size={56} shape="square" />
            <View style={styles.headText}>
              <Text style={styles.headName} numberOfLines={2}>
                {guest.name || "Guest"}
              </Text>
              <View style={styles.headMeta}>
                {guest.checkedIn ? <Pill label="Inside" tone="success" /> : null}
                <Pill label={status.label} tone={status.tone} variant="outline" />
              </View>
            </View>
          </View>

          <ListGroup title="Details">
            {details.map((d, i) => (
              <Fact key={d.label} label={d.label} value={d.value} mono={d.mono} divider={i < details.length - 1} />
            ))}
          </ListGroup>

          {overriding ? (
            <View style={styles.override}>
              <View style={styles.note}>
                <IconTile icon="door-open" size={36} tone="warning" />
                <Text style={styles.noteText}>This area is at capacity. Admit anyway with a reason; it&apos;s recorded like a supervisor override.</Text>
              </View>
              <Field label="Reason">
                <Input
                  value={override?.reason ?? ""}
                  onChangeText={(reason) => setOverride({ guestId: guest.id, reason })}
                  placeholder="e.g. Pre-arranged access"
                  autoFocus
                />
              </Field>
              <View style={styles.actions}>
                <Button title="Cancel" variant="ghost" onPress={() => setOverride(null)} />
                <Button
                  title="Admit anyway"
                  icon="door-open"
                  onPress={() => void checkIn(override?.reason.trim() || "Override from the app")}
                  loading={busy === "checkin"}
                  disabled={busy !== null}
                />
              </View>
            </View>
          ) : pending && canEdit ? (
            <View style={styles.split}>
              <View style={styles.flex}>
                <Button
                  title="Decline"
                  variant="destructiveGhost"
                  onPress={() => void decide(false)}
                  loading={busy === "decline"}
                  disabled={busy !== null}
                  fullWidth
                />
              </View>
              <View style={styles.flex}>
                <Button
                  title="Approve"
                  icon="user-check"
                  onPress={() => void decide(true)}
                  loading={busy === "approve"}
                  disabled={busy !== null}
                  fullWidth
                />
              </View>
            </View>
          ) : admittable && canCheckIn ? (
            <Button
              title="Check in"
              icon="door-open"
              onPress={() => void checkIn()}
              loading={busy === "checkin"}
              disabled={busy !== null}
              fullWidth
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

type AddGuestSheetProps = {
  eventId: string;
  visible: boolean;
  onClose: () => void;
  onAdded: (guest: ControlGuest) => void;
};

function AddGuestSheet({ eventId, visible, onClose, onAdded }: AddGuestSheetProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState("1");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setEmail("");
    setParty("1");
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the guest a name.");
    const partySize = Number(party) || 1;
    setBusy(true);
    const res = await controlApi<{ guest: ControlGuest }>(`/api/control/events/${eventId}/guests`, {
      method: "POST",
      body: { name: name.trim(), email: email.trim(), partySize },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`${res.data.guest.name} added`);
    onAdded(res.data.guest);
    close();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Add a guest">
      <View style={styles.sheetBody}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" autoFocus />
        </Field>
        <View style={styles.pair}>
          <View style={styles.wide}>
            <Field label="Email" hint="Optional.">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          </View>
          <View style={styles.narrow}>
            <Field label="Party">
              <Input value={party} onChangeText={(v) => setParty(v.replace(/[^0-9]/g, "").slice(0, 2))} keyboardType="number-pad" style={styles.monoInput} />
            </Field>
          </View>
        </View>
        <View style={styles.note}>
          <IconTile icon="user-check" size={36} tone="success" />
          <Text style={styles.noteText}>Added guests are confirmed straight away.</Text>
        </View>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={close} />
          <Button title="Add guest" icon="user-plus" onPress={() => void submit()} loading={busy} disabled={busy} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  controls: {
    gap: spacing.md,
  },
  listBlock: {
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  headName: {
    ...type.title,
    color: colors.foreground,
  },
  headMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 13,
  },
  factLabel: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  factValue: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
    color: colors.foreground,
  },
  mono: {
    ...type.mono,
  },
  override: {
    gap: spacing.lg,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  noteText: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: colors.textSecondary,
  },
  split: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  wide: {
    flex: 3,
    minWidth: 0,
  },
  narrow: {
    flex: 1,
    minWidth: 0,
  },
  monoInput: {
    ...type.mono,
    fontSize: 15,
    lineHeight: 20,
  },
});
