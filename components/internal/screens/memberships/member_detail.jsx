"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CircleUser,
  Gift,
  Loader2,
  Trash2,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  ENTITLEMENT_ITEMS,
  durationLabel,
  entitlementExpiry,
  entitlementSummary,
  normalizeEntitlements,
  optionSummary,
} from "@/lib/memberships/entitlements";
import { formatDate, MEMBER_STATUS_MAP } from "../tickets/constants";

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
  const [draft, setDraft] = useState(member);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [seedId, setSeedId] = useState(member?.id);
  if (member && member.id !== seedId) {
    setSeedId(member.id);
    setDraft(member);
  }

  if (!member) return null;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const dirty =
    (draft.name || "") !== (member.name || "") ||
    (draft.email || "") !== (member.email || "") ||
    draft.status !== member.status ||
    (draft.membershipId || "") !== (member.membershipId || "") ||
    (draft.expiresAt || null) !== (member.expiresAt || null);

  const save = async () => {
    if (!dirty) return;
    if (!draft.name.trim() && !draft.email.trim()) {
      toast.error("Add a name or email.");
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <EditorShell
      back={{ label: "Members", onClick: onBack }}
      title={draft.name || draft.email || "Member"}
      status={draft.status}
      statusMap={MEMBER_STATUS_MAP}
      meta={[draft.email, `since ${formatDate(draft.startedAt)}`]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving || !dirty}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
      nav={SECTIONS}
      after={
        <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove member</DialogTitle>
              <DialogDescription>
                Remove{" "}
                <span className="font-medium text-foreground">
                  {member.name || member.email || "this member"}
                </span>{" "}
                from your members list? This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-red-500/90 text-white hover:bg-red-500"
                onClick={() => {
                  setRemoveOpen(false);
                  onDelete(member);
                }}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {({ activeItem }) => {
        const Body = activeItem.render;
        return <Body draft={draft} set={set} plans={plans} />;
      }}
    </EditorShell>
  );
}

export default MemberDetail;
