"use client";

import { useState } from "react";
import { IdCard } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { CardViewer } from "@/components/internal/shared/lanyard/card_viewer";
import { SAMPLE_ATTENDEE } from "@/lib/passes/attendees";
import { useEventPass } from "./event_badge";

export function EventCardViewerButton({ event }) {
  const [open, setOpen] = useState(false);
  const enabled = Boolean(event?.badge?.enabled);
  const { template, qrSettings, loading } = useEventPass(event, {
    ...event?.badge,
    enabled: enabled && open,
  });

  return (
    <CardViewer
      open={open}
      onOpenChange={setOpen}
      event={event}
      attendee={SAMPLE_ATTENDEE}
      template={enabled ? template : null}
      qrSettings={qrSettings}
      loading={loading}
      emptyMessage={enabled ? "Choose a design in Badge printing to preview the card." : "Enable attendee badges in Badge printing to preview the card."}
      trigger={
        <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" title="Open card viewer" aria-label="Open card viewer">
          <IdCard className="h-4 w-4" />
        </Button>
      }
    />
  );
}
