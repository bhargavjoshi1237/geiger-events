"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProject } from "@/context/project-context";
import { updateWall } from "@/lib/supabase/event_wall";
import { slugify } from "../sample_data";

// The wall's public link is /w/<slug> — a real column (not metadata) since
// the public route looks the wall up by it (getWallBySlug).
export function WallCustomUrlSection({ wall }) {
  const { projectId } = useProject();
  const [slug, setSlug] = useState(wall?.slug || "events");
  const [saving, setSaving] = useState(false);
  const clean = slugify(slug);

  const save = async () => {
    if (!clean) {
      toast.error("Enter a valid URL slug.");
      return;
    }
    setSaving(true);
    const res = await updateWall(projectId, { slug: clean });
    setSaving(false);
    if (res) {
      setSlug(clean);
      toast.success("Custom URL saved.");
    } else {
      toast.error("Couldn't save — that URL may already be taken.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Public link"
        description="Where visitors reach your events page."
      >
        <Field label="URL slug">
          <div className="flex items-center gap-2">
            <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-card px-3 text-sm text-text-secondary">
              <Link2 className="h-3.5 w-3.5" />
              /w/
            </span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="events"
              className="max-w-xs"
            />
          </div>
        </Field>
        <p className="mt-2 text-xs text-text-secondary">
          Preview:{" "}
          <code className="rounded bg-surface-card px-1.5 py-0.5 text-muted-foreground">
            geiger.studio/events/w/{clean || "…"}
          </code>
        </p>
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

export default WallCustomUrlSection;
