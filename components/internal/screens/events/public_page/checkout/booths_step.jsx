"use client";

import { Button } from "@/components/ui/button";

import { BoothPicker } from "../../booth_picker";

export function BoothsStep({ event, checkout, accent }) {
  const { expo, setBoothSel, setQty, boothSel, busy, confirmBooths } = checkout;

  return (
    <div className="grid gap-4">
      <BoothPicker
        event={event}
        expo={expo}
        tickets={event?.tickets || []}
        accent={accent}
        onChange={(sel) => {
          setBoothSel(sel);
          if (sel.boothIds.length) setQty(sel.boothIds.length);
        }}
      />
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          disabled={busy || !boothSel?.boothIds?.length}
          onClick={confirmBooths}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          style={accent ? { backgroundColor: accent } : undefined}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
