"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { submitPackageEnquiry } from "@/lib/supabase/package_enquiries";

// The "talk to us first" route. Packages set to "Collect enquiries" have no
// other way to convert, so a failed submit has to say so rather than clearing
// the form and looking like it worked.

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  quantity: "",
  message: "",
};

export function PackagesLeadForm({
  event,
  page,
  packages,
  selected,
  onSelected,
  primaryBtnStyle,
  live = false,
}) {
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const needsConsent = Boolean(page.leadsConsent.trim());

  const submit = async () => {
    if (!form.firstName.trim() || !form.email.trim()) {
      toast.error("Your name and email are needed so we can reply.");
      return;
    }
    if (needsConsent && !consent) {
      toast.error("Please accept the terms before submitting.");
      return;
    }
    // In the editor's preview nothing should reach the database.
    if (!live) {
      toast.success("Looks right — this is a preview, so nothing was sent.");
      return;
    }

    setBusy(true);
    const ok = await submitPackageEnquiry({
      eventId: event?.id,
      projectId: event?.projectId,
      packageId: selected?.id || null,
      packageName: selected?.name || "",
      recipient: page.leadsRecipient || "",
      ...form,
      quantity: Number(form.quantity) || null,
    });
    setBusy(false);

    if (!ok) {
      toast.error("That didn't send. Please try again in a moment.");
      return;
    }
    setSent(true);
    setForm(EMPTY);
    setConsent(false);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface-subtle px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">Thank you</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Your enquiry is with us — we&apos;ll be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle px-6 py-8">
      <h2 className="mb-6 text-center text-lg font-semibold text-foreground">
        {page.leadsHeading || `Learn more about ${event?.name || "our packages"}`}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-text-secondary">First name</span>
          <Input value={form.firstName} onChange={set("firstName")} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-text-secondary">Last name</span>
          <Input value={form.lastName} onChange={set("lastName")} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-text-secondary">Email</span>
          <Input type="email" value={form.email} onChange={set("email")} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-text-secondary">Phone</span>
          <Input type="tel" value={form.phone} onChange={set("phone")} />
        </label>

        {packages.length ? (
          <label className="space-y-1.5">
            <span className="text-xs text-text-secondary">Package</span>
            <Select
              value={selected?.id || ""}
              onValueChange={(id) =>
                onSelected(packages.find((p) => p.id === id) || null)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any package" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <label className="space-y-1.5">
          <span className="text-xs text-text-secondary">Number of tickets</span>
          <Input
            type="number"
            min="0"
            value={form.quantity}
            onChange={set("quantity")}
            placeholder="0"
          />
        </label>

        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs text-text-secondary">Message</span>
          <Textarea rows={3} value={form.message} onChange={set("message")} />
        </label>
      </div>

      {needsConsent ? (
        <label className="mt-5 flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(Boolean(v))}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed text-text-secondary">
            {page.leadsConsent}
          </span>
        </label>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button
          disabled={busy}
          style={primaryBtnStyle}
          onClick={submit}
          className={cn("min-w-[12rem] hover:opacity-90")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Sending…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}

export default PackagesLeadForm;
