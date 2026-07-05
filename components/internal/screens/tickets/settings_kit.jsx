"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { getSetting, upsertSetting } from "@/lib/supabase/ticketing_settings";

// A reusable project-global settings screen for a single Tickets module. Fetches
// the module's config on mount, holds it locally, and persists the whole config
// bag on Save. Each feature supplies its default config + a Form render-prop.
//
//   <SettingsScreen module="earlybird" title="Early-bird Sales" … Form={Form} />
//   // Form receives { config, set, save, saving }; set(patch) edits locally.
//
// `children` render below the form (for a settings screen that also hosts a list
// — e.g. Refunds' request inbox), receiving the loaded config.
export function SettingsScreen({
  module,
  title,
  description,
  defaultConfig,
  Form,
  children,
}) {
  const { projectId } = useProject();
  const [config, setConfig] = useState(() =>
    typeof defaultConfig === "function" ? defaultConfig() : { ...defaultConfig },
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const base = useMemo(
    () =>
      typeof defaultConfig === "function"
        ? defaultConfig()
        : { ...defaultConfig },
    [defaultConfig],
  );

  useEffect(() => {
    let alive = true;
    getSetting(projectId, module).then((res) => {
      if (!alive) return;
      // Merge saved config over defaults so new keys always have a value.
      setConfig({ ...base, ...(res?.config || {}) });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, module, base]);

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));

  const save = async (next) => {
    const payload = next === undefined ? config : next;
    if (next !== undefined) setConfig(next);
    setSaving(true);
    const res = await upsertSetting(projectId, module, payload);
    setSaving(false);
    if (res === false || res === null) {
      // null here means not-configured OR failure; treat a hard failure only.
      if (res === false) {
        toast.error("Couldn't save your settings to the server.");
        return false;
      }
    }
    toast.success("Settings saved.");
    return true;
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={title}
        description={description}
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving || loading}
            onClick={() => save()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <Form config={config} set={set} save={save} saving={saving} />
          {typeof children === "function" ? children(config) : children}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default SettingsScreen;
