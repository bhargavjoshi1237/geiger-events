"use client";

import { useState } from "react";
import { CreditCard, Mail, Tag } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";

// Per-event Stripe payment settings. Stored under metadata.payments (like
// tickets/offerings) via useEventConfig. The public checkout
// (event_public_page.jsx → /api/checkout) reads `enabled`/`currency` before
// creating a Stripe Checkout Session for a priced ticket; free ($0) tickets
// never touch Stripe and always go straight through the existing buy_ticket
// RPC regardless of this setting.
//
//   payments = {
//     enabled: bool,               // accept card payments for this event
//     currency: "usd" | "eur" | "gbp",
//     statementDescriptor: string, // shown on the buyer's card statement (<=22 chars)
//     supportEmail: string,        // shown on the Stripe receipt / for disputes
//   }

const DEFAULT_PAYMENTS = {
  enabled: true,
  currency: "usd",
  statementDescriptor: "",
  supportEmail: "",
};

const CURRENCIES = [
  { value: "usd", label: "USD — US Dollar" },
  { value: "eur", label: "EUR — Euro" },
  { value: "gbp", label: "GBP — British Pound" },
];

export function PaymentsSection({ event, headerItem }) {
  const [payments, setPayments, savePayments, saving] = useEventConfig(
    event,
    "payments",
    DEFAULT_PAYMENTS,
  );
  const [descTouched, setDescTouched] = useState(false);
  const setField = (key) => (value) =>
    setPayments({ ...payments, [key]: value });

  const descriptor = payments.statementDescriptor || "";
  const descriptorTooLong = descriptor.length > 22;

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Payments"}
        description={
          headerItem?.desc ||
          "Configure how buyers pay for tickets to this event."
        }
      />

      <SectionCard title="Stripe checkout">
        <SettingsList>
          <SettingRow
            icon={CreditCard}
            title="Accept online payments"
            description="Buyers of paid tickets are redirected to Stripe Checkout. Free tickets never require this."
            checked={payments.enabled}
            onCheckedChange={setField("enabled")}
          />
        </SettingsList>

        {payments.enabled ? (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Currency">
              <Select
                value={payments.currency || "usd"}
                onValueChange={setField("currency")}
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
            <Field
              label="Support email"
              hint="Shown on receipts if a buyer needs help."
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  type="email"
                  className="pl-9"
                  value={payments.supportEmail || ""}
                  onChange={(e) => setField("supportEmail")(e.target.value)}
                  placeholder="support@yourorg.com"
                />
              </div>
            </Field>
            <Field
              label="Statement descriptor"
              hint="Up to 22 characters, shown on the buyer's card statement."
              className="sm:col-span-2"
            >
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  className="max-w-xs pl-9"
                  maxLength={22}
                  value={descriptor}
                  onChange={(e) => {
                    setDescTouched(true);
                    setField("statementDescriptor")(e.target.value);
                  }}
                  placeholder={event?.name?.slice(0, 22) || "Your event name"}
                />
              </div>
              {descTouched && descriptorTooLong ? (
                <p className="mt-1 text-xs text-red-400">
                  Keep it to 22 characters or fewer.
                </p>
              ) : null}
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving || descriptorTooLong}
          onClick={() =>
            savePayments(payments, { successMsg: "Payment settings saved." })
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default PaymentsSection;
