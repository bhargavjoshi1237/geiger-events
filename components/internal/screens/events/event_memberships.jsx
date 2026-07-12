"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Plus } from "lucide-react";

import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecordsByModules } from "@/lib/supabase/ticketing";
import { currency } from "../tickets/constants";

// Event-editor section: enable membership plans for this event. Plans are
// reusable records (ticketing_records, module "membership"); a plan with
// config.applyToAllEvents already applies everywhere and is shown read-only.
// Per-event plans are toggled on/off, stored under metadata.attached.membership.

function priceLabel(config) {
  const price = Number(config.price) || 0;
  if (price === 0) return "Free";
  const period =
    config.billingPeriod && config.billingPeriod !== "one-time"
      ? `/${config.billingPeriod}`
      : "";
  return `${currency(price)}${period}`;
}

export function EventMembershipsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecordsByModules(projectId, ["membership"]).then((rows) => {
      if (!alive) return;
      setPlans((rows ?? []).filter((r) => r.active));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const { perEvent, global } = useMemo(() => {
    const per = [];
    const all = [];
    for (const p of plans) {
      if (p.config?.applyToAllEvents) all.push(p);
      else per.push(p);
    }
    return { perEvent: per, global: all };
  }, [plans]);

  const selected = Array.isArray(attached.membership)
    ? attached.membership
    : [];

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    save({ ...attached, membership: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Memberships"}
        description={
          headerItem?.desc ||
          "Enable membership plans for this event. Members get the plan's discount here. Manage the plans themselves under Membership Plans."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface-card px-6 py-10">
          <p className="text-sm text-text-secondary">No membership plans yet.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab("Membership Plans")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create one
          </Button>
        </div>
      ) : (
        <>
          {global.length ? (
            <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
              <span className="font-medium text-muted-foreground">
                Applies to all events automatically:{" "}
              </span>
              {global.map((p) => p.name).join(", ")}
            </div>
          ) : null}

          {perEvent.length ? (
            <div className="space-y-3">
              {perEvent.map((p) => {
                const on = selected.includes(p.id);
                const disc = Number(p.config?.discountPercent) || 0;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                      on ? "" : "opacity-70",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        <span className="tabular-nums">
                          {priceLabel(p.config || {})}
                        </span>
                        {" · "}
                        {disc ? `${disc}% member discount` : "no discount"}
                      </p>
                    </div>
                    <div className="flex items-center self-center">
                      <Switch
                        checked={on}
                        onCheckedChange={() => toggle(p.id)}
                        aria-label={
                          on ? `Disable ${p.name}` : `Enable ${p.name}`
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              All membership plans apply to every event. Create a per-event plan
              under Membership Plans to enable it here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default EventMembershipsSection;
