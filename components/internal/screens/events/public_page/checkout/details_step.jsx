"use client";

import { CheckCircle2, ChevronRight, Loader2, Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";

import { SlotPicker } from "../../ticket_addons_step";
import { QtyStepper } from "./qty_stepper";
import { DetailsTotals } from "./order_totals";
import {
  RegistrationQuestions,
  DietaryInquiry,
  TicketQuestions,
} from "./question_fields";
import {
  OfferingsPicker,
  GroupAttendees,
  DonationField,
  DiscountField,
} from "./purchase_fields";

export function DetailsStep({ event, checkout, accent, accentStyle, daConfig }) {
  const {
    approvedResume,
    ticket,
    isFree,
    price,
    qty,
    setQty,
    maxQty,
    bookableSlots,
    ticketId,
    slotId,
    setSlotId,
    offerings,
    isChosen,
    selectSingle,
    toggleMultiple,
    name,
    setName,
    email,
    setEmail,
    regQuestions,
    answers,
    setAnswer,
    inquiryQuestions,
    inquiryKey,
    toggleInquiryMulti,
    ticketQuestions,
    ticketAnswers,
    setTicketAnswer,
    isGroup,
    gCfg,
    attendees,
    setAttendee,
    donationOn,
    donCfg,
    donationAmount,
    setDonationAmount,
    donationCustom,
    setDonationCustom,
    discountEnabled,
    appliedDiscount,
    removeDiscount,
    discountInput,
    setDiscountInput,
    applyDiscount,
    discountBusy,
    busy,
    submitDetails,
    usePurchasables,
    visiblePurs,
    requiresApproval,
  } = checkout;

  return (
    <div className="grid gap-4">
      {approvedResume ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-sm text-foreground">
            You&apos;re approved for{" "}
            <span className="font-medium">{event.name}</span> — complete your
            ticket below to secure your spot.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {ticket?.name || "General Admission"}
          </p>
          {ticket?.note ? (
            <p className="text-xs text-text-secondary">{ticket.note}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {isFree ? "Free" : `$${price}`}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Quantity</span>
        <QtyStepper qty={qty} setQty={setQty} max={maxQty} accent={accent} />
      </div>
      <div className="border-t border-border"></div>

      {bookableSlots.length ? (
        <>
          <SlotPicker
            slots={bookableSlots}
            slotsSold={event.slotsSold || {}}
            ticketId={ticketId}
            qty={qty}
            selectedId={slotId}
            onSelect={setSlotId}
            accent={accent}
            label={event.slotBooking?.label}
          />
          <div className="border-t border-border"></div>
        </>
      ) : null}

      <OfferingsPicker
        offerings={offerings}
        isChosen={isChosen}
        selectSingle={selectSingle}
        toggleMultiple={toggleMultiple}
        accent={accent}
      />

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Full name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <RegistrationQuestions
          questions={regQuestions}
          answers={answers}
          setAnswer={setAnswer}
        />

        <DietaryInquiry
          questions={inquiryQuestions}
          daConfig={daConfig}
          answers={answers}
          inquiryKey={inquiryKey}
          setAnswer={setAnswer}
          toggleInquiryMulti={toggleInquiryMulti}
          accent={accent}
        />
      </div>

      <TicketQuestions
        questions={ticketQuestions}
        qty={qty}
        ticketAnswers={ticketAnswers}
        setTicketAnswer={setTicketAnswer}
      />

      {isGroup ? (
        <GroupAttendees
          qty={qty}
          gCfg={gCfg}
          attendees={attendees}
          setAttendee={setAttendee}
        />
      ) : null}

      {donationOn ? (
        <DonationField
          donCfg={donCfg}
          donationAmount={donationAmount}
          setDonationAmount={setDonationAmount}
          donationCustom={donationCustom}
          setDonationCustom={setDonationCustom}
          accent={accent}
        />
      ) : null}

      {discountEnabled ? (
        <DiscountField
          appliedDiscount={appliedDiscount}
          removeDiscount={removeDiscount}
          discountInput={discountInput}
          setDiscountInput={setDiscountInput}
          applyDiscount={applyDiscount}
          discountBusy={discountBusy}
        />
      ) : null}

      {checkout.disclaimerSlot("checkout-summary")}

      <DetailsTotals event={event} checkout={checkout} />

      <Button
        style={accentStyle}
        className="w-full hover:opacity-90"
        disabled={busy}
        onClick={submitDetails}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : usePurchasables && visiblePurs.length ? (
          <>
            Continue <ChevronRight className="h-4 w-4" />
          </>
        ) : requiresApproval && !approvedResume ? (
          "Request to register"
        ) : isFree ? (
          "Complete registration"
        ) : (
          <>
            Continue To Payment <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Button>

      {checkout.disclaimerSlot("checkout-pay")}

      {!isFree &&
      !(requiresApproval && !approvedResume) &&
      !(usePurchasables && visiblePurs.length) ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
          <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
        </p>
      ) : null}
    </div>
  );
}
