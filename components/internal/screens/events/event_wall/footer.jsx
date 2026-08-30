"use client";

import { toast } from "sonner";

import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { FooterEditor, DEFAULT_FOOTER } from "../page_footer";

// The wall's footer config (metadata.footer), shared with the event page through
// FooterEditor/PageFooter. Design still writes this key when a brand import
// brings a footer with it, so saving here lifts the value back onto the parent
// wall — otherwise Design would reseed from a stale row and overwrite it.
export function WallFooterSection({ wall, onWallChange }) {
  const [footer, setFooter, saveFooter, saving] = useWallConfig(
    wall,
    "footer",
    DEFAULT_FOOTER,
  );

  const save = async () => {
    if ((await saveFooter(footer)) === false) return;
    onWallChange?.({ ...wall, footer });
    toast.success("Footer saved.");
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title="Footer"
        description="Social buttons, links, and a closing line at the bottom of your public events page."
      />
      <FooterEditor value={footer} onChange={setFooter} />

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

export default WallFooterSection;
