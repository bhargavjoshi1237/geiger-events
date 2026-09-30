"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Trash2, UploadCloud, UserPlus } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { conferenceApi } from "@/lib/supabase/conference";
import { uploadConferenceImage } from "@/lib/supabase/storage";
import { getUser } from "@/lib/supabase/user";
import {
  FILL_STATUSES,
  newFill,
  spotCounts,
  sponsorSnapshot,
} from "@/lib/events/sponsorship";
import { OptionSelect, Segmented, withIcons } from "../theme_controls";

const MODES = withIcons(
  [
    { key: "existing", label: "Existing sponsor" },
    { key: "new", label: "New sponsor" },
  ],
  { existing: Building2, new: UserPlus },
);

const EMPTY_NEW = { name: "", website: "", contactName: "", contactEmail: "" };

// Pre-select a sponsor record whose name matches the enquiry's company, so converting a returning sponsor doesn't duplicate them.
function initialState({ initial, prefill, records }) {
  if (initial) {
    return { mode: "existing", sponsorId: initial.sponsorId, fresh: EMPTY_NEW };
  }
  const company = String(prefill?.company || "").trim().toLowerCase();
  const match = company && (records || []).find((r) => r.name.trim().toLowerCase() === company);
  if (match) return { mode: "existing", sponsorId: match.id, fresh: EMPTY_NEW };
  const fresh = prefill
    ? { ...EMPTY_NEW, name: prefill.company || "", contactName: prefill.contactName || "", contactEmail: prefill.email || "" }
    : EMPTY_NEW;
  return { mode: prefill || !records?.length ? "new" : "existing", sponsorId: null, fresh };
}

async function createSponsor({ projectId, fresh, amount, logoFile }) {
  const user = await getUser();
  const created = await conferenceApi.create({
    id: crypto.randomUUID(),
    projectId,
    module: "sponsor",
    name: fresh.name.trim(),
    status: "Active",
    createdBy: user?.id || null,
    config: {
      amount,
      contactName: fresh.contactName.trim(),
      contactEmail: fresh.contactEmail.trim(),
      website: fresh.website.trim(),
      description: "",
      benefits: [],
    },
  });
  if (!created || !logoFile) return created;
  // Storage lets only the record's creator write, so the logo goes up after the row exists.
  const upload = await uploadConferenceImage(created.id, logoFile);
  if (!upload?.url) {
    toast.error("Sponsor added, but the logo didn't upload — add it from the Sponsors screen.");
    return created;
  }
  return (await conferenceApi.update(created.id, { coverUrl: upload.url })) || created;
}

