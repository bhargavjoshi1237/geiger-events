"use client";

import React, { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import { FreshLink, ShareLinkForm } from "./share_links";

// New share link from the Collaboration screen: pick the plan, then the same form as the editor's Share dialog.

const KIND_SUFFIX = { template: " · template", library: " · venue diagram" };

export function NewLinkDialog({ open, onOpenChange, plans, placeOf, onCreate }) {
  const [planId, setPlanId] = useState("");
  const [fresh, setFresh] = useState(null);
  const chosen = planId || plans[0]?.id || "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setFresh(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New share link</DialogTitle>
          <DialogDescription>
            Guests open the plan in a browser, in 2D and 3D — no account needed. Comment links let them pin feedback.
          </DialogDescription>
        </DialogHeader>
        {plans.length ? (
          <div className="grid gap-4">
            <Field label="Plan">
              <Select value={chosen} onValueChange={setPlanId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || "Untitled plan"}
                      {KIND_SUFFIX[p.kind] || ""}
                      {placeOf(p) ? ` — ${placeOf(p)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ShareLinkForm
              compact
              onCreate={async (input) => {
                const res = await onCreate(chosen, input);
                if (res) setFresh({ url: res.url, copied: res.copied });
                return Boolean(res);
              }}
            />
            <FreshLink link={fresh} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Draw a floor plan first — then you can share it from here or from the editor.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NewLinkDialog;
