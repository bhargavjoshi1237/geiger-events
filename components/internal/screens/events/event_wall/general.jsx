"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Field,
  EditorSectionHeader,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useProject } from "@/context/project-context";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { updateWall } from "@/lib/supabase/event_wall";
import { Segmented } from "../theme_controls";
import { CTA_STYLES, DEFAULT_CTA } from "./wall_layout";

export function WallGeneralSection({ wall, onWallChange }) {
  const { projectId } = useProject();
  const [form, setForm] = useState({
    name: wall?.name || "",
    tagline: wall?.tagline || "",
    logoUrl: wall?.logoUrl || "",
  });
  const [cta, setCta, saveCta] = useWallConfig(wall, "cta", DEFAULT_CTA);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  // Held untrimmed while editing — resolveCta() does the trimming when the wall
  // renders, so a trailing space here doesn't fight the keystroke after it.
  const ctaForm = { ...DEFAULT_CTA, ...(cta && typeof cta === "object" ? cta : {}) };
  const setCtaKey = (key) => (value) => setCta({ ...ctaForm, [key]: value });

  // The CTA lives in the metadata bag and the rest in real columns, so this
  // saves both. Meta goes first: updateWall re-reads the row, so its result
  // carries the CTA we just merged back up to the parent.
  const save = async () => {
    setSaving(true);
    if ((await saveCta(cta)) === false) {
      setSaving(false);
      return;
    }
    const res = await updateWall(projectId, form);
    setSaving(false);
    if (res) {
      onWallChange?.(res);
      toast.success("Changes saved.");
    } else toast.error("Couldn't save changes.");
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader title="Page details" />
      <div className="grid gap-4">
        <Field
          label="Page name"
          hint="Shown as the heading on your public events page."
        >
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Our Events"
          />
        </Field>
        <Field label="Tagline" hint="A short line under the heading.">
          <Textarea
            rows={2}
            value={form.tagline}
            onChange={(e) => set("tagline")(e.target.value)}
            placeholder="Discover what's happening."
          />
        </Field>
        <Field
          label="Logo URL"
          hint="Shown beside the page name. Leave blank to use the Geiger logo."
        >
          <Input
            value={form.logoUrl}
            onChange={(e) => set("logoUrl")(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </div>

      <SectionCard
        title="Call to action"
        description="An extra button under Follow at the top of your events page — link a venue tour, a sponsor deck, or your mailing list."
      >
        <div className="grid gap-4">
          <Field
            label="Button label"
            hint="Leave blank to hide the button. Both fields are needed for it to show."
          >
            <Input
              value={ctaForm.label}
              onChange={(e) => setCtaKey("label")(e.target.value)}
              placeholder="Become a sponsor"
            />
          </Field>
          <Field label="Link" hint="A URL, or mailto: for an email address.">
            <Input
              value={ctaForm.url}
              onChange={(e) => setCtaKey("url")(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Style" hint="Both use your wall's accent colour.">
            <Segmented
              value={ctaForm.style}
              onChange={setCtaKey("style")}
              options={CTA_STYLES}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default WallGeneralSection;