export function FillDialog({
  open,
  onOpenChange,
  spots,
  spotId: initialSpotId,
  initial,
  prefill,
  records,
  projectId,
  onRecordCreated,
  onSave,
}) {
  const [spotId, setSpotId] = useState(initialSpotId || "");
  const [mode, setMode] = useState("existing");
  const [sponsorId, setSponsorId] = useState(null);
  const [fresh, setFresh] = useState(EMPTY_NEW);
  const [logoFile, setLogoFile] = useState(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const start = initialState({ initial, prefill, records });
      setSpotId(initialSpotId || "");
      setMode(start.mode);
      setSponsorId(start.sponsorId);
      setFresh(start.fresh);
      setLogoFile(null);
      setAmount(initial ? String(initial.amount || "") : "");
      setStatus(initial?.status || "confirmed");
      setNote(initial?.note || "");
    }
  }

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

  // A full spot is only offered back to the fill that already sits in it.
  const spotOptions = useMemo(
    () =>
      spots
        .filter((s) => spotCounts(s).left > 0 || (initial && s.id === initialSpotId))
        .map((s) => ({ key: s.id, label: `${s.name || "Untitled spot"} · ${spotCounts(s).left} left` })),
    [spots, initial, initialSpotId],
  );
  const recordOptions = useMemo(
    () =>
      [...(records || [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ key: r.id, label: r.name })),
    [records],
  );

  const setFreshKey = (key) => (e) => setFresh((f) => ({ ...f, [key]: e.target.value }));

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setLogoFile(file);
  };

  const submit = async () => {
    if (!spotOptions.some((o) => o.key === spotId)) {
      toast.error("Choose which spot this sponsor takes.");
      return;
    }
    let record = (records || []).find((r) => r.id === sponsorId);
    if (mode === "existing" && !record) {
      toast.error("Pick a sponsor, or switch to adding a new one.");
      return;
    }
    if (mode === "new" && !fresh.name.trim()) {
      toast.error("Give the new sponsor a company name.");
      return;
    }

    setBusy(true);
    try {
      const value = Math.max(0, Number(amount) || 0);
      if (mode === "new") {
        record = await createSponsor({ projectId, fresh, amount: value, logoFile });
        if (!record) {
          toast.error("Couldn't create the sponsor. Check your connection and try again.");
          return;
        }
        onRecordCreated?.(record);
      }

      const fill = {
        ...(initial || newFill()),
        sponsorId: record.id,
        amount: value,
        status,
        note: note.trim(),
        enquiryId: initial?.enquiryId || prefill?.enquiryId || null,
        sponsor: sponsorSnapshot(record),
      };
      const ok = await onSave({ spotId, fill });
      if (ok !== false) onOpenChange(false);
    } catch (error) {
      console.error("[sponsorship.fill]", error);
      toast.error("Couldn't save the sponsor. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit sponsor in spot" : "Fill spot"}</DialogTitle>
          <DialogDescription>
            Record a deal you&apos;ve agreed. Confirmed sponsors appear on the event page.
          </DialogDescription>
        </DialogHeader>

        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />

        <div className="grid gap-4">
          <Field label="Spot">
            {spotOptions.length ? (
              <OptionSelect value={spotId} onChange={setSpotId} options={spotOptions} placeholder="Choose a spot" />
            ) : (
              <p className="text-sm text-text-secondary">Every spot is full. Add a spot or raise a spot&apos;s quantity first.</p>
            )}
          </Field>

          {recordOptions.length ? <Segmented value={mode} onChange={setMode} options={MODES} /> : null}

          {mode === "existing" ? (
            <Field label="Sponsor" hint="From your project's Sponsors">
              <OptionSelect value={sponsorId} onChange={setSponsorId} options={recordOptions} placeholder="Choose a sponsor" />
            </Field>
          ) : (
            <div className="grid gap-4 rounded-xl border border-border bg-surface-card p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-subtle">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Building2 className="h-5 w-5 text-text-tertiary" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <UploadCloud className="h-4 w-4" /> {logoFile ? "Replace logo" : "Upload logo"}
                  </Button>
                  {logoFile ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setLogoFile(null)}
                      className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <Field label="Company name" htmlFor="fill-company">
                <Input id="fill-company" value={fresh.name} onChange={setFreshKey("name")} placeholder="Northwind Labs" />
              </Field>
              <Field label="Website" hint="Optional" htmlFor="fill-website">
                <Input id="fill-website" value={fresh.website} onChange={setFreshKey("website")} placeholder="https://…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" hint="Optional" htmlFor="fill-contact">
                  <Input id="fill-contact" value={fresh.contactName} onChange={setFreshKey("contactName")} />
                </Field>
                <Field label="Contact email" hint="Optional" htmlFor="fill-email">
                  <Input id="fill-email" type="email" value={fresh.contactEmail} onChange={setFreshKey("contactEmail")} />
                </Field>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agreed amount" htmlFor="fill-amount">
              <Input
                id="fill-amount"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 15000"
              />
            </Field>
            <Field label="Status">
              <Segmented value={status} onChange={setStatus} options={FILL_STATUSES} />
            </Field>
          </div>

          <Field label="Note" hint="Optional — only your team sees this" htmlFor="fill-note">
            <Textarea
              id="fill-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Invoice sent 12 Oct, logo due by 1 Nov"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !spotOptions.length}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Save" : "Fill spot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FillDialog;
