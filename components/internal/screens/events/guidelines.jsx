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
import { GuidelineListEditor } from "@/components/internal/shared/guideline_editor";
import { useEventConfig } from "@/lib/events/use-event-config";

// Event-level dietary & accessibility surface: guidelines shown on the public
// page (merged with the venue's) and the per-event opt-in for post-purchase
// requests. Guidelines persist as `guidelines` (array) and the request flag as
// `dietaryRequests.enabled` — two independent metadata keys so neither clobbers
// the other.
export function GuidelinesSection({ event, headerItem }) {
  const [items, setItems, saveItems, saving] = useEventConfig(
    event,
    "guidelines",
    [],
  );
  const [requests, , saveRequests] = useEventConfig(event, "dietaryRequests", {
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Dietary & Accessibility"}
        description={
          headerItem?.desc ||
          "Guidelines shown on your event page and whether ticket holders can send a request after checkout."
        }
      />

      <SectionCard
        title="Guidelines"
        description="Informational notes shown on the public page to answer attendees' dietary & accessibility questions. These add to any set on the venue."
        action={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() =>
              saveItems(undefined, { successMsg: "Guidelines saved." })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save guidelines"}
          </Button>
        }
      >
        <GuidelineListEditor items={items} onChange={setItems} />
      </SectionCard>

      <SectionCard
        title="Requests"
        description="Post-purchase queries land in Registrations → Dietary & Accessibility."
      >
        <SettingsList>
          <SettingRow
            title="Enable post-purchase requests"
            description="Let ticket holders send a dietary or accessibility request from the order-success page. The workspace master switch must also be on."
            checked={!!requests.enabled}
            onCheckedChange={(v) =>
              saveRequests(
                { enabled: v },
                {
                  successMsg: v
                    ? "Requests enabled for this event."
                    : "Requests disabled for this event.",
                },
              )
            }
          />
        </SettingsList>
      </SectionCard>
    </div>
  );
}

export default GuidelinesSection;
