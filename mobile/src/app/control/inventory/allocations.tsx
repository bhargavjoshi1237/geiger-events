import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ALLOCATION_META, ISSUANCE_LABEL, parseQty, qtyText } from "@/components/control/inventory/meta";
import { PickerField } from "@/components/control/inventory/PickerField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { AllocationEvent, AllocationStatus, InventoryAllocation, InventoryItem } from "@/types/control_inventory";

type Payload = { allocations: InventoryAllocation[]; items: InventoryItem[]; events: AllocationEvent[] };

const STATUSES: AllocationStatus[] = ["Planned", "Reserved", "Issued", "Closed"];

// Stock committed to events, and handing it out or taking it back.
export default function EventAllocationsScreen() {
  const { project } = useControl();
  const [eventId, setEventId] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const path = project ? `/api/control/inventory/${project.id}/allocations${eventId ? `?eventId=${eventId}` : ""}` : null;
  const list = useControlQuery<Payload>(path);
  const allocations = list.data?.allocations ?? [];
  const open = allocations.find((a) => a.id === openId) ?? null;

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load allocations" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!allocations.length) {
    body = eventId ? (
      <EmptyState icon="search" title="Nothing allocated to this event" message="Pick another event or allocate stock to it." actionLabel="Show every event" onAction={() => setEventId("")} />
    ) : (
      <EmptyState icon="calendar-check" title="No allocations yet" message="Commit stock to an event, then issue it on the day." actionLabel="Allocate stock" onAction={() => setCreating(true)} />
    );
  } else {
    body = (
      <View style={styles.group}>
        {allocations.map((a, i) => {
          const meta = ALLOCATION_META[a.status] ?? { label: a.status, tone: "neutral" as const };
          return (
            <ListRow
              key={a.id}
              leading={<IconTile icon="box" size={34} />}
              title={a.itemLabel ?? "Item"}
              subtitle={`${a.eventName ?? "Event"} · ${qtyText(a.issuedQty)} of ${qtyText(a.plannedQty)} issued · ${ISSUANCE_LABEL[a.issuance] ?? a.issuance}`}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => setOpenId(a.id)}
              divider={i < allocations.length - 1}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader title="Event allocations" right={project ? <IconButton icon="plus" label="Allocate stock" variant="solid" onPress={() => setCreating(true)} /> : undefined} />
      }
    >
      {list.data ? (
        <View style={styles.controls}>
          <PickerField
            label="Event"
            placeholder="Every event"
            options={[{ value: "", label: "Every event" }, ...(list.data.events ?? []).map((e) => ({ value: e.id, label: e.name, detail: e.date ?? undefined }))]}
            value={eventId}
            onChange={setEventId}
          />
        </View>
      ) : null}
      {body}
      <Text style={styles.footnote}>Add-on, session and audience issuance and collection rules are set on the dashboard.</Text>

      {project && list.data ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title="Allocate stock">
          <AllocateForm
            projectId={project.id}
            data={list.data}
            initialEventId={eventId}
            onClose={() => setCreating(false)}
            onDone={() => {
              setCreating(false);
              void list.reload();
            }}
          />
        </Sheet>
      ) : null}
      {project ? (
        <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title={open?.itemLabel ?? "Allocation"}>
          {open ? (
            <AllocationActions
              projectId={project.id}
              allocation={open}
              onChanged={() => void list.reload()}
              onDeleted={() => {
                setOpenId(null);
                void list.reload();
              }}
            />
          ) : null}
        </Sheet>
      ) : null}
    </Screen>
  );
}

function AllocateForm({ projectId, data, initialEventId, onClose, onDone }: { projectId: string; data: Payload; initialEventId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [eventId, setEventId] = useState(initialEventId);
  const [itemId, setItemId] = useState("");
  const [planned, setPlanned] = useState("");
  const [issuance, setIssuance] = useState("internal");
  const [ticketIds, setTicketIds] = useState<string[]>([]);
  const [perAttendee, setPerAttendee] = useState("1");
  const [busy, setBusy] = useState(false);
  const event = data.events.find((e) => e.id === eventId);

  const toggleTicket = (id: string) => {
    selectionFeedback();
    setTicketIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!eventId) return toast.error("Pick an event.");
    if (!itemId) return toast.error("Pick an item.");
    if (issuance === "ticket" && !ticketIds.length) return toast.error("Choose at least one ticket that entitles this item.");
    setBusy(true);
    const res = await controlApi<{ allocation: InventoryAllocation }>(`/api/control/inventory/${projectId}/allocations`, {
      method: "POST",
      body: { eventId, itemId, plannedQty: parseQty(planned) ?? 0, issuance, ticketIds, qtyPerAttendee: parseQty(perAttendee) ?? 1 },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Stock allocated.");
    onDone();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Event">
          <PickerField
            label="Event"
            placeholder="Choose an event"
            options={data.events.map((e) => ({ value: e.id, label: e.name, detail: e.date ?? undefined }))}
            value={eventId}
            onChange={(id) => {
              setEventId(id);
              setTicketIds([]);
            }}
            emptyText="Create an event first."
          />
        </Field>
        <Field label="Item">
          <PickerField
            label="Item"
            placeholder="Choose an item"
            options={data.items.map((i) => ({ value: i.id, label: i.label, detail: `${qtyText(i.onHand)} on hand` }))}
            value={itemId}
            onChange={setItemId}
            emptyText="Add an inventory item first."
          />
        </Field>
        <Field label="Planned quantity">
          <Input value={planned} onChangeText={setPlanned} keyboardType="decimal-pad" placeholder="0" />
        </Field>
        <Field label="Who gets it">
          <Segmented
            options={[
              { value: "internal", label: "Internal" },
              { value: "all", label: "Everyone" },
              { value: "ticket", label: "By ticket" },
            ]}
            value={issuance}
            onChange={setIssuance}
          />
        </Field>
        {issuance === "ticket" ? (
          <Field label="Tickets that entitle it">
            {event?.tickets.length ? (
              <View style={styles.choices}>
                {event.tickets.map((t, i) => {
                  const on = ticketIds.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t.name}
                      onPress={() => toggleTicket(t.id)}
                      style={({ pressed }) => [styles.choice, i < event.tickets.length - 1 && styles.divided, pressed && styles.pressed]}
                    >
                      <Text style={styles.choiceText}>{t.name}</Text>
                      <Icon name={on ? "circle-check" : "plus"} size={18} color={on ? colors.success : colors.textTertiary} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.muted}>{eventId ? "This event has no tickets yet." : "Pick an event to see its tickets."}</Text>
            )}
          </Field>
        ) : null}
        {issuance !== "internal" ? (
          <Field label="Per attendee">
            <Input value={perAttendee} onChangeText={setPerAttendee} keyboardType="decimal-pad" placeholder="1" />
          </Field>
        ) : null}
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Allocate" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function AllocationActions({ projectId, allocation, onChanged, onDeleted }: { projectId: string; allocation: InventoryAllocation; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState(allocation.outstanding ? qtyText(allocation.outstanding) : "");
  const [busy, setBusy] = useState<"issue" | "return" | "status" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/api/control/inventory/${projectId}/allocations/${allocation.id}`;

  const run = async (kind: "issue" | "return") => {
    const value = parseQty(qty);
    if (value == null || value <= 0) return toast.error("Enter a quantity above zero.");
    setBusy(kind);
    const res = await controlApi<{ allocation: InventoryAllocation }>(`${base}/stock`, { method: "POST", body: { mode: kind, qty: value } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(kind === "issue" ? "Stock issued." : "Stock returned.");
    onChanged();
  };

  const setStatus = async (status: string) => {
    setBusy("status");
    const res = await controlApi<{ allocation: InventoryAllocation }>(base, { method: "PATCH", body: { status } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    onChanged();
  };

  const remove = async () => {
    setBusy("delete");
    const res = await controlApi<{ deleted: boolean }>(base, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Allocation removed.");
    onDeleted();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.muted}>
          {`${allocation.eventName ?? "Event"} · ${qtyText(allocation.issuedQty)} of ${qtyText(allocation.plannedQty)} issued · ${qtyText(allocation.onHand ?? 0)} on hand`}
        </Text>
        <Field label="Status">
          <FilterChips options={STATUSES.map((s) => ({ value: s, label: s }))} value={allocation.status} onChange={(s) => void setStatus(s)} />
        </Field>
        <Field label="Quantity" hint={`${qtyText(allocation.outstanding)} still to issue`}>
          <Input value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" />
        </Field>
        <View style={styles.actions}>
          <Button title="Return" variant="secondary" icon="undo-2" onPress={() => void run("return")} loading={busy === "return"} disabled={busy !== null || !allocation.issuedQty} />
          <Button title="Issue" icon="arrow-right" onPress={() => void run("issue")} loading={busy === "issue"} disabled={busy !== null || !allocation.outstanding} />
        </View>
        {confirmDelete ? (
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Remove allocation" variant="destructive" onPress={() => void remove()} loading={busy === "delete"} />
          </View>
        ) : (
          <Button title="Remove allocation" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  footnote: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  muted: {
    ...type.body,
    color: colors.textSecondary,
  },
  choices: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  choiceText: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
