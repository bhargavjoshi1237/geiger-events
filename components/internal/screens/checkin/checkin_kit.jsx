"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { getCheckinSettings, updateCheckinSettings } from "@/lib/supabase/checkin";
import { withDefaults } from "./constants";

// Shared scaffold for the nine Check-in settings screens. Loads the project's
// checkin_settings row, hands the merged feature slice + a `set(patch)` updater
// to a render-prop body, and persists the whole slice on Save (explicit save,
// mirroring the ticket-type edit page). When `enableLabel` is given it renders a
// global-enable toggle bound to slice.enabled above the body.
export function CheckinSettingsScreen({
  title,
  description,
  icon: Icon,
  feature,
  enableLabel,
  enableHint,
  children,
}) {
  const { projectId } = useProject();
  const [loading, setLoading] = useState(true);
  const [slice, setSlice] = useState(() => withDefaults({}, feature));
  const [saved, setSaved] = useState(() => withDefaults({}, feature));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getCheckinSettings(projectId).then((res) => {
      if (!alive) return;
      const next = withDefaults(res?.config || {}, feature);
      setSlice(next);
      setSaved(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, feature]);

  const set = (patch) => setSlice((s) => ({ ...s, ...patch }));

  const dirty = useMemo(
    () => JSON.stringify(slice) !== JSON.stringify(saved),
    [slice, saved],
  );

  const save = async () => {
    setSaving(true);
    // Optimistic: treat local as saved; reconcile only on a hard failure.
    const prevSaved = saved;
    setSaved(slice);
    const res = await updateCheckinSettings(projectId, { [feature]: slice });
    setSaving(false);
    if (res === false) {
      setSaved(prevSaved);
      toast.error("Couldn't save your changes.");
      return;
    }
    toast.success("Settings saved.");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={title}
        description={description}
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings…
        </div>
      ) : (
        <div className="space-y-6">
          {enableLabel ? (
            <SectionCard
              title="Availability"
              description="Turn this feature on for the whole project, then enable it per event in the event editor."
            >
              <SettingsList>
                <SettingRow
                  icon={Icon}
                  title={enableLabel}
                  description={enableHint}
                  checked={!!slice.enabled}
                  onCheckedChange={(v) => set({ enabled: v })}
                />
              </SettingsList>
            </SectionCard>
          ) : null}

          {children({ slice, set, enabled: !!slice.enabled })}
        </div>
      )}
    </MainScreenWrapper>
  );
}

// Compact select for use as a SettingRow `control`.
export function RowSelect({ value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || "h-9 w-48 bg-surface-card"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
