import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlEventDetail, ControlTicket } from "@/types/portal";

type TicketInput = { id?: string; name: string; price: number; qty: number; description: string };
// index null = a new ticket appended at the end.
type Editing = { index: number | null; name: string; price: string; qty: string; description: string };

const toInput = (t: ControlTicket): TicketInput => ({ id: t.id, name: t.name, price: t.price, qty: t.qty, description: t.description });
const count = (n: number) => n.toLocaleString("en-US");
const priceOf = (price: number, currency: string) => (price > 0 ? moneyIn(price, currency) : "Free");
const stagger = (i: number) => Math.min(i, 8) * 50;

export default function TicketsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`);
  const list = useControlQuery<{ tickets: ControlTicket[] }>(`/api/control/events/${id}/tickets`);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const canEdit = Boolean(hub.data?.can.edit);
  const currency = hub.data?.details.currency ?? "usd";
  const tickets = list.data?.tickets ?? [];

  // The server merges by id, so the full ordered list is always sent and keys only the dashboard edits survive.
  const save = async (next: TicketInput[], success: string): Promise<boolean> => {
    setBusy(true);
    const res = await controlApi<{ tickets: ControlTicket[] }>(`/api/control/events/${id}/tickets`, {
      method: "PUT",
      body: { tickets: next },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return false;
    }
    list.setData(res.data);
    successFeedback();
    toast.success(success);
    return true;
  };

  const open = (index: number | null) => {
    const t = index === null ? null : tickets[index];
    setConfirmDelete(false);
    setEditing({
      index,
      name: t?.name ?? "",
      price: t ? String(t.price) : "0",
      qty: t ? String(t.qty) : "0",
      description: t?.description ?? "",
    });
  };

  const submit = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const price = Number(editing.price.replace(",", "."));
    const qty = Number(editing.qty || "0");
    if (!name) return toast.error("Give the ticket a name.");
    if (!Number.isFinite(price) || price < 0) return toast.error("Price must be 0 or more.");
    if (!Number.isInteger(qty) || qty < 0) return toast.error("Quantity must be a whole number, 0 or more.");
    const entry: TicketInput = { name, price, qty, description: editing.description.trim() };
    const current = tickets.map(toInput);
    const next =
      editing.index === null
        ? [...current, entry]
        : current.map((t, i) => (i === editing.index ? { ...entry, id: t.id } : t));
    if (await save(next, editing.index === null ? "Ticket added" : "Ticket saved")) setEditing(null);
  };

  const remove = async () => {
    if (!editing || editing.index === null) return;
    const next = tickets.map(toInput).filter((_, i) => i !== editing.index);
    if (await save(next, "Ticket deleted")) setEditing(null);
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = tickets.map(toInput);
    const target = index + delta;
    if (target < 0 || target >= next.length || busy) return;
    [next[index], next[target]] = [next[target], next[index]];
    void save(next, "Order updated");
  };

  const failed = (list.error && !list.data) || (hub.error && !hub.data);

  let body: React.ReactNode;
  if (failed) {
    body = (
      <EmptyState
        icon="circle-alert"
        title="Couldn't load tickets"
        message={list.error ?? hub.error ?? "Something went wrong."}
        actionLabel="Try again"
        onAction={() => {
          void hub.reload();
          void list.reload();
        }}
      />
    );
  } else if (!list.data || !hub.data) {
    body = <SkeletonList rows={3} variant="divided" />;
  } else if (!tickets.length) {
    body = (
      <EmptyState
        icon="ticket"
        title="No tickets yet"
        message={canEdit ? "Add the tickets buyers can choose from." : "This event has no tickets on sale."}
        actionLabel={canEdit ? "Add ticket" : undefined}
        onAction={canEdit ? () => open(null) : undefined}
      />
    );
  } else {
    const { sold, capacity } = hub.data.event;
    const pct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
    // A quantity of 0 means no limit, so one open ticket makes the whole allocation open-ended.
    const unlimited = tickets.some((t) => t.qty === 0);
    const allocated = tickets.reduce((sum, t) => sum + t.qty, 0);
    const lowest = Math.min(...tickets.map((t) => t.price));
    const overAllocated = !unlimited && capacity > 0 && allocated > capacity;

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            lead={{ label: "Sold", value: count(sold), hint: capacity > 0 ? `of ${count(capacity)} · ${pct}%` : "no capacity set" }}
            items={[
              { label: "Types", value: String(tickets.length) },
              {
                label: "Allocated",
                value: unlimited ? "No limit" : count(allocated),
                hint: !unlimited && capacity > 0 ? `of ${count(capacity)}` : undefined,
                tone: overAllocated ? "warning" : "neutral",
              },
              { label: "From", value: priceOf(lowest, currency) },
            ]}
          >
            {capacity > 0 ? <TickMeter value={sold} max={capacity} ticks={44} height={16} label={`${sold} of ${capacity} sold`} /> : null}
          </Readout>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup
            title={`${tickets.length} ${pluralize(tickets.length, "ticket type", "ticket types")}`}
            footer="Ticket types, tiers, release waves and discounts are set on the dashboard and kept when you edit here."
          >
            {tickets.map((ticket, i) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                currency={currency}
                capacity={capacity}
                divider={i < tickets.length - 1}
                onPress={canEdit ? () => open(i) : undefined}
                onUp={canEdit && i > 0 ? () => move(i, -1) : undefined}
                onDown={canEdit && i < tickets.length - 1 ? () => move(i, 1) : undefined}
              />
            ))}
          </ListGroup>
        </Animated.View>

        {canEdit ? (
          <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
            <Button title="Add ticket" icon="plus" variant="secondary" onPress={() => open(null)} fullWidth />
          </Animated.View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Tickets"
          subtitle={hub.data?.event.name}
          right={canEdit && tickets.length ? <IconButton icon="plus" label="Add ticket" variant="plain" onPress={() => open(null)} /> : undefined}
        />
      }
    >
      {body}

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing?.index === null ? "New ticket" : "Edit ticket"}>
        {editing ? (
          <View style={styles.sheetBody}>
            <Field label="Name">
              <Input value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} placeholder="General Admission" maxLength={120} />
            </Field>
            <View style={styles.pair}>
              <View style={styles.half}>
                <Field label={`Price (${currency.toUpperCase()})`} hint="0 makes it free">
                  <Input
                    value={editing.price}
                    onChangeText={(price) => setEditing({ ...editing, price })}
                    keyboardType="decimal-pad"
                    maxLength={10}
                    style={styles.monoInput}
                  />
                </Field>
              </View>
              <View style={styles.half}>
                <Field label="Quantity" hint="0 means no limit">
                  <Input
                    value={editing.qty}
                    onChangeText={(qty) => setEditing({ ...editing, qty: qty.replace(/[^0-9]/g, "") })}
                    keyboardType="number-pad"
                    maxLength={8}
                    style={styles.monoInput}
                  />
                </Field>
              </View>
            </View>
            <Field label="Description">
              <Input
                value={editing.description}
                onChangeText={(description) => setEditing({ ...editing, description })}
                placeholder="What this ticket includes"
                multiline
                maxLength={1000}
                style={styles.multiline}
              />
            </Field>

            {confirmDelete ? (
              <View style={styles.confirm}>
                <View style={styles.confirmNote}>
                  <IconTile icon="trash-2" size={36} tone="danger" />
                  <Text style={styles.confirmText}>Delete this ticket? Buyers who already hold it keep it.</Text>
                </View>
                <View style={styles.actions}>
                  <Button title="Keep" variant="ghost" onPress={() => setConfirmDelete(false)} disabled={busy} />
                  <Button title="Delete ticket" variant="destructive" onPress={() => void remove()} loading={busy} disabled={busy} />
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                {editing.index !== null ? (
                  <Button title="Delete" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} disabled={busy} />
                ) : null}
                <View style={styles.spacer} />
                <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} disabled={busy} />
                <Button title={editing.index === null ? "Add ticket" : "Save"} onPress={() => void submit()} loading={busy} disabled={busy} />
              </View>
            )}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

type RowProps = {
  ticket: ControlTicket;
  currency: string;
  capacity: number;
  divider: boolean;
  onPress?: () => void;
  onUp?: () => void;
  onDown?: () => void;
};

// A ticket type: mono price, its quantity on the tick scale against the event's capacity, and reorder controls.
function TicketRow({ ticket, currency, capacity, divider, onPress, onUp, onDown }: RowProps) {
  const ruled = ticket.qty > 0 && capacity > 0;
  const rules = ticket.hasType || ticket.releases > 0;
  const body = (
    <>
      <IconTile icon="ticket" size={36} />
      <View style={styles.rowStack}>
        <View style={styles.rowHead}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {ticket.name}
          </Text>
          <Text style={styles.rowPrice}>{priceOf(ticket.price, currency)}</Text>
        </View>
        {ticket.description ? (
          <Text style={styles.rowMeta} numberOfLines={2}>
            {ticket.description}
          </Text>
        ) : null}
        {ruled ? (
          <View style={styles.meterRow}>
            <Text style={styles.meterLabel}>Qty</Text>
            <View style={styles.meter}>
              <TickMeter value={ticket.qty} max={capacity} ticks={30} height={9} tone="neutral" label={`${ticket.qty} of ${capacity} places`} />
            </View>
            <Text style={styles.meterCount}>
              {count(ticket.qty)}
              <Text style={styles.meterOf}>{`/${count(capacity)}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.qty}>{ticket.qty > 0 ? `${count(ticket.qty)} available` : "No limit"}</Text>
        )}
        {rules ? (
          <View style={styles.rules}>
            <Icon name="layers" size={12} color={colors.textTertiary} />
            <Text style={styles.rulesText}>
              {ticket.releases > 0
                ? `${ticket.releases} ${pluralize(ticket.releases, "release", "releases")} · rules set on the dashboard`
                : "Rules set on the dashboard"}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.row, divider && styles.divided]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${ticket.name}`}
          onPress={() => {
            tapFeedback();
            onPress();
          }}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.rowMain}>{body}</View>
      )}
      {onUp || onDown ? (
        <View style={styles.moves}>
          {onUp ? (
            <IconButton icon="arrow-up" label={`Move ${ticket.name} up`} variant="plain" size={32} iconSize={16} onPress={onUp} />
          ) : (
            <View style={styles.moveSlot} />
          )}
          {onDown ? (
            <IconButton icon="arrow-down" label={`Move ${ticket.name} down`} variant="plain" size={32} iconSize={16} onPress={onDown} />
          ) : (
            <View style={styles.moveSlot} />
          )}
        </View>
      ) : onPress ? (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md + 2,
    paddingVertical: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  rowTitle: {
    ...type.label,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowPrice: {
    ...type.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: 2,
  },
  meterLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  meter: {
    flex: 1,
  },
  meterCount: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.foreground,
  },
  meterOf: {
    color: colors.textTertiary,
  },
  qty: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  rules: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  rulesText: {
    ...type.micro,
    color: colors.textTertiary,
  },
  moves: {
    gap: spacing.xs,
  },
  moveSlot: {
    width: 32,
    height: 32,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  monoInput: {
    ...type.mono,
    fontSize: 15,
    lineHeight: 20,
  },
  multiline: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  confirm: {
    gap: spacing.lg,
  },
  confirmNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  confirmText: {
    ...type.body,
    flex: 1,
    color: colors.textSecondary,
  },
});
