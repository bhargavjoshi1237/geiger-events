"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Gem,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import {
  EMPTY_PACKAGES,
  INCLUSION_ICONS,
  PACKAGE_MODES,
  newInclusion,
  newPackage,
  normalizePackage,
  normalizePackages,
  packageSoldOut,
} from "@/lib/events/packages";
import { InclusionIcon, PackagePrice } from "./packages_shared";

// Authoring for an event's VIP packages.
//
// A package carries more fields than a list row can hold legibly, so editing
// happens in a dialog and the section itself stays a scannable ladder of tiers —
// which is also the order buyers see them in.

function InclusionRows({ items, onChange }) {
  const patch = (id, key, value) =>
    onChange(items.map((i) => (i.id === id ? { ...i, [key]: value } : i)));

  const move = (index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((inc, index) => (
        <div key={inc.id} className="flex items-center gap-2">
          <Select
            value={inc.icon}
            onValueChange={(v) => patch(inc.id, "icon", v)}
          >
            <SelectTrigger className="w-[8.5rem] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCLUSION_ICONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  <span className="flex items-center gap-2">
                    <InclusionIcon icon={opt.key} className="h-3.5 w-3.5" />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={inc.text}
            onChange={(e) => patch(inc.id, "text", e.target.value)}
            placeholder="Official ticket to the event"
            className="min-w-0 flex-1"
          />

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="p-1 text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
              className="p-1 text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => onChange(items.filter((i) => i.id !== inc.id))}
              className="p-1 text-text-tertiary transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...items, newInclusion()])}
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Add inclusion
      </Button>
    </div>
  );
}

function PackageDialog({ open, onOpenChange, eventId, initial, onSave }) {
  const [draft, setDraft] = useState(newPackage());
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  // Re-seed whenever the dialog opens (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial ? normalizePackage(initial) : newPackage());
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    const res = await uploadEventImage(eventId, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    const old = draft.image;
    set("image")(res.url);
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the package a name first.");
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit package" : "Add package"}</DialogTitle>
          <DialogDescription>
            A tier buyers can purchase from your packages page.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />

        <div className="grid gap-4">
          <Field label="Cover image">
            <div className="flex items-center gap-4">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-card">
                {draft.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                    <Gem className="h-5 w-5" />
                  </div>
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
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  {draft.image ? "Replace" : "Upload"}
                </Button>
                {draft.image ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const path = pathFromPublicUrl(draft.image);
                      set("image")("");
                      if (path) removeEventImage(path);
                    }}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="pkg-name">
              <Input
                id="pkg-name"
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Champion"
              />
            </Field>
            <Field label="Tagline" htmlFor="pkg-tagline">
              <Input
                id="pkg-tagline"
                value={draft.tagline}
                onChange={(e) => set("tagline")(e.target.value)}
                placeholder="Ticket + Hospitality"
              />
            </Field>
          </div>

          <Field
            label="What's included"
            hint="One line per thing they get. The icon sits to its left on the card."
          >
            <InclusionRows
              items={draft.inclusions}
              onChange={set("inclusions")}
            />
          </Field>

          <Field
            label="More details"
            hint="Shown behind the card's “More details” expander. Every line becomes a paragraph."
            htmlFor="pkg-details"
          >
            <Textarea
              id="pkg-details"
              rows={4}
              value={draft.details}
              onChange={(e) => set("details")(e.target.value)}
              placeholder="Arrival times, dress code, what isn't included…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price" htmlFor="pkg-price">
              <Input
                id="pkg-price"
                type="number"
                min="0"
                value={draft.price}
                onChange={(e) => set("price")(Number(e.target.value) || 0)}
              />
            </Field>
            <Field
              label="Price suffix"
              hint="Shown after the amount"
              htmlFor="pkg-suffix"
            >
              <Input
                id="pkg-suffix"
                value={draft.priceSuffix}
                onChange={(e) => set("priceSuffix")(e.target.value)}
                placeholder="/pp"
              />
            </Field>
            <Field
              label="Stock"
              hint="Blank is unlimited"
              htmlFor="pkg-stock"
            >
              <Input
                id="pkg-stock"
                type="number"
                min="0"
                value={draft.stock ?? ""}
                onChange={(e) =>
                  set("stock")(e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="Unlimited"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How it's bought">
              <Select value={draft.mode} onValueChange={set("mode")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_MODES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label} — {m.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Button label"
              hint="Blank uses “Buy package” or “Enquire”"
              htmlFor="pkg-cta"
            >
              <Input
                id="pkg-cta"
                value={draft.ctaLabel}
                onChange={(e) => set("ctaLabel")(e.target.value)}
                placeholder="Buy VIP package"
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {initial ? "Save package" : "Add package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EventPackagesSection({ event, headerItem }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(
    event,
    "packages",
    EMPTY_PACKAGES,
  );
  const data = normalizePackages(cfg);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const editing = data.items.find((p) => p.id === editingId) || null;

  const setItems = (items) => setCfg({ ...data, items });

  const move = (index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= data.items.length) return;
    const next = [...data.items];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
  };

  const onSave = (pkg) => {
    setItems(
      editingId
        ? data.items.map((p) => (p.id === editingId ? { ...pkg, id: editingId } : p))
        : [...data.items, pkg],
    );
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Packages"}
        description={
          headerItem?.desc ||
          "Premium bundles sold from this event's own packages page — not from its live page."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => saveCfg(undefined, { successMsg: "Packages saved." })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save packages"}
          </Button>
        }
      />

      <SectionCard
        title="Intro"
        description="A short line above the packages, on the packages page."
      >
        <Textarea
          rows={2}
          value={data.intro}
          onChange={(e) => setCfg({ ...data, intro: e.target.value })}
          placeholder="VIP Experience packages can include premium seating, hospitality and more."
        />
      </SectionCard>

      <SectionCard
        title="Tiers"
        description="Shown in this order, left to right. Buyers compare them side by side, so keep the inclusions in a consistent order across tiers."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setDialogOpen(true);
            }}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add package
          </Button>
        }
      >
        {data.items.length ? (
          <div className="space-y-2">
            {data.items.map((pkg, index) => (
              <div
                key={pkg.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-surface-card p-3",
                  !pkg.visible && "opacity-60",
                )}
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-subtle">
                  {pkg.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pkg.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <Gem className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {pkg.name || "Untitled package"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {[
                      pkg.tagline,
                      `${pkg.inclusions.filter((i) => i.text.trim()).length} inclusions`,
                      packageSoldOut(pkg)
                        ? "Sold out"
                        : pkg.stock === null
                          ? null
                          : `${pkg.stock} left`,
                      pkg.mode === "enquire" ? "Enquiry only" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <PackagePrice pkg={pkg} className="shrink-0 text-sm" />

                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="p-1 text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === data.items.length - 1}
                    onClick={() => move(index, 1)}
                    className="p-1 text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Edit package"
                    onClick={() => {
                      setEditingId(pkg.id);
                      setDialogOpen(true);
                    }}
                    className="p-1 text-text-tertiary transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove package"
                    onClick={() =>
                      setItems(data.items.filter((p) => p.id !== pkg.id))
                    }
                    className="p-1 text-text-tertiary transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Gem}
            title="No packages yet"
            description="Add a tier — a name, what's included, and a price. Three tiers is the usual shape: good, better, best."
          />
        )}
      </SectionCard>

      <PackageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={event?.id}
        initial={editing}
        onSave={onSave}
      />
    </div>
  );
}

export default EventPackagesSection;
