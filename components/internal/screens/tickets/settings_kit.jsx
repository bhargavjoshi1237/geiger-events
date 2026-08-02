"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";
import { getSetting, upsertSetting } from "@/lib/supabase/ticketing_settings";

// A reusable project-global settings screen for a single Tickets module. Fetches
// the module's config on mount, holds it locally, and persists the whole config
// bag on Save. Each feature supplies its default config + a Form render-prop.
//
//   <SettingsScreen module="earlybird" title="Early-bird Sales" … Form={Form} />
//   // Form receives { config, set, save, saving }; set(patch) edits locally.
//
// Pass `sections` ([{ key, label, icon, desc, render }]) instead of `Form` for
// the event-editor layout — content on the left, section nav on the right.
//
// `children` render below the form (for a settings screen that also hosts a list
// — e.g. Refunds' request inbox), receiving the loaded config.
export function SettingsScreen({
  module,
  title,
  description,
  defaultConfig,
  Form,
  sections,
  children,
}) {
  const { projectId } = useProject();
  const { section, setSection } = useWorkspaceUrl();
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
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : sections?.length ? (
        <SettingsSections
          sections={sections}
          section={section}
          setSection={setSection}
          formProps={{ config, set, save, saving }}
        />
      ) : (
        <div className="space-y-6">
          <Form config={config} set={set} save={save} saving={saving} />
          {typeof children === "function" ? children(config) : children}
        </div>
      )}
    </MainScreenWrapper>
  );
}

// Content left, section nav right — the event-editor layout, with the open
// section mirrored to the URL so a refresh lands back on it.
function SettingsSections({ sections, section, setSection, formProps }) {
  const activeItem = sections.find((s) => s.key === section) || sections[0];
  // Rendered as an element, not called — sections own their own hooks.
  const Body = activeItem.render;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
      <div className="order-2 min-w-0 lg:order-1">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{activeItem.label}</h2>
          {activeItem.desc ? (
            <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
          ) : null}
        </div>
        <Body {...formProps} />
      </div>

      <aside className="order-1 lg:order-2">
        <nav className="space-y-0.5 lg:sticky lg:top-0">
          {sections.map((item) => {
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
                {Icon ? (
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-foreground" : "text-text-secondary",
                    )}
                  />
                ) : null}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}

export default SettingsScreen;
