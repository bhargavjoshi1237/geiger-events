"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Eye, Loader2, Mail, StickyNote, Ticket, User } from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  Field,
  SectionCard,
  SegmentedTabs,
  SettingsList,
  SettingRow,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { IconInput } from "@/components/internal/shared/icon_input";
import { NumField } from "../tickets/controls";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { addOrderEvent } from "@/lib/supabase/order_events";
import { updateOrder } from "@/lib/supabase/orders";

import { ORDER_STATUS_MAP, currency, formatDateTime, orderRef } from "./constants";

// Money is stored to the cent, so everything the editor computes rounds there.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// --- Edit sections ----------------------------------------------------------
// EditorShell renders each one as an element, never calls it.

function BuyerSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          hint="Shown on the receipt and the attendee list."
          className="sm:col-span-2"
        >
          <IconInput
            icon={User}
            wrapperClassName="w-full"
            className="w-full"
            value={config.name || ""}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ada Lovelace"
          />
        </Field>
        <Field
          label="Email"
          hint="Where tickets, receipts and refund confirmations are sent."
          className="sm:col-span-2"
        >
          <IconInput
            icon={Mail}
            type="email"
            wrapperClassName="w-full"
            className="w-full"
            value={config.email || ""}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="ada@example.com"
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function TicketsSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const price = Number(config.price) || 0;
  const quantity = Math.max(1, Number(config.quantity) || 1);
  const autoTotal = round2(price * quantity);
  // Mode is operator intent rather than a stored value: it starts out derived
  // from whether the total already equals price × quantity, then sticks once
  // picked, so an override survives a reload without a new column.
  const matchesAuto = Math.abs((Number(config.total) || 0) - autoTotal) < 0.005;
  const mode = config.totalMode || (matchesAuto ? "auto" : "manual");

  const setPrice = (v) =>
    set(mode === "auto" ? { price: v, total: round2(v * quantity) } : { price: v });
  const setQuantity = (v) => {
    const q = Math.max(1, Math.round(v) || 1);
    set(mode === "auto" ? { quantity: q, total: round2(price * q) } : { quantity: q });
  };
  const setMode = (v) =>
    set(v === "auto" ? { totalMode: "auto", total: autoTotal } : { totalMode: "manual" });

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticket" className="sm:col-span-2">
          <IconInput
            icon={Ticket}
            wrapperClassName="w-full"
            className="w-full"
            value={config.ticket || ""}
            onChange={(e) => set({ ticket: e.target.value })}
            placeholder="General Admission"
          />
        </Field>
        <NumField
          label="Unit price"
          value={price}
          fullWidth
          unit="USD"
          onChange={setPrice}
        />
        <NumField
          label="Quantity"
          min={1}
          value={quantity}
          fullWidth
          unit="tickets"
          onChange={setQuantity}
        />
        <Field
          label="Total mode"
          hint={
            mode === "auto"
              ? "Auto — the total tracks unit price × quantity."
              : "Manual — the total stays where you put it."
          }
        >
          {/* w-fit both breakpoints: the component ships `w-full sm:w-auto`,
              and `w-auto` on this flex item just stretches back to full. */}
          <SegmentedTabs
            value={mode}
            onChange={setMode}
            tabs={[
              { value: "auto", label: "Auto" },
              { value: "manual", label: "Manual" },
            ]}
            className="w-fit sm:w-fit"
          />
        </Field>
        <NumField
          label="Total"
          hint="Changing this changes the event's reported revenue."
          value={Number(config.total) || 0}
          fullWidth
          unit="USD"
          onChange={(v) => set({ total: round2(v) })}
        />
      </div>
    </SectionCard>
  );
}

