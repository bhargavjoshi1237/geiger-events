"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CircleDollarSign,
  Gift,
  ImagePlus,
  Loader2,
  SquarePen,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listSeries } from "@/lib/supabase/series";
import {
  pathFromPublicUrl,
  removeEventImage,
  uploadMembershipImage,
} from "@/lib/supabase/storage";
import {
  ENTITLEMENT_ITEMS,
  entitlementSummary,
  normalizeEntitlements,
} from "@/lib/memberships/entitlements";

import { RecordsScreen } from "../tickets/records_kit";
import { NumField as Num } from "../tickets/controls";
import {
  currency,
  defaultMembershipPlanConfig,
  BILLING_PERIOD_OPTIONS,
} from "../tickets/constants";
import { EntitlementEditor } from "./entitlement_editor";

const KINDS = [
  {
    value: "membership",
    label: "Membership",
    defaultConfig: defaultMembershipPlanConfig,
  },
];

// List-card summary: "$99/yearly · 10% member discount · VOD content, Special access".
function summarize(r) {
  const c = r.config || {};
  const price = Number(c.price) || 0;
  const priceStr =
    price === 0
      ? "Free"
      : `${currency(price)}${c.billingPeriod && c.billingPeriod !== "one-time" ? `/${c.billingPeriod}` : ""}`;
  const disc = Number(c.discountPercent) || 0;
  const parts = [priceStr, disc ? `${disc}% member discount` : "no discount"];
  if (c.applyToAllEvents) parts.push("All Events");
  const ents = normalizeEntitlements(c);
  const attached = ENTITLEMENT_ITEMS.filter((i) => ents[i.key].mode !== "none");
  if (attached.length) parts.push(attached.map((i) => i.label).join(", "));
  return parts.join(" · ");
}

// --- Sections ----------------------------------------------------------------

function PricingSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={config.price ?? 0}
              onChange={(e) => set({ price: Number(e.target.value) || 0 })}
              className="tabular-nums"
              placeholder="0"
            />
          </div>
        </Field>
        <Field label="Billing">
          <Select
            value={config.billingPeriod || "yearly"}
            onValueChange={(v) => set({ billingPeriod: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <Num
          label="Member discount"
          hint="Applied to ticket prices for members."
          value={config.discountPercent ?? 0}
          onChange={(v) => set({ discountPercent: v })}
          unit="%"
        />
        <label className="flex cursor-pointer items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Apply to all events</p>
            <p className="text-xs text-text-secondary">
              On applies it everywhere (rare); off is per-event.
            </p>
          </div>
          <Switch
            checked={!!config.applyToAllEvents}
            onCheckedChange={(v) => set({ applyToAllEvents: v })}
          />
        </label>
      </div>
    </div>
  );
}

function BenefitsSection({ config, setConfig }) {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [series, setSeries] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [openItem, setOpenItem] = useState(ENTITLEMENT_ITEMS[0].key);
  const benefits = Array.isArray(config.benefits) ? config.benefits : [];
  const entitlements = normalizeEntitlements(config);

  // The "selected" scope targets events (and, for rich items, series), so the
  // editor needs both lists.
  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), listSeries(projectId)]).then(([e, s]) => {
      if (!alive) return;
      setEvents(e ?? []);
      setSeries(s ?? []);
      setLoadingEvents(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const setEntitlement = (key) => (next) =>
    setConfig({ ...config, entitlements: { ...entitlements, [key]: next } });

  const active = ENTITLEMENT_ITEMS.find((i) => i.key === openItem) || ENTITLEMENT_ITEMS[0];

  return (
    <div className="space-y-8">
      <Field
        label="Perks"
        hint="One per line — shown on the plan card in the members portal."
      >
        <Textarea
          rows={4}
          value={benefits.join("\n")}
          onChange={(e) =>
            setConfig({
              ...config,
              benefits: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder={"Early access to tickets\nMember-only events\nPriority seating"}
        />
      </Field>

      {/* What's attached — one editor per attachable item type, switched by a
          row of cards so a long plan doesn't become one endless form. */}
      <div className="space-y-5 border-t border-border pt-6">
        <div>
          <p className="text-sm font-medium text-foreground">What&apos;s attached</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            What members can open once they join, and for how long.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {ENTITLEMENT_ITEMS.map((item) => {
            const ent = entitlements[item.key];
            const on = ent.mode !== "none";
            const isOpen = item.key === active.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setOpenItem(item.key)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isOpen
                    ? "border-border-strong bg-surface-card"
                    : "border-border bg-surface-subtle/40 hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      on ? "bg-emerald-400" : "bg-text-tertiary/50",
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-text-secondary">
                  {entitlementSummary(ent)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border pt-5">
          <EntitlementEditor
            key={active.key}
            item={active}
            value={entitlements[active.key]}
            onChange={setEntitlement(active.key)}
            events={events}
            series={series}
            loadingEvents={loadingEvents}
          />
        </div>
      </div>
    </div>
  );
}

function DetailsSection({ config, setConfig }) {
  const { projectId } = useProject();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const poster = config.posterUrl || "";
  const [urlDraft, setUrlDraft] = useState(poster);

  // Keep the link box in sync when the poster changes via upload/remove —
  // same render-time reset pattern as the gallery link dialog.
  const [prevPoster, setPrevPoster] = useState(poster);
  if (poster !== prevPoster) {
    setPrevPoster(poster);
    setUrlDraft(poster);
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    const res = await uploadMembershipImage(projectId, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — please try again.");
      return;
    }
    const old = poster;
    setConfig({ ...config, posterUrl: res.url });
    toast.success("Poster background updated. Save to keep it.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removePoster = () => {
    const path = pathFromPublicUrl(poster);
    setConfig({ ...config, posterUrl: "" });
    toast.success("Poster removed. Save to keep it.");
    if (path) removeEventImage(path);
  };

  // A pasted link is saved as-is and used directly as the poster's src —
  // no upload, no copy. Only previously-uploaded storage files are cleaned
  // up on replace (pathFromPublicUrl returns null for remote URLs).
  const applyUrl = () => {
    const value = urlDraft.trim();
    if (!value) {
      toast.error("Paste an image link first.");
      return;
    }
    if (!/^https?:\/\/.+/i.test(value)) {
      toast.error("Paste a full http(s) link.");
      return;
    }
    if (value === poster) return;
    const old = poster;
    setConfig({ ...config, posterUrl: value });
    toast.success("Poster background updated. Save to keep it.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  return (
    <div className="space-y-6">
      <Field
        label="Poster background"
        hint="Upload an image or paste an image link — shown on the plan card in the members portal. 16:9 works best."
      >
        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          {poster ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster}
                  alt="Membership plan poster"
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={removePoster}
                  className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <ImagePlus className="h-7 w-7" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {busy ? "Uploading…" : "Click to upload a poster background"}
              </span>
              <span className="text-xs">16:9 · images optimized automatically</span>
            </button>
          )}
          <div className="flex gap-2">
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrl();
                }
              }}
              placeholder="…or paste an image link (https://…)"
              inputMode="url"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={applyUrl}
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              Use link
            </Button>
          </div>
        </div>
      </Field>
      <Field label="Summary" hint="Shown to prospective members.">
        <Textarea
          rows={3}
          value={config.description || ""}
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
          placeholder="e.g. Annual membership with perks across every event."
        />
      </Field>
    </div>
  );
}

const SECTIONS = [
  {
    key: "pricing",
    label: "Pricing",
    icon: CircleDollarSign,
    desc: "What members pay, how often, and the discount they get on tickets.",
    render: PricingSection,
  },
  {
    key: "benefits",
    label: "Benefits",
    icon: Gift,
    desc: "The perks members see, and the content this plan unlocks for them.",
    render: BenefitsSection,
  },
  {
    key: "details",
    label: "Details",
    icon: SquarePen,
    desc: "How this plan describes itself to prospective members.",
    render: DetailsSection,
  },
];

export function MembershipPlansScreen() {
  return (
    <RecordsScreen
      module="membership"
      title="Membership Plans"
      description="Reusable membership tiers. Create a plan here, then attach it to events for special pricing and access."
      singular="plan"
      icon={BadgeCheck}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default MembershipPlansScreen;
