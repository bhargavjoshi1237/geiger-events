"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { ChipsInput } from "@/components/internal/shared/records/record_fields";
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
import { newSpot } from "@/lib/events/sponsorship";
import { OptionSelect } from "../theme_controls";
import { TIER_VALUES } from "../../conference/modules/shared";

const NO_TIER = "none";
const TIER_OPTIONS = [
  { key: NO_TIER, label: "No tier" },
  ...TIER_VALUES.map((t) => ({ key: t, label: t })),
];

// Create or edit a spot; `minQuantity` stops the quantity dropping below the fills it already holds.
export function SpotDialog({ open, onOpenChange, initial, minQuantity = 1, onSave }) {
  const [draft, setDraft] = useState(() => initial || newSpot());
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial || newSpot());
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the spot a name first.");
      return;
    }
    const quantity = Math.max(1, Math.round(Number(draft.quantity)) || 1);
    if (quantity < minQuantity) {
      toast.error(`This spot already holds ${minQuantity} sponsors — remove one before lowering the quantity.`);
      return;
    }
    const price = Number(draft.price);
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      quantity,
      price: Number.isFinite(price) && price > 0 ? price : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit spot" : "Add spot"}</DialogTitle>
          <DialogDescription>
            Something a sponsor can take at this event — a tier, a naming right, a placement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Name" htmlFor="spot-name">
            <Input
              id="spot-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Title sponsor, Lanyard sponsor, Gold"
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tier">
              <OptionSelect
                value={draft.tier || NO_TIER}
                onChange={(v) => set("tier")(v === NO_TIER ? "" : v)}
                options={TIER_OPTIONS}
              />
            </Field>
            <Field label="Price" hint="Empty = on request" htmlFor="spot-price">
              <Input
                id="spot-price"
                type="number"
                min="0"
                value={draft.price ?? ""}
                onChange={(e) => set("price")(e.target.value)}
                placeholder="On request"
              />
            </Field>
            <Field label="Sponsors" hint="How many can take it" htmlFor="spot-qty">
              <Input
                id="spot-qty"
                type="number"
                min={minQuantity}
                value={draft.quantity}
                onChange={(e) => set("quantity")(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" hint="Optional" htmlFor="spot-desc">
            <Textarea
              id="spot-desc"
              rows={3}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What this spot is and why it's worth it."
            />
          </Field>

          <Field label="What's included" hint="Shown as a checklist on the sponsorship page">
            <ChipsInput
              value={draft.benefits}
              onChange={set("benefits")}
              placeholder="e.g. Logo on the main stage — press Enter"
            />
          </Field>

          <SettingsList>
            <SettingRow
              title="Open to requests"
              description="List this spot on the sponsorship page so prospects can ask for it. Turn off for spots you fill privately."
              checked={draft.open}
              onCheckedChange={set("open")}
            />
          </SettingsList>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={submit}>
            {initial ? "Save spot" : "Add spot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SpotDialog;
