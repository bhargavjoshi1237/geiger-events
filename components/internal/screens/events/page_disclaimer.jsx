"use client";

import React from "react";
import { Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import { DisclaimerPlacementPicker } from "./disclaimer_placement";
import {
  DEFAULT_DISCLAIMER_POSITION,
  disclaimerPlacements,
} from "./public_page/disclaimer";

// Free-text disclaimer the organizer can place on the public page, in checkout,
// or both. Persists as `disclaimer` — { enabled, text, placements } — one
// metadata key. Older events saved a single `position`; disclaimerPlacements
// reads either shape, so they keep working and upgrade on the next save.

const EMPTY_DISCLAIMER = {
  enabled: false,
  text: "",
  placements: [DEFAULT_DISCLAIMER_POSITION],
};

export function PageDisclaimerSection({ event, headerItem }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(
    event,
    "disclaimer",
    EMPTY_DISCLAIMER,
  );

  const set = (key) => (value) => setCfg({ ...cfg, [key]: value });

  const placements = disclaimerPlacements(cfg);
  const toggle = (slot) =>
    // Always write the array shape, so a legacy `position` stops being the
    // source of truth the moment the organizer touches placement.
    setCfg({
      ...cfg,
      placements: placements.includes(slot)
        ? placements.filter((p) => p !== slot)
        : [...placements, slot],
    });

  const save = () =>
    saveCfg(undefined, { successMsg: "Disclaimer saved." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Disclaimer"}
        description={
          headerItem?.desc ||
          "Clear fine print shown on your page wherever you position it."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Disclaimer"}
          </Button>
        }
      />

      <SectionCard
        title="Placement"
        description="Where the disclaimer appears. Pick as many slots as you need — the same text shows in each."
      >
        <SettingsList>
          <SettingRow
            title="Show disclaimer"
            description="Renders nothing anywhere while off."
            checked={!!cfg.enabled}
            onCheckedChange={(v) => set("enabled")(v)}
          />
        </SettingsList>

        {cfg.enabled ? (
          <div className="mt-4">
            <DisclaimerPlacementPicker
              placements={placements}
              onToggle={toggle}
            />
          </div>
        ) : null}

        {cfg.enabled && !placements.length ? (
          <p className="mt-3 text-[11px] text-amber-400">
            Pick at least one slot — the disclaimer has nowhere to render.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Text"
        description="Every line becomes its own paragraph. Example: “Prices include VAT, excluding service fees and acquisition fees.”"
      >
        <Textarea
          rows={5}
          value={cfg.text || ""}
          onChange={(e) => set("text")(e.target.value)}
          placeholder="Prices include VAT, excluding service fees and acquisition fees."
        />
      </SectionCard>
    </div>
  );
}

export default PageDisclaimerSection;
