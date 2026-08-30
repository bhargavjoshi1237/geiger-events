"use client";

import { toast } from "sonner";
import {
  Armchair,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  Ticket,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "../../sample_data";

import { seatLabelSummary } from "../tickets";
import { PostPurchaseRequest } from "./post_purchase_request";

function SummaryRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right font-medium text-foreground">
        {children}
      </span>
    </div>
  );
}

export function DoneStep({ event, checkout, accentStyle, daConfig, live, onClose }) {
  const { regStatus, order, qty, doneTicketName, ticket, seatSel, email, name } = checkout;
  const isConfirmed = regStatus !== "Pending" && regStatus !== "Waitlisted";

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full ring-8",
          regStatus === "Pending"
            ? "bg-amber-500/15 text-amber-400 ring-amber-500/5"
            : regStatus === "Waitlisted"
              ? "bg-violet-500/15 text-violet-300 ring-violet-500/5"
              : "bg-emerald-500/15 text-emerald-400 ring-emerald-500/5",
        )}
      >
        {regStatus === "Pending" ? (
          <Clock className="h-8 w-8" />
        ) : regStatus === "Waitlisted" ? (
          <ClipboardList className="h-8 w-8" />
        ) : (
          <CheckCircle2 className="h-8 w-8" />
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xl font-semibold text-foreground">
          {regStatus === "Pending"
            ? "Registration received"
            : regStatus === "Waitlisted"
              ? "You're on the waitlist"
              : "You're going!"}
        </p>
        <p className="mx-auto max-w-sm text-sm text-text-secondary">
          {regStatus === "Pending"
            ? `Your registration for ${event.name} is pending approval.`
            : regStatus === "Waitlisted"
              ? `${event.name} is full — we've saved your place in line.`
              : `You're all set for ${event.name}.`}
        </p>
        {order?.preview ? (
          <div className="pt-1">
            <Badge variant="neutral">Preview — nothing saved</Badge>
          </div>
        ) : null}
      </div>

      <div className="w-full divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
        {isConfirmed ? (
          <SummaryRow icon={Ticket} label="Ticket">
            {qty} × {doneTicketName || ticket?.name}
          </SummaryRow>
        ) : (
          <SummaryRow icon={ClipboardList} label="Status">
            {regStatus === "Pending" ? "Pending review" : "Waitlisted"}
          </SummaryRow>
        )}
        {isConfirmed && seatSel?.seats?.length ? (
          <SummaryRow icon={Armchair} label="Seats">
            {seatLabelSummary(seatSel.seats, seatSel.sections)}
          </SummaryRow>
        ) : null}
        <SummaryRow icon={CalendarCheck} label="When">
          {formatDate(event.date)}
          {event.time ? ` · ${event.time}` : ""}
        </SummaryRow>
        {event.venue ? (
          <SummaryRow icon={MapPin} label="Where">
            {event.venue}
          </SummaryRow>
        ) : null}
        {email ? (
          <SummaryRow
            icon={Mail}
            label={isConfirmed ? "Confirmation to" : "We'll email"}
          >
            {email}
          </SummaryRow>
        ) : null}
        {isConfirmed && order?.orderId ? (
          <SummaryRow icon={CheckCircle2} label="Order">
            <span className="font-mono">
              #{String(order.orderId).slice(0, 8)}
            </span>
          </SummaryRow>
        ) : null}
      </div>

      {daConfig?.requestsEnabled && event.dietaryRequests?.enabled ? (
        <PostPurchaseRequest
          event={event}
          name={name}
          email={email}
          prompt={daConfig?.requestPrompt}
          accentStyle={accentStyle}
          live={live}
        />
      ) : null}

      {isConfirmed ? (
        <div className="flex w-full gap-2">
          <Button
            variant="outline"
            className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => toast.success("Added to calendar.")}
          >
            <CalendarCheck className="h-4 w-4" /> Add to calendar
          </Button>
          <Button
            style={accentStyle}
            className="flex-1 hover:opacity-90"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      ) : (
        <Button
          style={accentStyle}
          className="w-full hover:opacity-90"
          onClick={onClose}
        >
          Done
        </Button>
      )}

      {checkout.disclaimerSlot("checkout-done", "w-full text-left")}
    </div>
  );
}
