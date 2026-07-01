"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateWall } from "@/lib/supabase/event_wall";

// Wall name/tagline/logo are real event_wall columns (not the metadata bag),
// so they persist through updateWall() directly, matching how the per-event
// Visibility column commits — not the metadata-merge RPC other sections use.
export function WallGeneralSection({ wall }) {
  const [form, setForm] = useState({
    name: wall?.name || "",
    tagline: wall?.tagline || "",
    logoUrl: wall?.logoUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    const res = await updateWall(form);
    setSaving(false);
    if (res) toast.success("Changes saved.");
    else toast.error("Couldn't save changes.");
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Page details">
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
      </SectionCard>
      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default WallGeneralSection;
