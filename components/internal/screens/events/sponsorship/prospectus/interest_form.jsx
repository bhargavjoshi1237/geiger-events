"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { FormFieldsInputs } from "@/components/internal/shared/form_fields_inputs";
import { answersSnapshot, validateFields } from "@/lib/forms/fields";
import { FIXED_ENQUIRY_FIELDS } from "@/lib/events/sponsorship";
import { submitSponsorEnquiry } from "@/lib/supabase/sponsor_enquiries";

const ANY_SPOT = "any";

export function SponsorInterestForm({ event, page, spots, spotId, onSpotChange, buttonStyle }) {
  const fields = [...FIXED_ENQUIRY_FIELDS, ...page.fields];
  const [values, setValues] = useState({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const requestable = spots.filter((s) => s.left > 0);
  const onChange = (id, value) => setValues((v) => ({ ...v, [id]: value }));

  const submit = async () => {
    const problem = validateFields(fields, values);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (page.consent.trim() && !consent) {
      toast.error("Please tick the box to agree before sending.");
      return;
    }
    const spot = requestable.find((s) => s.id === spotId);
    setBusy(true);
    const ok = await submitSponsorEnquiry({
      eventId: event?.id,
      projectId: event?.projectId,
      spotId: spot?.id || null,
      spotName: spot?.name || "",
      company: String(values.company || "").trim(),
      contactName: String(values.contactName || "").trim(),
      email: String(values.email || "").trim(),
      answers: answersSnapshot(page.fields, values),
    });
    setBusy(false);
    if (!ok) {
      toast.error("That didn't send. Please try again in a moment.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface-subtle px-6 py-12 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        <h2 className="text-lg font-semibold text-foreground">Thank you</h2>
        <p className="max-w-sm text-sm text-text-secondary">
          {page.successMessage || "Your interest is with the organiser — they'll be in touch shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle px-6 py-8">
      <h2 className="text-lg font-semibold text-foreground">{page.formHeading || "Register your interest"}</h2>
      {page.formIntro ? <p className="mt-1 text-sm text-text-secondary">{page.formIntro}</p> : null}

      <div className="mt-6 grid gap-4">
        {requestable.length ? (
          <div className="space-y-1.5">
            <label htmlFor="sponsor-spot" className="text-xs text-text-secondary">
              Spot you&apos;re interested in
            </label>
            <Select value={spotId || ANY_SPOT} onValueChange={(v) => onSpotChange(v === ANY_SPOT ? null : v)}>
              <SelectTrigger id="sponsor-spot">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_SPOT}>Not sure yet</SelectItem>
                {requestable.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <FormFieldsInputs fields={fields} values={values} onChange={onChange} idPrefix="sponsor" />

        {page.consent.trim() ? (
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span className="text-xs leading-relaxed text-text-secondary">{page.consent}</span>
          </label>
        ) : null}
      </div>

      <Button disabled={busy} style={buttonStyle} onClick={submit} className="mt-6 w-full hover:opacity-90 sm:w-auto sm:min-w-[12rem]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}

export default SponsorInterestForm;
