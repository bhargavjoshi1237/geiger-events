"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@geiger/ui/dialog";
import { CalendarDays, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatDate } from "../../sample_data";
import { venueLine } from "../hero";

import { useCheckout } from "./use_checkout";
import { SeatsStep } from "./seats_step";
import { BoothsStep } from "./booths_step";
import { DetailsStep } from "./details_step";
import { AddonsStep } from "./addons_step";
import { ReviewStep } from "./review_step";
import { DoneStep } from "./done_step";
import { ErrorStep } from "./error_step";
import { ExpressStep } from "./express_step";

// The form steps slide sideways; a hidden pane collapses once the slide ends so the dialog takes the visible step's height.
const SLIDES = ["details", "addons", "review"];
const slidePane = (active) =>
  cn(
    "shrink-0 px-0.5 transition-[max-height] duration-0",
    active ? "max-h-[400vh] delay-0" : "max-h-0 overflow-hidden delay-300",
  );

export function TicketCheckout(props) {
  const { open, onClose, event, live, accent, daConfig } = props;
  const checkout = useCheckout(props);
  const { step, headerLabel, disclaimerSlot } = checkout;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };

  const wide = step === "seats" || step === "booths";
  const slide = SLIDES.indexOf(step);
  const wideForm = slide >= 0;
  const fills = step === "seats";
  const express = step === "express";
  const showMeta = wide || wideForm;
  const stepIdx = checkout.flowSteps.findIndex((s) => s.id === step);
  const nextStep = checkout.flowSteps[stepIdx + 1];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`flex flex-col overflow-hidden transition-[max-width] ${
          wide ? "max-w-6xl" : wideForm ? "max-w-3xl" : "max-w-lg"
        } ${fills ? "h-[88vh] max-h-[88vh]" : "max-h-[85vh]"} ${
          express ? "ev-glow-pulse" : ""
        }`}
        style={express ? { "--ev-glow-color": accent.color } : undefined}
      >
        <DialogHeader className="shrink-0 gap-0">
          <div className="flex items-center gap-3.5 pr-8">
            {event.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverUrl}
                alt=""
                aria-hidden="true"
                className={cn(
                  "shrink-0 rounded-lg border border-border object-cover",
                  showMeta ? "h-14 w-14" : "h-11 w-11",
                )}
              />
            ) : null}

            {/* Date/venue stack under the title so the event name gets the full row width */}
            <div className="min-w-0 flex-1">
              <DialogDescription className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                {event.name}
              </DialogDescription>
              <DialogTitle className="truncate text-xl leading-tight tracking-tight">
                {headerLabel}
              </DialogTitle>
              {showMeta ? (
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span className="inline-flex shrink-0 items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
                    {formatDate(event.date)}
                  </span>
                  {event.venue ? (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      <span className="truncate">{venueLine(event)}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {showMeta && stepIdx >= 0 ? (
              <div className="hidden shrink-0 flex-col items-end md:flex">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  Step {stepIdx + 1} of {checkout.flowSteps.length}
                </span>
                {nextStep ? (
                  <span className="mt-0.5 text-xs text-text-secondary">
                    Next: <span className="font-medium text-foreground">{nextStep.label}</span>
                  </span>
                ) : null}
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {checkout.flowSteps.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn("h-1 w-8 rounded-full", i > stepIdx && "bg-border")}
                      style={i <= stepIdx ? { backgroundColor: accent.color } : undefined}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div
          className={`flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            fills ? "min-h-0 overflow-hidden" : "overflow-y-auto pt-2"
          }`}
        >
          {disclaimerSlot("checkout-top", "mb-4")}

          {step === "seats" ? (
            <SeatsStep event={event} checkout={checkout} accent={accent} />
          ) : null}

          {step === "express" ? (
            <ExpressStep checkout={checkout} accent={accent} accentStyle={accentStyle} />
          ) : null}

          {step === "booths" ? (
            <BoothsStep event={event} checkout={checkout} accent={accent} />
          ) : null}

          {wideForm ? (
            <div className="w-full overflow-hidden">
              <div
                className="flex items-start transition-transform duration-300 ease-out"
                style={{
                  width: `${SLIDES.length * 100}%`,
                  transform: `translateX(-${(slide * 100) / SLIDES.length}%)`,
                }}
              >
                {SLIDES.map((id) => (
                  <div
                    key={id}
                    className={slidePane(step === id)}
                    style={{ width: `${100 / SLIDES.length}%` }}
                    inert={step !== id}
                  >
                    {id === "details" ? (
                      <DetailsStep
                        event={event}
                        checkout={checkout}
                        accent={accent}
                        accentStyle={accentStyle}
                        daConfig={daConfig}
                      />
                    ) : id === "addons" ? (
                      <AddonsStep checkout={checkout} accent={accent} accentStyle={accentStyle} />
                    ) : (
                      <ReviewStep event={event} checkout={checkout} accentStyle={accentStyle} />
                    )}
                  </div>
                ))}
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
