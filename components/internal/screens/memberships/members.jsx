"use client";

import React, { useEffect, useState } from "react";
import { BadgeCheck, CircleUser, Gift, Users } from "lucide-react";

import { RecordsScreen } from "../tickets/records_kit";
import { formatDate } from "../tickets/constants";
import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { listRecords } from "@/lib/supabase/ticketing";
import {
  ENTITLEMENT_ITEMS,
  durationLabel,
  entitlementExpiry,
  entitlementSummary,
  normalizeEntitlements,
  optionSummary,
} from "@/lib/memberships/entitlements";
import {
  createMemberRecord,
  listMemberRecords,
  softDeleteMemberRecord,
  updateMemberRecord,
} from "@/lib/supabase/memberships";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

const KINDS = [
  {
    value: "member",
    label: "Member",
    defaultConfig: () => ({
      email: "",
      membershipId: null,
      planName: "",
      status: "Active",
      startedAt: new Date().toISOString(),
      expiresAt: null,
    }),
  },
];

const MEMBER_DATA = {
  list: listMemberRecords,
  create: createMemberRecord,
  update: updateMemberRecord,
  remove: softDeleteMemberRecord,
};

function summarize(record) {
  const config = record.config || {};
  const plan = config.planName || "No plan";
  const contact = config.email || "No email";
  const timing = config.expiresAt
    ? `expires ${formatDate(config.expiresAt)}`
    : config.startedAt
      ? `since ${formatDate(config.startedAt)}`
      : "not started";
  return `${plan} · ${contact} · ${timing}`;
}

function useMembershipPlans() {
  const { projectId } = useProject();
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "membership").then((rows) => {
      if (alive) setPlans(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return plans;
}

function ProfileSection({ config, setConfig }) {
  return (
    <SectionCard bare>
      <Field
        label="Email"
        hint="Used to identify the member and send membership communications."
        htmlFor="member-email"
      >
        <Input
          id="member-email"
          type="email"
          value={config.email || ""}
          onChange={(e) => setConfig({ ...config, email: e.target.value })}
          placeholder="jane@example.com"
        />
      </Field>
    </SectionCard>
  );
}

function MembershipSection({ config, setConfig, active, setActive }) {
  const plans = useMembershipPlans();
  const currentStatus = active
    ? "Active"
    : config.status === "Expired"
      ? "Expired"
      : "Cancelled";

  const setStatus = (status) => {
    setConfig({ ...config, status });
    setActive(status === "Active");
  };

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">
          <Select
            value={config.membershipId || "none"}
            onValueChange={(value) => {
              const plan = plans.find((item) => item.id === value);
              setConfig({
                ...config,
                membershipId: value === "none" ? null : value,
                planName: plan?.name || "",
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.length ? (
                plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No plans yet
                </SelectItem>
              )}
              {config.membershipId ? null : <SelectItem value="none">No plan</SelectItem>}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Status"
          hint="Track whether this membership is current, expired, or cancelled."
        >
          <Select value={currentStatus} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Member since" hint="The date this membership started.">
          <p className="pt-1.5 text-sm text-text-secondary">
            {formatDate(config.startedAt)}
          </p>
        </Field>
        <Field label="Expires" hint="Leave empty for a lifetime membership.">
          <Input
            type="date"
            value={(config.expiresAt || "").slice(0, 10)}
            onChange={(e) =>
              setConfig({
                ...config,
                expiresAt: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function AccessSection({ config }) {
  const plans = useMembershipPlans();
  const plan = plans.find((item) => item.id === config.membershipId) || null;

  if (!plan) {
    return (
      <SectionCard bare>
        <p className="text-sm text-text-secondary">
          This member is not on a plan yet. Pick one under Membership.
        </p>
      </SectionCard>
    );
  }

  const entitlements = normalizeEntitlements(plan.config);
  const attached = ENTITLEMENT_ITEMS.filter(
    (item) => entitlements[item.key].mode !== "none",
  );

  if (!attached.length) {
    return (
      <SectionCard bare>
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-foreground">{plan.name}</span> does not
          attach anything yet. Add benefits under Membership Plans.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard bare>
      <p className="mb-5 text-sm text-text-secondary">
        Granted by <span className="font-medium text-foreground">{plan.name}</span>.
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {attached.map((item) => {
          const entitlement = entitlements[item.key];
          const expiry = entitlementExpiry(config.startedAt, entitlement.duration);
          const extras = optionSummary(item, entitlement);
          return (
            <div key={item.key} className="space-y-1.5 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-text-secondary">
                  {expiry
                    ? `Until ${formatDate(expiry)}`
                    : durationLabel(entitlement.duration)}
                </p>
              </div>
              <p className="text-xs text-text-secondary">
                {entitlementSummary(entitlement)}
              </p>
              {extras.length ? (
                <p className="text-xs text-text-tertiary">{extras.join(" · ")}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    icon: CircleUser,
    desc: "Who this member is and how to contact them.",
    render: ProfileSection,
  },
  {
    key: "membership",
    label: "Membership",
    icon: BadgeCheck,
    desc: "Which plan they hold, their status, and how long it lasts.",
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

export function MembersScreen() {
  return (
    <RecordsScreen
      module="membership_member"
      title="Members"
      description="Enrollment records for people on your membership plans. Add a member here, then manage their plan and access."
      singular="member"
      icon={Users}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
      data={MEMBER_DATA}
    />
  );
}

export default MembersScreen;
