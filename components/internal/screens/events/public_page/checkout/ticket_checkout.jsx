"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate } from "../../sample_data";

import { useCheckout } from "./use_checkout";
import { SeatsStep } from "./seats_step";
import { BoothsStep } from "./booths_step";
import { DetailsStep } from "./details_step";
import { AddonsStep } from "./addons_step";
import { DoneStep } from "./done_step";
import { ErrorStep } from "./error_step";

export function TicketCheckout(props) {
  const { open, onClose, event, live, accent, daConfig } = props;
  const checkout = useCheckout(props);
  const { step, headerLabel, disclaimerSlot } = checkout;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };

  // Seat and booth picking are map-plus-rail layouts and need the room; every
  // other step is a single column of fields and stays narrow. The map steps
  // also take a DEFINITE height rather than a cap, so the map and the rail can
  // grow into the dialog instead of sitting above a band of dead space.
  const wide = step === "seats" || step === "booths";
  // Only the seat map fills its container end to end; the booth picker still
  // scrolls, so it keeps the capped height.
  const fills = step === "seats";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`flex flex-col overflow-hidden transition-[max-width] ${
          wide ? "max-w-6xl" : "max-w-lg"
        } ${fills ? "h-[88vh] max-h-[88vh]" : "max-h-[85vh]"}`}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            fills ? "min-h-0 overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {/* Sits above whichever step is showing, so it reads as terms for the
              whole purchase rather than for one field. */}
          {disclaimerSlot("checkout-top", "mb-4")}

          {step === "seats" ? (
            <SeatsStep event={event} checkout={checkout} accent={accent} />
          ) : null}

          {step === "booths" ? (
            <BoothsStep event={event} checkout={checkout} accent={accent} />
          ) : null}

          {step === "details" || step === "addons" ? (
            <div className="w-full overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{
                  width: "200%",
                  transform: step === "addons" ? "translateX(-50%)" : "translateX(0)",
                }}
              >
                <div className="w-1/2 shrink-0 px-0.5">
                  <DetailsStep
                    event={event}
                    checkout={checkout}
                    accent={accent}
                    accentStyle={accentStyle}
                    daConfig={daConfig}
                  />
                </div>
                <div className="w-1/2 shrink-0 px-0.5">
                  <AddonsStep
                    checkout={checkout}
                    accent={accent}
                    accentStyle={accentStyle}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <DoneStep
              event={event}
              checkout={checkout}
              accentStyle={accentStyle}
              daConfig={daConfig}
              live={live}
              onClose={onClose}
            />
          ) : null}

          {step === "error" ? (
            <ErrorStep
              checkout={checkout}
              accentStyle={accentStyle}
              onClose={onClose}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
