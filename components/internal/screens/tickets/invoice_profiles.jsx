"use client";

import React from "react";
import { FileText, Receipt } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it.

function InvoicesSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
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
  );
}

function ReceiptsSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
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
  );
}

const SECTIONS = [
  {
    key: "invoices",
    label: "Invoices",
    icon: FileText,
    desc: "Generated for buyers who need one for expenses.",
    render: InvoicesSection,
  },
  {
    key: "receipts",
    label: "Receipts",
    icon: Receipt,
    desc: "What prints at the bottom of every receipt.",
    render: ReceiptsSection,
  },
];

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
      sections={SECTIONS}
    />
  );
}

export default InvoiceProfilesScreen;
