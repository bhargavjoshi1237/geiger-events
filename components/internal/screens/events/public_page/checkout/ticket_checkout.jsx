"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarDays, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatDate } from "../../sample_data";
import { venueLine } from "../hero";

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

  const wide = step === "seats" || step === "booths";
  const fills = step === "seats";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`flex flex-col overflow-hidden transition-[max-width] ${
          wide ? "max-w-6xl" : "max-w-lg"
        } ${fills ? "h-[88vh] max-h-[88vh]" : "max-h-[85vh]"}`}
      >
        <DialogHeader className="shrink-0 gap-0">
          <div className="flex items-center gap-3 pr-8">
            {event.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverUrl}
                alt=""
                aria-hidden="true"
                className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <DialogDescription className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                {event.name}
              </DialogDescription>
              <DialogTitle className="truncate text-xl tracking-tight">{headerLabel}</DialogTitle>
            </div>

            <div
              className={cn(
                "shrink-0 items-center gap-4 text-xs text-text-secondary",
                wide ? "hidden md:flex" : "hidden",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
                {formatDate(event.date)}
              </span>
              {event.venue ? (
                <span className="inline-flex max-w-[16rem] items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span className="truncate">{venueLine(event)}</span>
                </span>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div
          className={`flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            fills ? "min-h-0 overflow-hidden" : "overflow-y-auto"
          }`}
        >
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
