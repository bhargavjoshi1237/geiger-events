"use client";

import { useState } from "react";
import { CreditCard, Mail, Tag, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { IconInput } from "@/components/internal/shared/icon_input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";

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
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving || descriptorTooLong}
            onClick={() =>
              savePayments(payments, { successMsg: "Payment settings saved." })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
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
              <IconInput
                icon={Mail}
                type="email"
                value={payments.supportEmail || ""}
                onChange={(e) => setField("supportEmail")(e.target.value)}
                placeholder="support@yourorg.com"
              />
            </Field>
            <Field
              label="Statement descriptor"
              hint="Up to 22 characters, shown on the buyer's card statement."
              className="sm:col-span-2"
            >
              <IconInput
                icon={Tag}
                wrapperClassName="max-w-xs"
                className="w-full"
                maxLength={22}
                value={descriptor}
                onChange={(e) => {
                  setDescTouched(true);
                  setField("statementDescriptor")(e.target.value);
                }}
                placeholder={event?.name?.slice(0, 22) || "Your event name"}
              />
              {descTouched && descriptorTooLong ? (
                <p className="mt-1 text-xs text-red-400">
                  Keep it to 22 characters or fewer.
                </p>
              ) : null}
            </Field>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export default PaymentsSection;
