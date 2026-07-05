"use client";

import React from "react";
import { CreditCard } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordsScreen } from "./records_kit";

const KINDS = [
  {
    value: "stripe",
    label: "Stripe",
    defaultConfig: { currency: "usd", statementDescriptor: "", supportEmail: "" },
  },
  { value: "paypal", label: "PayPal", defaultConfig: { email: "" } },
  {
    value: "bank",
    label: "Bank transfer",
    defaultConfig: { accountName: "", accountNumber: "", reference: "" },
  },
];

const CURRENCIES = [
  { value: "usd", label: "USD — US Dollar" },
  { value: "eur", label: "EUR — Euro" },
  { value: "gbp", label: "GBP — British Pound" },
  { value: "cad", label: "CAD — Canadian Dollar" },
  { value: "aud", label: "AUD — Australian Dollar" },
];

function summarize(r) {
  const c = r.config || {};
  if (r.kind === "stripe") return `Stripe · ${(c.currency || "usd").toUpperCase()}`;
  if (r.kind === "paypal") return `PayPal · ${c.email || "no email"}`;
  if (r.kind === "bank") return `Bank · ${c.accountName || "no account"}`;
  return "";
}

function MethodEditForm({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  if (record.kind === "stripe") {
    return (
      <SectionCard title="Stripe checkout" description="Card payments via Stripe.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <Select
              value={config.currency || "usd"}
              onValueChange={(v) => set({ currency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Support email" hint="Shown on receipts.">
            <Input
              type="email"
              value={config.supportEmail || ""}
              onChange={(e) => set({ supportEmail: e.target.value })}
              placeholder="support@yourorg.com"
            />
          </Field>
          <Field
            label="Statement descriptor"
            hint="Up to 22 characters, shown on the buyer's card statement."
            className="sm:col-span-2"
          >
            <Input
              maxLength={22}
              value={config.statementDescriptor || ""}
              onChange={(e) => set({ statementDescriptor: e.target.value })}
              placeholder="YOUR EVENT"
              className="max-w-xs"
            />
          </Field>
        </div>
      </SectionCard>
    );
  }

  if (record.kind === "paypal") {
    return (
      <SectionCard title="PayPal" description="Where PayPal payments are received.">
        <Field label="PayPal email">
          <Input
            type="email"
            value={config.email || ""}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="payments@yourorg.com"
            className="max-w-sm"
          />
        </Field>
      </SectionCard>
    );
  }

  // bank
  return (
    <SectionCard
      title="Bank transfer"
      description="Details buyers use to pay by transfer."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name">
          <Input
            value={config.accountName || ""}
            onChange={(e) => set({ accountName: e.target.value })}
            placeholder="Your Org Ltd"
          />
        </Field>
        <Field label="Account number / IBAN">
          <Input
            value={config.accountNumber || ""}
            onChange={(e) => set({ accountNumber: e.target.value })}
            placeholder="GB00 0000 0000 0000"
          />
        </Field>
        <Field label="Payment reference" hint="What buyers put as the reference.">
          <Input
            value={config.reference || ""}
            onChange={(e) => set({ reference: e.target.value })}
            placeholder="Order number"
          />
        </Field>
      </div>
    </SectionCard>
  );
}

export function PaymentMethodsScreen() {
  return (
    <RecordsScreen
      module="payment_method"
      title="Payments & Methods"
      description="Reusable ways buyers can pay. Create a method here, then attach it to any event."
      singular="method"
      icon={CreditCard}
      kinds={KINDS}
      summarize={summarize}
      EditForm={MethodEditForm}
    />
  );
}

export default PaymentMethodsScreen;
