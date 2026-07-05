"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import {
  getCampaignSettings,
  updateCampaignSettings,
} from "@/lib/supabase/campaigns";
import { withSettingsDefaults } from "./constants";

// Shared scaffold for the Campaigns settings screens (Deliverability,
// Personalization). Loads the project's campaign_settings row, hands the merged
// feature slice + a `set(patch)` updater to a render-prop body, and persists the
// whole slice on Save through the shallow-merge RPC — mirroring checkin_kit's
// CheckinSettingsScreen so the two areas behave alike.
export function CampaignSettingsScreen({ title, description, feature, children }) {
  const { projectId } = useProject();
  const [loading, setLoading] = useState(true);
  const [slice, setSlice] = useState(() => withSettingsDefaults({}, feature));
  const [saved, setSaved] = useState(() => withSettingsDefaults({}, feature));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getCampaignSettings(projectId).then((res) => {
      if (!alive) return;
      const next = withSettingsDefaults(res?.config || {}, feature);
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
    const prevSaved = saved;
    setSaved(slice);
    const res = await updateCampaignSettings(projectId, { [feature]: slice });
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="space-y-6">{children({ slice, set })}</div>
      )}
    </MainScreenWrapper>
  );
}
