"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Blocks, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { INSTALLED_ADDONS } from "@/addons";
import { accentClasses } from "@/addons/manifest_schema";
import { navPositionOptions } from "@/addons/registry";
import { useAddons } from "@/context/addons-context";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";

// Settings → Add-ons. Turns catalog add-ons on and off FOR THIS PROJECT and
// controls where their nav section sits. Everything persists to
// events.project_addons, so a toggle survives a refresh and teammates on the
// same project see the same sidebar.

function AddonCard({
  addon,
  enabled,
  position,
  positionOptions,
  busy,
  onToggle,
  onPositionChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = addon.icon;
  const accent = accentClasses(addon.accent);

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        enabled
          ? "border-border bg-surface-subtle"
          : "border-border bg-background",
      )}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
            enabled
              ? cn(accent.bg, accent.border)
              : "border-border bg-surface-card",
          )}
        >
          {Icon ? (
            <Icon
              className={cn(
                "h-5 w-5",
                enabled ? accent.text : "text-text-tertiary",
              )}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-foreground">
              {addon.name}
            </span>
            <Badge className="h-4 border-border bg-surface-card px-1.5 text-[9px] font-medium text-muted-foreground">
              v{addon.version}
            </Badge>
            <Badge className="h-4 border-border bg-surface-card px-1.5 text-[9px] font-medium text-muted-foreground">
              {addon.category}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-text-secondary">
            {addon.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {enabled ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          ) : null}
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
          ) : null}
          <Switch
            checked={enabled}
            disabled={busy}
            onCheckedChange={onToggle}
            aria-label={`${enabled ? "Disable" : "Enable"} ${addon.name}`}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-none border-t border-border py-2.5 text-[11px] font-medium text-text-secondary hover:bg-surface-hover"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {expanded ? "Less details" : "More details"}
      </Button>

      {expanded ? (
        <div className="space-y-5 border-t border-border p-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              What it adds
            </span>
            <ul className="mt-3 space-y-1.5">
              {addon.features.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-2 text-[13px] leading-relaxed text-text-secondary"
                >
                  <span
                    className={cn("mt-[7px] h-1 w-1 shrink-0 rounded-full", accent.bg)}
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Screens
            </span>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {addon.screens.map((screen) => (
                <Badge
                  key={screen.id}
                  className="h-5 border-border bg-surface-card px-2 text-[11px] font-normal text-text-secondary"
                >
                  {screen.title}
                </Badge>
              ))}
            </div>
          </div>

          {enabled && addon.nav ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[12px] text-foreground">
                  Sidebar position
                </span>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Where the {addon.nav.title} section sits in the navigation.
                </p>
              </div>
              <Select
                value={Number.isInteger(position) ? String(position) : "auto"}
                onValueChange={onPositionChange}
                disabled={busy}
              >
                <SelectTrigger className="h-8 w-auto min-w-[200px] border-border bg-surface-card text-xs text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {positionOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-xs text-foreground focus:bg-surface-hover"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AddonsSettingsScreen() {
  const {
    enabledIds,
    positions,
    loading,
    available,
    setEnabled,
    setPosition,
  } = useAddons();
  const [busyId, setBusyId] = useState(null);

  const positionOptions = useMemo(
    () => navPositionOptions(workspaceNav),
    [],
  );

  const stats = useMemo(() => {
    const enabledAddons = INSTALLED_ADDONS.filter((a) =>
      enabledIds.includes(a.id),
    );
    const screenCount = enabledAddons.reduce(
      (sum, a) => sum + a.screens.length,
      0,
    );
    return [
      { label: "Installed", value: String(INSTALLED_ADDONS.length) },
      { label: "Enabled", value: String(enabledAddons.length) },
      { label: "Screens added", value: String(screenCount) },
    ];
  }, [enabledIds]);

  const handleToggle = async (addon, next) => {
    setBusyId(addon.id);
    const ok = await setEnabled(addon.id, next);
    setBusyId(null);
    if (ok) {
      toast.success(`${addon.name} ${next ? "enabled" : "disabled"}`);
    } else {
      toast.error(`Couldn't ${next ? "enable" : "disable"} ${addon.name}.`);
    }
  };

  const handlePosition = async (addon, value) => {
    setBusyId(addon.id);
    const ok = await setPosition(
      addon.id,
      value === "auto" ? null : Number(value),
    );
    setBusyId(null);
    if (ok) toast.success("Sidebar position updated");
    else toast.error("Couldn't save the sidebar position.");
  };

  if (loading) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Add-ons"
          description="Turn optional feature modules on for this project."
        />
        <LoadingArea />
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Add-ons"
        description="Optional feature modules for this project. Enabling one adds its screens to the sidebar; disabling it hides them without touching its data."
      />

      <StatsBar stats={stats} columns={3} />

      {INSTALLED_ADDONS.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title="No add-ons available"
          description="Add-ons appear here once they're installed into the app."
        />
      ) : (
        <div className="grid gap-3">
          {INSTALLED_ADDONS.map((addon) => (
            <AddonCard
              key={addon.id}
              addon={addon}
              enabled={enabledIds.includes(addon.id)}
              position={positions[addon.id] ?? null}
              positionOptions={positionOptions}
              busy={busyId === addon.id || !available}
              onToggle={(next) => handleToggle(addon, next)}
              onPositionChange={(value) => handlePosition(addon, value)}
            />
          ))}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default AddonsSettingsScreen;
