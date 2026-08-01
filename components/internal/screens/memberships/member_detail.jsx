"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CircleUser,
  Gift,
  Loader2,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  ENTITLEMENT_ITEMS,
  durationLabel,
  entitlementExpiry,
  entitlementSummary,
  normalizeEntitlements,
  optionSummary,
} from "@/lib/memberships/entitlements";
import { formatDate, MEMBER_STATUS_MAP } from "../tickets/constants";

// The per-member editor: content left, section nav right, matching the event
// editor and the plan editor. Profile and Membership are editable; Access is a
// read-only projection of the member's plan entitlements onto their join date.

const STATUSES = ["Active", "Expired", "Cancelled"];

function ProfileSection({ draft, set }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <Input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Jane Doe"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={draft.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="jane@example.com"
        />
      </Field>
    </div>
  );
}

function MembershipSection({ draft, set, plans }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">
          <Select
            value={draft.membershipId || ""}
            onValueChange={(v) => set({ membershipId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a plan…" />
            </SelectTrigger>
            <SelectContent>
              {plans.length ? (
                plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No plans yet
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={draft.status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Member since" hint="Set when the membership was created.">
          <p className="pt-1.5 text-sm text-text-secondary">
            {formatDate(draft.startedAt)}
          </p>
        </Field>
        <Field label="Expires" hint="Leave empty for a lifetime membership.">
          <Input
            type="date"
            value={(draft.expiresAt || "").slice(0, 10)}
            onChange={(e) =>
              set({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
        </Field>
      </div>
    </div>
  );
}

// What this member's plan actually unlocks, resolved against their join date.
function AccessSection({ draft, plans }) {
  const plan = plans.find((p) => p.id === draft.membershipId) || null;
  if (!plan) {
    return (
      <p className="text-sm text-text-secondary">
        This member isn&apos;t on a plan yet — pick one under Membership.
      </p>
    );
  }

  const entitlements = normalizeEntitlements(plan.config);
  const attached = ENTITLEMENT_ITEMS.filter((i) => entitlements[i.key].mode !== "none");

  if (!attached.length) {
    return (
      <p className="text-sm text-text-secondary">
        <span className="font-medium text-foreground">{plan.name}</span> doesn&apos;t
        attach anything yet. Add it under Membership Plans → Benefits.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        Granted by <span className="font-medium text-foreground">{plan.name}</span>.
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {attached.map((item) => {
          const ent = entitlements[item.key];
          const expiry = entitlementExpiry(draft.startedAt, ent.duration);
          const extras = optionSummary(item, ent);
          return (
            <div key={item.key} className="space-y-1.5 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-text-secondary">
                  {expiry ? `Until ${formatDate(expiry)}` : durationLabel(ent.duration)}
                </p>
              </div>
              <p className="text-xs text-text-secondary">{entitlementSummary(ent)}</p>
              {extras.length ? (
                <p className="text-xs text-text-tertiary">{extras.join(" · ")}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    icon: CircleUser,
    desc: "Who this member is.",
    render: ProfileSection,
  },
  {
    key: "membership",
    label: "Membership",
    icon: BadgeCheck,
    desc: "Which plan they hold, and for how long.",
    render: MembershipSection,
  },
  {
    key: "access",
    label: "Access",
    icon: Gift,
    desc: "What their plan unlocks, resolved against the day they joined.",
    render: AccessSection,
  },
];

export function MemberDetail({ member, plans, onBack, onSave, onDelete }) {
  const { section, setSection } = useWorkspaceUrl();
  const [draft, setDraft] = useState(member);
  const [saving, setSaving] = useState(false);
  // Re-seed when a different member is opened (render-phase reset).
  const [seedId, setSeedId] = useState(member?.id);
  if (member && member.id !== seedId) {
    setSeedId(member.id);
    setDraft(member);
  }

  if (!member) return null;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!draft.name.trim() && !draft.email.trim()) {
      toast.error("Add a name or email.");
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const activeItem = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const Body = activeItem.render;

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Members
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {draft.name || draft.email || "Member"}
            </h1>
            <StatusPill status={draft.status} map={MEMBER_STATUS_MAP} />
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {[draft.email, `since ${formatDate(draft.startedAt)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(member)}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">{activeItem.label}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
          </div>
          <Body draft={draft} set={set} plans={plans} />
        </div>

        <aside className="order-1 lg:order-2">
          <nav className="space-y-0.5 lg:sticky lg:top-0">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeItem.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-surface-card font-medium text-foreground"
                      : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-foreground" : "text-text-secondary",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default MemberDetail;
