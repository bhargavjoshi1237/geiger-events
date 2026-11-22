import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { PO_META, parseQty, qtyText } from "@/components/control/inventory/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
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
import { moneyIn } from "@/lib/control_meta";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { PurchaseOrder, Supplier } from "@/types/control_inventory";

type Payload = { suppliers: Supplier[]; orders: PurchaseOrder[] };

const SETTABLE = [
  { value: "Draft", label: "Draft" },
  { value: "Ordered", label: "Ordered" },
  { value: "Cancelled", label: "Cancelled" },
];

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
    body = !orders.length ? (
      <EmptyState icon="receipt" title="No purchase orders" message="Purchase orders are drafted with their lines on the dashboard; track and receive them here." />
    ) : (
      <View style={styles.group}>
        {orders.map((o, i) => {
          const meta = PO_META[o.status] ?? { label: o.status, tone: "neutral" as const };
          return (
            <ListRow
              key={o.id}
              leading={<IconTile icon="receipt" size={34} />}
              title={o.ref}
              subtitle={[o.supplierName || "No supplier", moneyIn(o.total, o.currency), o.outstanding ? `${qtyText(o.outstanding)} to receive` : null].filter(Boolean).join(" · ")}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => setOpenPo(o.id)}
              divider={i < orders.length - 1}
            />
          );
        })}
      </View>
    );
  } else {
    body = !suppliers.length ? (
      <EmptyState icon="truck" title="No suppliers yet" message="Keep the people you buy stock from here." actionLabel="Add a supplier" onAction={() => setAdding(true)} />
    ) : (
      <View style={styles.group}>
        {suppliers.map((s, i) => (
          <ListRow
            key={s.id}
            leading={<IconTile icon="truck" size={34} />}
            title={s.name}
            subtitle={[s.contactName, s.email, s.leadTimeDays ? `${s.leadTimeDays}-day lead time` : null].filter(Boolean).join(" · ") || undefined}
            onPress={() => setOpenSupplier(s.id)}
            divider={i < suppliers.length - 1}
          />
        ))}
      </View>
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
        <Field label="Phone">
          <Input value={draft.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        </Field>
        <Field label="Lead time (days)">
          <Input value={draft.leadTimeDays} onChangeText={set("leadTimeDays")} keyboardType="number-pad" placeholder="0" />
        </Field>
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
      <View style={styles.group}>
        <ListRow title={supplier.contactName || "No contact"} subtitle="Contact" />
        <ListRow
          title={supplier.email || "No email"}
          subtitle="Email"
          onPress={supplier.email ? () => void Linking.openURL(`mailto:${supplier.email}`) : undefined}
        />
        <ListRow
          title={supplier.phone || "No phone"}
          subtitle="Phone"
          onPress={supplier.phone ? () => void Linking.openURL(`tel:${supplier.phone}`) : undefined}
        />
        <ListRow title={supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "Not set"} subtitle="Lead time" divider={false} />
      </View>
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
  const closed = order.status === "Received" || order.status === "Cancelled";

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
      <Text style={styles.muted}>
        {[order.supplierName || "No supplier", moneyIn(order.total, order.currency), order.orderedAt ? `ordered ${fmtDate(order.orderedAt)}` : null, order.expectedAt ? `expected ${fmtDate(order.expectedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {order.lines.length ? (
        <View style={styles.group}>
          {order.lines.map((line, i) => (
            <ListRow
              key={`${line.itemId}-${i}`}
              title={line.name || "Item"}
              subtitle={`${qtyText(line.receivedQty)} of ${qtyText(line.qty)} received · ${moneyIn(line.unitCost, order.currency)} each`}
              divider={i < order.lines.length - 1}
            />
          ))}
        </View>
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
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  muted: {
    ...type.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
