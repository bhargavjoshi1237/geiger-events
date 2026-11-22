import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips, type FilterChip } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { GUEST_STATUS_META } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAdmitResult, ControlEventDetail, ControlGuest } from "@/types/portal";

type GuestPage = { guests: ControlGuest[]; nextOffset: number | null };

const stagger = (i: number) => Math.min(i, 11) * 35;

const ADMITTABLE = new Set(["Confirmed", "Checked-in"]);

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
    { value: "Pending", label: "Pending", count: hub.data?.counts.pending || null },
    { value: "in", label: "Inside" },
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

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Guests"
          subtitle={hub.data?.event.name}
          right={
            can?.edit ? <IconButton icon="user-plus" label="Add a guest" variant="plain" onPress={() => setAdding(true)} /> : undefined
          }
        />
      }
    >
      <View style={styles.search}>
        <Input
          leftIcon="search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search names or emails"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View style={styles.chips}>
        <FilterChips options={chips} value={filter} onChange={setFilter} />
      </View>

      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load guests" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : list.loading || !list.data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !guests.length ? (
        filtered ? (
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
        )
      ) : (
        <>
          <Animated.View layout={reduced ? undefined : LinearTransition} style={styles.group}>
            {guests.map((guest, i) => (
              <Animated.View key={guest.id} entering={reduced ? FadeIn : FadeInDown.delay(stagger(i)).springify()}>
                <GuestRow guest={guest} divided={i < guests.length - 1} onPress={() => setSelectedId(guest.id)} />
              </Animated.View>
            ))}
          </Animated.View>
          {list.data.nextOffset != null ? (
            <View style={styles.more}>
              <Button title="Load more" variant="secondary" size="sm" onPress={() => void loadMore()} loading={loadingMore} />
            </View>
          ) : null}
        </>
      )}

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

function GuestRow({ guest, divided, onPress }: { guest: ControlGuest; divided: boolean; onPress: () => void }) {
  const status = GUEST_STATUS_META[guest.status] ?? { label: guest.status, tone: "neutral" as const };
  const detail = [guest.email, guest.partySize > 1 ? `party of ${guest.partySize}` : ""].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${guest.name || "Guest"}, ${guest.checkedIn ? "inside" : status.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divided && styles.rowDivided, pressed && styles.pressed]}
    >
      <View style={styles.rowStack}>
        <Text style={styles.rowName} numberOfLines={1}>
          {guest.name || "Unnamed guest"}
        </Text>
        {detail ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {guest.checkedIn ? <Pill label="Inside" tone="success" /> : <Pill label={status.label} tone={status.tone} variant="outline" />}
    </Pressable>
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
  const details = guest
    ? [
        { label: "Code", value: guest.code, mono: true },
        { label: "Email", value: guest.email },
        { label: "Phone", value: guest.phone },
        { label: "Party", value: guest.partySize > 1 ? `${guest.partySize} people` : "1 person" },
        { label: "Source", value: guest.source },
        { label: "Dietary", value: guest.dietary },
        { label: "Access", value: guest.accessibility },
      ].filter((d) => d.value)
    : [];

  return (
    <Sheet visible={Boolean(guest)} onClose={close} title={guest?.name || "Guest"}>
      {guest ? (
        <View style={styles.sheetBody}>
          <View style={styles.sheetPills}>
            {guest.checkedIn ? <Pill label="Inside" tone="success" /> : null}
            <Pill label={GUEST_STATUS_META[guest.status]?.label ?? guest.status} tone={GUEST_STATUS_META[guest.status]?.tone ?? "neutral"} variant="outline" />
          </View>

          <View style={styles.details}>
            {details.map((d, i) => (
              <View key={d.label} style={[styles.detailRow, i < details.length - 1 && styles.rowDivided]}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={[styles.detailValue, d.mono && styles.mono]} numberOfLines={2} selectable>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>

          {overriding ? (
            <View style={styles.override}>
              <Text style={styles.overrideText}>This area is at capacity. Admit anyway with a reason; it&apos;s recorded like a supervisor override.</Text>
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
          ) : (
            <View style={styles.actionStack}>
              {pending && canEdit ? (
                <View style={styles.actions}>
                  <Button
                    title="Decline"
                    variant="destructiveGhost"
                    onPress={() => void decide(false)}
                    loading={busy === "decline"}
                    disabled={busy !== null}
                  />
                  <Button
                    title="Approve"
                    icon="user-check"
                    onPress={() => void decide(true)}
                    loading={busy === "approve"}
                    disabled={busy !== null}
                  />
                </View>
              ) : null}
              {admittable && canCheckIn ? (
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
          )}
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
        <Field label="Party size">
          <Input value={party} onChangeText={(v) => setParty(v.replace(/[^0-9]/g, "").slice(0, 2))} keyboardType="number-pad" />
        </Field>
        <Text style={styles.note}>Added guests are confirmed straight away.</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={close} />
          <Button title="Add guest" icon="user-plus" onPress={() => void submit()} loading={busy} disabled={busy} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.md,
  },
  chips: {
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  rowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
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
  more: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetPills: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  details: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailLabel: {
    ...type.caption,
    width: 64,
    color: colors.textSecondary,
  },
  detailValue: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  mono: {
    ...type.mono,
  },
  override: {
    gap: spacing.md,
  },
  overrideText: {
    ...type.body,
    color: colors.textSecondary,
  },
  actionStack: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
