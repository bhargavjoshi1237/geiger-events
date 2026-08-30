"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { Blocks, PlugZap } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { getAddon } from "@/addons";
import { useAddons } from "@/context/addons-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

// Renders one addon-contributed screen.
//
// The catalog is static, so an addon URL always RESOLVES — enablement only
// decides what renders. Deep-linking a disabled addon lands here on a clear
// "turned off" state instead of the 404 (or silently-blank screen) you'd get
// from resolving nav dynamically.
//
// The screen module is loaded through its manifest thunk, so a project that has
// the addon off never downloads its code.

function AddonDisabled({ addon }) {
  const { setTab } = useWorkspaceUrl();
  return (
    <MainScreenWrapper>
      <EmptyState
        icon={PlugZap}
        title={`${addon.name} is turned off`}
        description={`This add-on isn't enabled for this project, so its screens are hidden. Turn it on in Settings → Add-ons to use ${addon.name}.`}
        action={
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setTab("Add-ons")}
          >
            Open Add-ons settings
          </Button>
        }
      />
    </MainScreenWrapper>
  );
}

function AddonMissing({ title }) {
  return (
    <MainScreenWrapper>
      <EmptyState
        icon={Blocks}
        title="Add-on not installed"
        description={`Nothing in the add-on catalog provides "${title}". The link may be from an add-on that has since been removed.`}
      />
    </MainScreenWrapper>
  );
}

// One host component per addon screen, built by the registry. `entry` is the
// { addonId, screen } record from the catalog.
export function createAddonScreen(entry) {
  const Loaded = dynamic(
    () =>
      entry.screen.load().then((mod) => {
        // A screen module may export a named *Screen (the house style) or a
        // default; accept either so addon authors aren't forced into one.
        const named = Object.keys(mod).find((k) => k.endsWith("Screen"));
        return mod.default || (named ? mod[named] : null);
      }),
    { ssr: false, loading: () => <LoadingArea /> },
  );

  function AddonScreenHost() {
    const { isEnabled, loading } = useAddons();
    const addon = useMemo(() => getAddon(entry.addonId), []);

    if (!addon) return <AddonMissing title={entry.screen.title} />;
    // Don't flash the "turned off" state while enablement is still loading.
    if (loading) return <LoadingArea />;
    if (!isEnabled(entry.addonId)) return <AddonDisabled addon={addon} />;

    return <Loaded />;
  }

  AddonScreenHost.displayName = `AddonScreen(${entry.screen.id})`;
  return AddonScreenHost;
}