function PaymentSection({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      {/* Stacked rather than paired: these are long mono ids that would
          truncate in a half-width cell. */}
      <div className="grid gap-4">
        <Field label="Checkout Session" hint="The Stripe session that created this order.">
          <IconInput
            icon={CreditCard}
            wrapperClassName="w-full"
            className="w-full font-mono text-xs"
            value={config.stripeSessionId || ""}
            onChange={(e) => set({ stripeSessionId: e.target.value })}
            placeholder="cs_…"
          />
        </Field>
        <Field label="Payment intent" hint="Fix this if a webhook recorded the wrong reference.">
          <IconInput
            icon={CreditCard}
            wrapperClassName="w-full"
            className="w-full font-mono text-xs"
            value={config.stripePaymentIntentId || ""}
            onChange={(e) => set({ stripePaymentIntentId: e.target.value })}
            placeholder="pi_…"
          />
        </Field>
      </div>

      <div className="mt-5">
        <SettingsList>
          <SettingRow
            title="Refunded to date"
            description="Refunds are issued from the order drawer, so the ledger and timeline stay in step."
            control={
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {currency(record.refundedTotal || 0)}
              </span>
            }
          />
          <SettingRow
            title="Cancelled"
            description="Cancelling releases the buyer's seats and booths back on sale."
            control={
              <span className="text-sm text-foreground">
                {record.cancelledAt ? formatDateTime(record.cancelledAt) : "Not cancelled"}
              </span>
            }
          />
        </SettingsList>
      </div>
    </SectionCard>
  );
}

function NotesSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <Field
        label="Internal note"
        hint="Private to your team — never shown to the buyer or printed on the receipt."
      >
        <Textarea
          rows={4}
          value={config.note || ""}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="e.g. Buyer asked to move two tickets to a colleague."
        />
      </Field>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "buyer",
    label: "Buyer",
    icon: User,
    desc: "Who the order belongs to, and where tickets and receipts land.",
    render: BuyerSection,
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: Ticket,
    desc: "What was bought and what it cost. Changing the total changes reported revenue.",
    render: TicketsSection,
  },
  {
    key: "payment",
    label: "Payment",
    icon: CreditCard,
    desc: "The Stripe references on record, and what's happened to the money since checkout.",
    render: PaymentSection,
  },
  {
    key: "notes",
    label: "Notes",
    icon: StickyNote,
    desc: "Private context for your team, kept off the receipt.",
    render: NotesSection,
  },
];

export function OrderEditScreen({ order, eventName, onBack, onView, onSaved }) {
  const [config, setConfig] = useState(() => ({
    name: order.name || "",
    email: order.email || "",
    ticket: order.ticket || "",
    price: Number(order.price) || 0,
    quantity: Number(order.quantity) || 1,
    total: Number(order.total) || 0,
    stripeSessionId: order.stripeSessionId || "",
    stripePaymentIntentId: order.stripePaymentIntentId || "",
    note: order.note || "",
  }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const email = (config.email || "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    const patch = {
      name: (config.name || "").trim(),
      email,
      ticket: (config.ticket || "").trim() || "General Admission",
      price: Number(config.price) || 0,
      quantity: Math.max(1, Math.round(Number(config.quantity) || 1)),
      total: round2(config.total),
      stripeSessionId: (config.stripeSessionId || "").trim(),
      stripePaymentIntentId: (config.stripePaymentIntentId || "").trim(),
      note: config.note || "",
    };
    setSaving(true);
    const ok = await updateOrder(order.id, patch);
    if (!ok) {
      setSaving(false);
      toast.error("Couldn't save the order.");
      return;
    }
    await addOrderEvent({
      orderId: order.id,
      projectId: order.projectId,
      type: "edited",
      summary: "Order details edited",
    });
    setSaving(false);
    toast.success("Order saved.");
    onSaved?.(order.id, patch);
  };

  return (
    <EditorShell
      back={{ label: "All Orders", onClick: onBack }}
      title={orderRef(order.id)}
      badges={
        <>
          <StatusPill status={order.displayStatus} map={ORDER_STATUS_MAP} />
          <Badge variant="neutral">{currency(order.total)}</Badge>
        </>
      }
      meta={`${order.name || "Unnamed buyer"} · ${eventName || "Unknown event"} · Placed ${formatDateTime(order.createdAt)}`}
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onView}
          >
            <Eye className="h-4 w-4" /> View order
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
      nav={SECTIONS}
      defaultSection={SECTIONS[0].key}
    >
      {({ activeItem }) => {
        const Body = activeItem.render;
        return <Body record={order} config={config} setConfig={setConfig} />;
      }}
    </EditorShell>
  );
}

export default OrderEditScreen;
