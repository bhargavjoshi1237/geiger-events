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
  const { step, headerLabel } = checkout;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
