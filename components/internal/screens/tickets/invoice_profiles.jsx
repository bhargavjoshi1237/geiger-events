"use client";

import React from "react";
import { FileText } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecordsScreen } from "./records_kit";
import { Segmented } from "./controls";

const KINDS = [
  {
    value: "profile",
    label: "Invoice profile",
    defaultConfig: {
      generation: "manual",
      businessId: "",
      prefix: "INV",
      receiptFooter: "",
    },
  },
];

function summarize(r) {
  const c = r.config || {};
  return `${c.generation === "auto" ? "Auto" : "Manual"} · prefix ${c.prefix || "INV"}`;
}

function InvoiceEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  return (
    <div className="space-y-4">
      <SectionCard
        title="Invoices"
        description="Generated for buyers who need one for expenses."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Generation"
            hint="Issue automatically, or only on request."
          >
            <Segmented
              value={config.generation || "manual"}
              onChange={(v) => set({ generation: v })}
              options={[
                { value: "manual", label: "Manual" },
                { value: "auto", label: "Automatic" },
              ]}
            />
          </Field>
          <Field label="Invoice prefix" hint="Leads the invoice number.">
            <Input
              value={config.prefix || ""}
              onChange={(e) => set({ prefix: e.target.value })}
              placeholder="INV"
              className="max-w-[8rem] uppercase"
            />
          </Field>
          <Field
            label="Business / VAT ID"
            hint="Printed on every invoice."
            className="sm:col-span-2"
          >
            <Input
              value={config.businessId || ""}
              onChange={(e) => set({ businessId: e.target.value })}
              placeholder="e.g. GB123456789"
              className="max-w-sm"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Receipts">
        <Field
          label="Receipt footer"
          hint="Shown at the bottom of every receipt."
        >
          <Textarea
            rows={3}
            value={config.receiptFooter || ""}
            onChange={(e) => set({ receiptFooter: e.target.value })}
            placeholder="Thanks for your order! Questions? support@yourorg.com"
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function InvoiceProfilesScreen() {
  return (
    <RecordsScreen
      module="invoice_profile"
      title="Invoices & Receipts"
      description="Reusable invoice and receipt profiles. Attach one to an event to control its tax documents."
      singular="invoice profile"
      icon={FileText}
      kinds={KINDS}
      summarize={summarize}
      EditForm={InvoiceEditForm}
    />
  );
}

export default InvoiceProfilesScreen;
