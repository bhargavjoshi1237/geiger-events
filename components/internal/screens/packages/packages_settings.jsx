"use client";

import React from "react";
import { Gem, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Switch } from "@/components/ui/switch";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useAddons } from "@/context/addons-context";
import { PACKAGES_ADDON_ID } from "@/lib/events/packages";

// The project-wide switch for Packages, and nothing else.
//
// Enablement rides on events.project_addons — the same per-project table the
// addon catalog uses — so this needs no schema of its own and every teammate on
// the project sees the same answer. Turning it off hides the event editor's
// Packages section and the public packages page; it never deletes what has been
// authored, so an accidental toggle costs nothing.

export function PackagesSettingsScreen() {
  const { isEnabled, setEnabled, loading, available } = useAddons();
  const [saving, setSaving] = React.useState(false);
  const on = isEnabled(PACKAGES_ADDON_ID);

  const toggle = async (next) => {
    setSaving(true);
    const ok = await setEnabled(PACKAGES_ADDON_ID, next);
    setSaving(false);
    if (!ok) {
      toast.error("Couldn't save that. Check your connection and try again.");
      return;
    }
    toast.success(next ? "Packages enabled." : "Packages turned off.");
  };

  const header = (
    <ScreenHeader
      title="Packages"
      description="Sell premium hospitality bundles against an event — tiered experiences with their own inclusions, pricing and sales page."
    />
  );

  // The switch reads from project_addons, so there's nothing truthful to draw
  // until those rows land — same as the other addon-backed settings screens.
  if (loading) {
    return (
      <MainScreenWrapper>
        {header}
        <LoadingArea />
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      {header}

      <SectionCard
        title="Enable packages"
        description="While off, nothing changes for your events. Packages you've already written are kept."
      >
        <SettingsList>
          <SettingRow
            title="Packages"
            description={
              on
                ? "On. Each event's editor now has a Packages section."
                : "Off. The Packages section is hidden from the event editor."
            }
            control={
              <Switch
                checked={on}
                disabled={saving || !available}
                onCheckedChange={toggle}
              />
            }
          />
        </SettingsList>

        {saving ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </p>
        ) : null}
      </SectionCard>

      {on ? (
        <SectionCard title="What happens next">
          <div className="flex items-start gap-3">
            <Gem className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
            <div className="space-y-1 text-sm text-text-secondary">
              <p>
                Open an event and find <strong>Packages</strong> under Tickets to
                build its tiers.
              </p>
              <p className="text-xs text-text-tertiary">
                Packages sell from their own page, not from the event&apos;s live
                page — that page keeps selling tickets.
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </MainScreenWrapper>
  );
}

export default PackagesSettingsScreen;
