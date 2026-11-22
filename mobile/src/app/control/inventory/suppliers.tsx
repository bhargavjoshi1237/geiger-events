import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { PO_META, parseQty, qtyText } from "@/components/control/inventory/meta";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { PurchaseOrder, Supplier } from "@/types/control_inventory";

type Payload = { suppliers: Supplier[]; orders: PurchaseOrder[] };

const SETTABLE = [
  { value: "Draft", label: "Draft" },
  { value: "Ordered", label: "Ordered" },
  { value: "Cancelled", label: "Cancelled" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;
const isClosed = (o: PurchaseOrder) => o.status === "Received" || o.status === "Cancelled";
const unitsOf = (o: PurchaseOrder) => o.lines.reduce((sum, l) => sum + l.qty, 0);
const receivedOf = (o: PurchaseOrder) => o.lines.reduce((sum, l) => sum + l.receivedQty, 0);

export default function SuppliersScreen() {
  const { project } = useControl();
  const [tab, setTab] = useState("orders");
  const [adding, setAdding] = useState(false);
  const [openPo, setOpenPo] = useState<string | null>(null);
  const [openSupplier, setOpenSupplier] = useState<string | null>(null);
  const list = useControlQuery<Payload>(project ? `/api/control/inventory/${project.id}/suppliers` : null);
  const orders = list.data?.orders ?? [];
  const suppliers = list.data?.suppliers ?? [];
  const po = orders.find((o) => o.id === openPo) ?? null;
  const supplier = suppliers.find((s) => s.id === openSupplier) ?? null;

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load suppliers" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (tab === "orders") {
    const openOrders = orders.filter((o) => !isClosed(o));
    const closedOrders = orders.filter(isClosed);
    const toReceive = openOrders.reduce((sum, o) => sum + o.outstanding, 0);
    const groups = [
      { title: "Open orders", rows: openOrders },
      { title: "Received and cancelled", rows: closedOrders },
    ].filter((g) => g.rows.length);
    let step = 0;
    body = !orders.length ? (
      <EmptyState icon="receipt" title="No purchase orders" message="Purchase orders are drafted with their lines on the dashboard; track and receive them here." />
    ) : (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{ label: "Units to receive", value: qtyText(toReceive), hint: `on ${openOrders.length} open ${openOrders.length === 1 ? "order" : "orders"}` }}
            items={[
              { label: "Drafts", value: String(orders.filter((o) => o.status === "Draft").length) },
              { label: "Part received", value: String(orders.filter((o) => o.status === "Partial").length), tone: orders.some((o) => o.status === "Partial") ? "warning" : "neutral" },
              { label: "Received", value: String(orders.filter((o) => o.status === "Received").length) },
            ]}
          />
        </Animated.View>
        {groups.map((g) => (
          <Animated.View key={g.title} entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title={g.title}>
              {g.rows.map((o, i) => (
                <OrderRow key={o.id} order={o} onPress={() => setOpenPo(o.id)} divider={i < g.rows.length - 1} />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
      </View>
    );
  } else {
    body = !suppliers.length ? (
      <EmptyState icon="truck" title="No suppliers yet" message="Keep the people you buy stock from here." actionLabel="Add a supplier" onAction={() => setAdding(true)} />
    ) : (
      <Animated.View entering={FadeInDown.springify()}>
        <ListGroup title={`${suppliers.length} ${suppliers.length === 1 ? "supplier" : "suppliers"}`}>
          {suppliers.map((s, i) => (
            <ListRow
              key={s.id}
              leading={<IconTile icon="truck" size={36} />}
              title={s.name}
              subtitle={[s.contactName, s.email, s.leadTimeDays ? `${s.leadTimeDays}-day lead time` : null].filter(Boolean).join(" · ") || undefined}
              onPress={() => setOpenSupplier(s.id)}
              divider={i < suppliers.length - 1}
            />
          ))}
        </ListGroup>
      </Animated.View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Suppliers & orders"
          right={project && tab === "suppliers" ? <IconButton icon="plus" label="Add a supplier" variant="solid" onPress={() => setAdding(true)} /> : undefined}
        />
      }
    >
      <View style={styles.controls}>
        <Segmented
          options={[
            { value: "orders", label: "Purchase orders" },
            { value: "suppliers", label: "Suppliers" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {body}

      {project ? (
        <>
          <Sheet visible={adding} onClose={() => setAdding(false)} title="New supplier">
            <SupplierForm
              projectId={project.id}
              onClose={() => setAdding(false)}
              onCreated={() => {
                setAdding(false);
                void list.reload();
              }}
            />
          </Sheet>
          <Sheet visible={Boolean(po)} onClose={() => setOpenPo(null)} title={po?.ref ?? "Purchase order"}>
            {po ? (
              <PurchaseOrderActions
                projectId={project.id}
                order={po}
                onChanged={() => void list.reload()}
                onDeleted={() => {
                  setOpenPo(null);
                  void list.reload();
                }}
              />
            ) : null}
          </Sheet>
          <Sheet visible={Boolean(supplier)} onClose={() => setOpenSupplier(null)} title={supplier?.name ?? "Supplier"}>
            {supplier ? (
              <SupplierDetail
                projectId={project.id}
                supplier={supplier}
                onDeleted={() => {
                  setOpenSupplier(null);
                  void list.reload();
                }}
              />
            ) : null}
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

// A purchase order: mono reference and total, received against ordered on the tick scale while it's still open.
function OrderRow({ order, onPress, divider }: { order: PurchaseOrder; onPress: () => void; divider: boolean }) {
  const meta = PO_META[order.status] ?? { label: order.status, tone: "neutral" as const };
  const units = unitsOf(order);
  const received = receivedOf(order);
  const line = [order.supplierName || "No supplier", order.expectedAt ? `due ${fmtDate(order.expectedAt)}` : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.ref}, ${meta.label}, ${moneyIn(order.total, order.currency)}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.order, divider && styles.divided, pressed && styles.pressed]}
    >
      <IconTile icon="receipt" size={36} tone={isClosed(order) ? "outline" : "neutral"} />
      <View style={styles.orderStack}>
        <View style={styles.orderHead}>
          <Text style={styles.ref} numberOfLines={1}>
            {order.ref}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        <View style={styles.orderHead}>
          <Text style={styles.orderLine} numberOfLines={1}>
            {line}
          </Text>
          <Text style={styles.total}>{moneyIn(order.total, order.currency)}</Text>
        </View>
        {!isClosed(order) && units > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={received} max={units} ticks={30} height={9} label={`${qtyText(received)} of ${qtyText(units)} received`} />
            </View>
            <Text style={styles.count}>
              {qtyText(received)}
              <Text style={styles.countOf}>{`/${qtyText(units)}`}</Text>
            </Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function SupplierForm({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({ name: "", contactName: "", email: "", phone: "", website: "", leadTimeDays: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) return toast.error("Give the supplier a name.");
    setBusy(true);
    const res = await controlApi<{ supplier: Supplier }>(`/api/control/inventory/${projectId}/suppliers`, {
      method: "POST",
      body: { ...draft, leadTimeDays: parseQty(draft.leadTimeDays) ?? 0 },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Supplier added.");
    onCreated();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name">
          <Input value={draft.name} onChangeText={set("name")} placeholder="e.g. Northline Print" />
        </Field>
        <Field label="Contact">
          <Input value={draft.contactName} onChangeText={set("contactName")} placeholder="Who you deal with" />
        </Field>
        <Field label="Email">
          <Input value={draft.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="orders@supplier.com" />
        </Field>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Phone">
              <Input value={draft.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
            </Field>
          </View>
          <View style={styles.cell}>
            <Field label="Lead time (days)">
              <Input value={draft.leadTimeDays} onChangeText={set("leadTimeDays")} keyboardType="number-pad" placeholder="0" />
            </Field>
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add supplier" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SupplierDetail({ projectId, supplier, onDeleted }: { projectId: string; supplier: Supplier; onDeleted: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/inventory/${projectId}/suppliers/${supplier.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Supplier removed.");
    onDeleted();
  };

  return (
    <View style={styles.form}>
      <ListGroup>
        <DetailRow label="Contact" value={supplier.contactName || "No contact"} icon="contact" />
        <DetailRow label="Lead time" value={supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "Not set"} icon="clock" mono={Boolean(supplier.leadTimeDays)} divider={false} />
      </ListGroup>
      {supplier.email || supplier.phone ? (
        <ListGroup title="Get in touch">
          {supplier.email ? (
            <ListRow
              leading={<IconTile icon="mail" size={36} />}
              title={supplier.email}
              subtitle="Email"
              onPress={() => void Linking.openURL(`mailto:${supplier.email}`)}
              divider={Boolean(supplier.phone)}
            />
          ) : null}
          {supplier.phone ? (
            <ListRow leading={<IconTile icon="smartphone" size={36} />} title={supplier.phone} subtitle="Phone" onPress={() => void Linking.openURL(`tel:${supplier.phone}`)} divider={false} />
          ) : null}
        </ListGroup>
      ) : (
        <Text style={styles.muted}>No email or phone on file.</Text>
      )}
      {supplier.notes ? <Text style={styles.muted}>{supplier.notes}</Text> : null}
      {confirm ? (
        <View style={styles.actions}>
          <Button title="Keep" variant="ghost" onPress={() => setConfirm(false)} />
          <Button title="Remove supplier" variant="destructive" onPress={() => void remove()} loading={busy} />
        </View>
      ) : (
        <Button title="Remove supplier" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirm(true)} fullWidth />
      )}
    </View>
  );
}

function PurchaseOrderActions({ projectId, order, onChanged, onDeleted }: { projectId: string; order: PurchaseOrder; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"status" | "receive" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const base = `/api/control/inventory/${projectId}/purchase-orders/${order.id}`;
  const closed = isClosed(order);
  const facts = [
    { label: "Supplier", value: order.supplierName || "No supplier", mono: false },
    { label: "Total", value: moneyIn(order.total, order.currency), mono: true },
    order.orderedAt ? { label: "Ordered", value: fmtDate(order.orderedAt), mono: true } : null,
    order.expectedAt ? { label: "Expected", value: fmtDate(order.expectedAt), mono: true } : null,
  ].filter((f): f is { label: string; value: string; mono: boolean } => Boolean(f));

  const call = async (kind: "status" | "receive" | "delete", path: string, init: { method: string; body?: unknown }, done: string) => {
    setBusy(kind);
    const res = await controlApi<unknown>(path, init);
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return false;
    }
    successFeedback();
    toast.success(done);
    return true;
  };

  return (
    <View style={styles.form}>
      <ListGroup>
        {facts.map((f, i) => (
          <DetailRow key={f.label} label={f.label} value={f.value} mono={f.mono} divider={i < facts.length - 1} />
        ))}
      </ListGroup>
      {order.lines.length ? (
        <ListGroup title="Lines">
          {order.lines.map((line, i) => (
            <View key={`${line.itemId}-${i}`} style={[styles.lineRow, i < order.lines.length - 1 && styles.divided]}>
              <View style={styles.lineText}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {line.name || "Item"}
                </Text>
                <Text style={styles.lineCost}>{`${moneyIn(line.unitCost, order.currency)} each`}</Text>
              </View>
              <Text style={[styles.lineQty, line.receivedQty >= line.qty && styles.lineDone]}>
                {qtyText(line.receivedQty)}
                <Text style={styles.countOf}>{`/${qtyText(line.qty)}`}</Text>
              </Text>
            </View>
          ))}
        </ListGroup>
      ) : null}
      {closed ? (
        <Pill label={PO_META[order.status].label} tone={PO_META[order.status].tone} />
      ) : (
        <Field label="Status" hint="Partially received and Received are set by receiving stock.">
          <FilterChips
            options={SETTABLE}
            value={order.status === "Partial" ? "" : order.status}
            onChange={async (status) => {
              if (await call("status", base, { method: "PATCH", body: { status } }, `Marked ${status.toLowerCase()}.`)) onChanged();
            }}
          />
        </Field>
      )}
      {!closed && order.outstanding > 0 ? (
        <Button
          title={`Receive ${qtyText(order.outstanding)} into stock`}
          icon="arrow-down"
          onPress={async () => {
            if (await call("receive", `${base}/receive`, { method: "POST" }, "Stock received.")) onChanged();
          }}
          loading={busy === "receive"}
          disabled={busy !== null}
          fullWidth
        />
      ) : null}
      {confirm ? (
        <View style={styles.actions}>
          <Button title="Keep" variant="ghost" onPress={() => setConfirm(false)} />
          <Button
            title="Remove order"
            variant="destructive"
            onPress={async () => {
              if (await call("delete", base, { method: "DELETE" }, "Purchase order removed.")) onDeleted();
            }}
            loading={busy === "delete"}
          />
        </View>
      ) : (
        <Button title="Remove order" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirm(true)} fullWidth />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  order: {
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
  orderStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  orderHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ref: {
    ...type.mono,
    flex: 1,
    color: colors.foreground,
  },
  orderLine: {
    ...type.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  total: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: 3,
  },
  meter: {
    flex: 1,
  },
  count: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.foreground,
  },
  countOf: {
    color: colors.textTertiary,
  },
  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
  },
  lineText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lineName: {
    ...type.label,
    color: colors.foreground,
  },
  lineCost: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  lineQty: {
    ...type.mono,
    color: colors.foreground,
  },
  lineDone: {
    color: colors.success,
  },
  muted: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
