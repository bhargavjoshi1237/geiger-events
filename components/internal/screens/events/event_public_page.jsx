"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Clock,
  CalendarCheck,
  Share2,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Minus,
  Plus,
  ImageIcon,
  Globe,
  Video,
  Ticket,
  ChevronRight,
  Eye,
  ClipboardList,
  Languages,
  Gauge,
  Image as ImgIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_MAP, formatDate, initials } from "./sample_data";
import { defaultPageDesign, resolveFont } from "./page_design";
import {
  resolveTheme,
  themeStyle,
  themeAccent,
  resolveWidth,
} from "@/lib/events/theme";
import { PageBlock } from "./page_blocks";
import { buyTicket } from "@/lib/supabase/orders";
import { registerForEvent } from "@/lib/supabase/registrations";
import { getUser } from "@/lib/supabase/user";
import { splitRegistrationAnswers } from "@/lib/events/registration_answers";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const CO_HOSTS = ["Marco Reyes", "Priya Shah"];
const REG_QUESTIONS = ["Full name", "Dietary requirements", "T-shirt size"];
const TYPE_ICON = { "In-person": MapPin, Online: Video, Hybrid: Globe };

function eventBase(event) {
  if (event.sold > 0 && event.revenue > 0) {
    return Math.max(5, Math.round(event.revenue / event.sold / 5) * 5);
  }
  return 25;
}

function buildTickets(event) {
  // Prefer the real, editor-configured tiers (stored on the event's metadata
  // bag). Only fall back to a synthesized set when none have been set up yet.
  if (Array.isArray(event.tickets) && event.tickets.length) {
    return event.tickets.map((t) => ({
      name: t.name || "Ticket",
      price: Number(t.price) || 0,
      qty: Number(t.qty) || 0,
    }));
  }
  if (event.type === "Online" && event.revenue === 0) {
    return [{ name: "Free registration", price: 0, note: "Online access link sent on registration" }];
  }
  const base = eventBase(event);
  return [
    { name: "Early Bird", price: Math.max(0, Math.round(base * 0.7)), note: "Limited availability" },
    { name: "General Admission", price: base, note: "Standard entry" },
    { name: "VIP", price: Math.round(base * 2.2), note: "Front row + after-party" },
  ];
}

function QtyStepper({ qty, setQty, max, accent }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={qty <= 1}
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        aria-label="Decrease quantity"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center text-base font-semibold tabular-nums text-foreground">
        {qty}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={qty >= max}
        onClick={() => setQty((q) => Math.min(max, q + 1))}
        aria-label="Increase quantity"
        style={
          qty < max
            ? { borderColor: `color-mix(in srgb, ${accent.color} 40%, transparent)` }
            : undefined
        }
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TicketCheckout({
  open,
  onClose,
  event,
  ticket,
  remaining,
  live,
  accent,
  onPurchased,
  // Set when the buyer just returned from Stripe Checkout (event_public_page's
  // verify-on-mount effect); makes the dialog open straight to done/error
  // instead of details. Consumed once, then cleared by the parent.
  resumeResult,
}) {
  const [step, setStep] = useState("details"); // details | done | error
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selections, setSelections] = useState({});
  // Answers to the event's registration questions, keyed by question id. The
  // resulting registration status (Confirmed / Pending / Waitlisted) is kept so
  // the confirmation step can tailor its copy.
  const [answers, setAnswers] = useState({});
  const [regStatus, setRegStatus] = useState(null);
  // The ticket name actually purchased — usually `ticket?.name`, but a resumed
  // Stripe return may land after the sidebar's selection has moved on.
  const [doneTicketName, setDoneTicketName] = useState("");
  // Navigating away is done from an effect (not inline in the async handler)
  // so the actual redirect happens outside the checkout request's own closure.
  const [redirectUrl, setRedirectUrl] = useState(null);
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  // Prefill the buyer details from the signed-in user when the sheet opens,
  // without clobbering anything they've already typed.
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    getUser().then((u) => {
      if (!alive || !u) return;
      setName((prev) => prev || u.name || "");
      setEmail((prev) => prev || u.email || "");
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const price = ticket?.price || 0;

  // Offerings (add-ons / choices) available for the selected ticket.
  const offerings = (Array.isArray(event.offerings) ? event.offerings : [])
    .filter((o) => o.enabled && Array.isArray(o.options) && o.options.length)
    .filter(
      (o) =>
        o.appliesTo === "all" ||
        (Array.isArray(o.appliesTo) && o.appliesTo.includes(ticket?.name)),
    );

  const optionPrice = (o, id) => {
    const opt = o.options.find((x) => x.id === id);
    return opt ? Number(opt.price) || 0 : 0;
  };
  // Per-ticket add-on total from the current selections.
  const addonUnit = offerings.reduce((sum, o) => {
    const sel = selections[o.id];
    if (o.selectionType === "single") return sum + (sel ? optionPrice(o, sel) : 0);
    const arr = Array.isArray(sel) ? sel : [];
    return sum + arr.reduce((s, id) => s + optionPrice(o, id), 0);
  }, 0);

  const total = (price + addonUnit) * qty;
  const isFree = total === 0;
  const maxQty = Math.min(Math.max(1, remaining || 1), 10);
  const accentStyle = { backgroundColor: accent.color, color: accent.text };

  const selectSingle = (o, optId) =>
    setSelections((s) => ({
      ...s,
      [o.id]: s[o.id] === optId && !o.required ? undefined : optId,
    }));
  const toggleMultiple = (offId, optId) =>
    setSelections((s) => {
      const arr = Array.isArray(s[offId]) ? s[offId] : [];
      return {
        ...s,
        [offId]: arr.includes(optId)
          ? arr.filter((x) => x !== optId)
          : [...arr, optId],
      };
    });
  const isChosen = (o, optId) =>
    o.selectionType === "single"
      ? selections[o.id] === optId
      : Array.isArray(selections[o.id]) && selections[o.id].includes(optId);
  // Readable record of choices saved on the order's metadata bag.
  const buildSelections = () =>
    offerings
      .map((o) => {
        const sel = selections[o.id];
        const ids =
          o.selectionType === "single"
            ? sel
              ? [sel]
              : []
            : Array.isArray(sel)
              ? sel
              : [];
        const choices = ids
          .map((id) => o.options.find((x) => x.id === id))
          .filter(Boolean)
          .map((opt) => ({ label: opt.label, price: Number(opt.price) || 0 }));
        return choices.length
          ? { offering: o.name, type: o.selectionType, choices }
          : null;
      })
      .filter(Boolean);

  // Reset to a fresh purchase whenever the dialog opens (render-phase reset —
  // React's recommended alternative to a setState-in-effect). A buyer just
  // back from Stripe opens straight to the done/error step instead.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (resumeResult) {
        setStep(resumeResult.ok ? "done" : "error");
        setOrder(resumeResult.ok ? { orderId: resumeResult.orderId } : null);
        setErrorMsg(resumeResult.ok ? "" : resumeResult.error || "Payment could not be completed.");
        setRegStatus(resumeResult.ok ? "Confirmed" : null);
        setDoneTicketName(resumeResult.ticket || "");
        setName(resumeResult.name || "");
        setEmail(resumeResult.email || "");
        setQty(resumeResult.quantity || 1);
        setBusy(false);
        setSelections({});
        setAnswers({});
      } else {
        setStep("details");
        setQty(1);
        setName("");
        setEmail("");
        setOrder(null);
        setErrorMsg("");
        setBusy(false);
        setSelections({});
        setAnswers({});
        setRegStatus(null);
      }
    }
  }

  // Registration policy comes from the event's RSVP config (per-event editor).
  const rsvpCfg = event.rsvp || {};
  const requiresApproval = !!rsvpCfg.requireApproval;
  const allowWaitlist = rsvpCfg.waitlist !== false;
  // The event's custom questions, minus the name/email we already collect.
  const regQuestions = (Array.isArray(event.questions) ? event.questions : [])
    .filter((q) => q && q.label)
    .filter((q) => !/^(full\s*)?name$|^e-?mail$/i.test(q.label.trim()));
  const setAnswer = (id) => (value) =>
    setAnswers((a) => ({ ...a, [id]: value }));
  // Pull dietary / accessibility answers into their own columns; the rest go in
  // the answers bag keyed by readable label.
  const buildRegistration = () => {
    const { dietary, accessibility, answers: bag } = splitRegistrationAnswers(
      regQuestions,
      answers,
    );
    return {
      eventId: event.id,
      formId: event.formId || null,
      name,
      email,
      partySize: qty,
      dietary,
      accessibility,
      answers: bag,
      requireApproval: requiresApproval,
      allowWaitlist,
      source: "Online",
    };
  };

  // Create the registration record (live only). Sets regStatus for the
  // confirmation copy; in preview we just simulate the status.
  const doRegister = async () => {
    if (!live) {
      setRegStatus(requiresApproval ? "Pending" : "Confirmed");
      return;
    }
    const res = await registerForEvent(buildRegistration());
    setRegStatus(res.ok ? res.status : requiresApproval ? "Pending" : "Confirmed");
  };

  const finalize = async () => {
    setBusy(true);
    setDoneTicketName(ticket?.name || "");
    if (!live) {
      // Preview — demonstrate the flow without writing to the database.
      await doRegister();
      setOrder({ orderId: null, preview: true });
      setStep("done");
      setBusy(false);
      return;
    }
    const res = await buyTicket({
      eventId: event.id,
      name,
      email,
      ticket: ticket?.name,
      price,
      quantity: qty,
      addons: addonUnit,
      selections: buildSelections(),
    });
    if (res.ok) {
      // The order is recorded; also write the person-coming record so they
      // appear in the RSVPs / Waitlist / Approval screens.
      await doRegister();
      setBusy(false);
      setOrder(res);
      setStep("done");
      onPurchased?.(res);
    } else if (res.soldOut) {
      setBusy(false);
      setErrorMsg("Sorry — these tickets just sold out.");
      setStep("error");
    } else {
      setBusy(false);
      setErrorMsg("Something went wrong processing your order. Please try again.");
      setStep("error");
    }
  };

  // Approval-required events skip payment entirely — the registration is a
  // request that lands in Approval Gates as Pending.
  const requestApproval = async () => {
    setBusy(true);
    await doRegister();
    setBusy(false);
    setOrder({ orderId: null, pending: true });
    setStep("done");
  };

  // Paid tickets (live only) hand off to Stripe Hosted Checkout — the buyer
  // leaves this page and returns to it (?session_id=…) once payment completes.
  // Registration questions/offering selections ride along as checkout metadata
  // so the return trip can file the same registration record `doRegister`
  // would have, without asking the buyer to re-enter anything.
  const startStripeCheckout = async () => {
    if (!live) {
      // Preview — nothing to charge; demonstrate the confirmation directly.
      await finalize();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketName: ticket?.name,
          ticketPrice: price,
          quantity: qty,
          addonUnit,
          name,
          email,
          selections: buildSelections(),
          answers,
          formId: event.formId || null,
          returnUrl: window.location.href.split("?")[0],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setRedirectUrl(data.url);
        return;
      }
      setBusy(false);
      setErrorMsg(data.error || "Something went wrong starting checkout.");
      setStep("error");
    } catch {
      setBusy(false);
      setErrorMsg("Something went wrong starting checkout.");
      setStep("error");
    }
  };

  const submitDetails = () => {
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }
    const missing = offerings.find(
      (o) => o.required && o.selectionType === "single" && !selections[o.id],
    );
    if (missing) {
      toast.error(`Please choose an option for ${missing.name}.`);
      return;
    }
    const missingQ = regQuestions.find((q) => {
      if (!q.required) return false;
      const v = answers[q.id];
      return v === undefined || v === "" || v === false;
    });
    if (missingQ) {
      toast.error(`Please answer "${missingQ.label}".`);
      return;
    }
    if (requiresApproval) {
      // Request to register — no payment, lands as Pending for approval.
      requestApproval();
    } else if (isFree) {
      finalize();
    } else if (event.payments?.enabled === false) {
      toast.error("Online payments are currently disabled for this event.");
    } else {
      startStripeCheckout();
    }
  };

  const headerLabel =
    step === "done"
      ? regStatus === "Pending"
        ? "Registration received"
        : regStatus === "Waitlisted"
          ? "You're on the waitlist"
          : "Order confirmed"
      : step === "error"
        ? "Checkout"
        : "Get tickets";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

        {/* Body scrolls within the fixed-height dialog; the header stays put. */}
        <div className="-mr-3 flex-1 overflow-y-auto pr-3">
        {/* Step: details */}
        {step === "details" ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {ticket?.name || "General Admission"}
                </p>
                {ticket?.note ? (
                  <p className="text-xs text-text-secondary">{ticket.note}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                {isFree ? "Free" : `$${price}`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Quantity
              </span>
              <QtyStepper qty={qty} setQty={setQty} max={maxQty} accent={accent} />
            </div>
<div className="border-t border-border"></div>
            {offerings.length ? (
              <div className="space-y-4 ">
                {offerings.map((o) => (
                  <div key={o.id} className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-foreground w-full flex items-center">
                        {o.name}
                        {o.required ? (
                          <span className="ml-1 text-red-400">*</span>
                        ) : null}
                        <span className="ml-auto text-xs font-normal text-text-tertiary">
                          {o.selectionType === "multiple"
                            ? "Choose any"
                            : o.required
                              ? ""
                              : "Optional"}
                        </span>
                      </p>
                      {o.description ? (
                        <p className="text-xs text-text-secondary mt-1 mb-1">
                          {o.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 mt-1 pt-2 pb-2">
                      {o.options.map((opt) => {
                        const selected = isChosen(o, opt.id);
                        const free = !(Number(opt.price) > 0);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              o.selectionType === "single"
                                ? selectSingle(o, opt.id)
                                : toggleMultiple(o.id, opt.id)
                            }
                            style={
                              selected ? { borderColor: accent.color } : undefined
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                              selected
                                ? "bg-surface-card"
                                : "border-border bg-transparent hover:bg-surface-card",
                            )}
                          >
                            <span
                              style={
                                selected
                                  ? {
                                      backgroundColor: accent.color,
                                      borderColor: accent.color,
                                    }
                                  : undefined
                              }
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center border",
                                o.selectionType === "single"
                                  ? "rounded-full"
                                  : "rounded",
                                selected ? "" : "border-[#444]",
                              )}
                            >
                              {selected ? (
                                <Check
                                  className="h-3 w-3"
                                  style={{ color: accent.text }}
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 text-sm text-foreground">
                              {opt.label}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-sm font-medium tabular-nums",
                                free ? "text-text-secondary" : "text-white",
                              )}
                            >
                              {free ? "Free" : `+$${Number(opt.price)}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

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
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {/* Event's registration questions (custom questions tab). */}
              {regQuestions.map((q) => {
                const val = answers[q.id];
                if (q.type === "checkbox") {
                  return (
                    <label
                      key={q.id}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground"
                    >
                      <Checkbox
                        checked={!!val}
                        onCheckedChange={(v) => setAnswer(q.id)(!!v)}
                      />
                      {q.label}
                      {q.required ? (
                        <span className="text-red-400">*</span>
                      ) : null}
                    </label>
                  );
                }
                return (
                  <div key={q.id} className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      {q.label}
                      {q.required ? (
                        <span className="ml-1 text-red-400">*</span>
                      ) : null}
                    </label>
                    {q.type === "long" ? (
                      <Textarea
                        rows={2}
                        value={val || ""}
                        onChange={(e) => setAnswer(q.id)(e.target.value)}
                      />
                    ) : (
                      <Input
                        type={q.type === "number" ? "number" : "text"}
                        value={val || ""}
                        onChange={(e) => setAnswer(q.id)(e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4">
              {addonUnit > 0 ? (
                <div className="mb-2 space-y-1 text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>
                      Tickets ({qty} × ${price})
                    </span>
                    <span className="tabular-nums">${price * qty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Add-ons ({qty} × ${addonUnit})
                    </span>
                    <span className="tabular-nums">${addonUnit * qty}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Total</span>
                <span className="text-lg font-bold tabular-nums text-white">
                  {total === 0 ? "Free" : `$${total}`}
                </span>
              </div>
            </div>
            <Button
              style={accentStyle}
              className="w-full hover:opacity-90"
              disabled={busy}
              onClick={submitDetails}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : requiresApproval ? (
                "Request to register"
              ) : isFree ? (
                "Complete registration"
              ) : (
                <>
                  Continue to payment <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {!isFree && !requiresApproval ? (
              <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
                <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Step: done — copy adapts to the resulting registration status. */}
        {step === "done" ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                regStatus === "Pending"
                  ? "bg-amber-500/10 text-amber-400"
                  : regStatus === "Waitlisted"
                    ? "bg-violet-500/10 text-violet-300"
                    : "bg-emerald-500/10 text-emerald-400",
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
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">
                {regStatus === "Pending"
                  ? "Registration received"
                  : regStatus === "Waitlisted"
                    ? "You're on the waitlist"
                    : "You're going!"}
              </p>
              <p className="text-sm text-text-secondary">
                {regStatus === "Pending"
                  ? `Your registration for ${event.name} is pending approval.${email ? ` We'll email ${email} once it's reviewed.` : ""}`
                  : regStatus === "Waitlisted"
                    ? `${event.name} is full — we've added you to the waitlist${email ? ` and will email ${email} if a spot opens` : ""}.`
                    : `${qty} × ${doneTicketName || ticket?.name} for ${event.name}.${email ? ` A confirmation is on its way to ${email}.` : ""}`}
              </p>
            </div>
            {order?.preview ? (
              <Badge variant="neutral">Preview — nothing saved</Badge>
            ) : regStatus === "Pending" ? (
              <Badge variant="warning">Pending review</Badge>
            ) : regStatus === "Waitlisted" ? (
              <Badge variant="purple">Waitlisted</Badge>
            ) : order?.orderId ? (
              <span className="rounded-md border border-border bg-surface-card px-2.5 py-1 font-mono text-xs text-text-secondary">
                Order #{String(order.orderId).slice(0, 8)}
              </span>
            ) : null}
            <Button
              style={accentStyle}
              className="w-full hover:opacity-90"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : null}

        {/* Step: error */}
        {step === "error" ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                style={accentStyle}
                className="flex-1 hover:opacity-90"
                onClick={() => setStep("details")}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The shared, chrome-less public page body. Rendered both inside the editor
// preview overlay and on the standalone /e/[id] published route. `live` enables
// real ticket purchases (DB-backed); the editor preview leaves it off.
export function EventPublicPageContent({ event, design, live = false }) {
  const tickets = buildTickets(event);
  const [selected, setSelected] = useState(Math.min(1, tickets.length - 1));
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // After a live purchase the RPC returns the new sold count; reflect it so the
  // remaining counter and sold-out state update without a page reload.
  const [soldOverride, setSoldOverride] = useState(null);
  // Set once, on mount, when the buyer just landed back from Stripe Checkout.
  const [resumeResult, setResumeResult] = useState(null);

  // Confirm a Stripe redirect return (?session_id=) or note a cancellation
  // (?canceled=1), then strip the query string so a refresh doesn't re-verify.
  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");
    if (sessionId) {
      fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.sold === "number") setSoldOverride(data.sold);
          setResumeResult({
            ok: Boolean(data.ok),
            orderId: data.orderId,
            error: data.error,
            ticket: data.ticket,
            quantity: data.quantity,
            name: data.name,
            email: data.email,
          });
          setCheckoutOpen(true);
        })
        .catch(() => {
          setResumeResult({ ok: false, error: "Couldn't confirm your payment." });
          setCheckoutOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, "", window.location.pathname);
        });
    } else if (canceled) {
      toast.error("Checkout canceled — you haven't been charged.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Runs once on mount, right after a Stripe redirect back to this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Standard mode always renders the tuned default look, regardless of any
  // saved theme tweaks. Themed honors the saved brand theme.
  const cfg = design || defaultPageDesign();
  const effective = cfg.mode === "standard" ? defaultPageDesign() : cfg;
  const themed = cfg.mode === "themed";
  // The brand theme compiles to CSS-variable overrides on the page wrapper, so
  // the markup below re-skins automatically. The accent (brand) color drives the
  // inline CTA styles shared with checkout, ticket selection, etc.
  const theme = resolveTheme(effective);
  const accent = themeAccent(theme);
  const fontClass = resolveFont(effective.font).className;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };
  const wrapperStyle = themed ? themeStyle(theme) : undefined;
  const contentWidth = themed ? resolveWidth(theme) : "72rem";

  const [y, m, d] = event.date.split("-").map(Number);
  const soldCount = soldOverride ?? event.sold;
  const remaining = Math.max(0, event.capacity - soldCount);
  const soldOut = event.capacity > 0 && remaining <= 0;
  const gallery = Array.isArray(event.gallery) ? event.gallery : [];
  const regQuestions =
    Array.isArray(event.questions) && event.questions.length
      ? event.questions.map((q) => q.label).filter(Boolean)
      : REG_QUESTIONS;
  const TypeIcon = TYPE_ICON[event.type] || MapPin;
  const tags =
    Array.isArray(event.tags) && event.tags.length
      ? event.tags
      : [event.type, "Community", "Networking"];
  // Real co-hosts come from the event's team (people who actually run it);
  // fall back to the demo names only when no team has been configured.
  const teamHosts = Array.isArray(event.team)
    ? event.team
        .filter((m) => ["Owner", "Admin", "Co-host"].includes(m.role))
        .map((m) => m.name)
        .filter(Boolean)
    : [];
  const coHosts = teamHosts.length ? teamHosts : CO_HOSTS;
  // Organizer first, then co-hosts — de-duplicated so an organizer who is also
  // listed as a co-host doesn't appear twice (and won't collide on React keys).
  const hosts = [event.organizer, ...coHosts].filter(
    (h, i, arr) => h && arr.indexOf(h) === i,
  );
  // Default display language from the event's localization config.
  const language =
    Array.isArray(event.languages) && event.languages.length
      ? (event.languages.find((l) => l.isDefault) || event.languages[0]).name
      : "English";

  // Cover surface honors the chosen cover style (from the brand theme).
  let coverClass = "bg-gradient-to-br from-surface-active to-surface-subtle";
  let coverStyle;
  if (theme.cover === "solid") {
    coverClass = "";
    coverStyle = { backgroundColor: "var(--surface-dialog)" };
  } else if (theme.cover === "accent") {
    coverClass = "";
    coverStyle = {
      backgroundImage: `linear-gradient(135deg, ${accent.color}33, ${theme.colors.surface})`,
    };
  }

  const orderedBlocks = effective.blocks.filter((b) => b.visible);

  return (
    <div
      className={cn(
        "text-foreground",
        themed ? "ev-themed min-h-screen bg-background" : fontClass,
      )}
      style={wrapperStyle}
    >
      <div
        className="mx-auto px-4 py-12 sm:px-6 lg:px-8"
        style={{ maxWidth: contentWidth }}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
          {/* Main column */}
          <div className="min-w-0 space-y-10">
            {/* Cover + gallery */}
            <div className="space-y-3">
              <div
                className={cn(
                  "relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-border text-[#3a3a3a]",
                  event.coverUrl ? "" : coverClass,
                )}
                style={event.coverUrl ? undefined : coverStyle}
              >
                {event.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverUrl}
                    alt={`${event.name} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12" />
                )}
                <div className="absolute left-4 top-4 flex gap-2">
                  <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
                    <TypeIcon className="h-3 w-3" />
                    {event.type}
                  </Badge>
                </div>
              </div>
              {effective.showGallery && gallery.length ? (
                <div className="grid grid-cols-4 gap-3">
                  {gallery.slice(0, 8).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              ) : effective.showGallery ? (
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-surface-card text-[#3a3a3a]"
                    >
                      <ImgIcon className="h-5 w-5" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Title + meta + tags (core) */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {event.name}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-text-secondary" />
                  {formatDate(event.date)} · {event.time}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-text-secondary" />
                  {event.venue}
                  {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
                </span>
              </div>
            </div>

            {/* Hosts (core) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-5">
              {hosts.map((h, i) => (
                <div key={h} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarFallback className="bg-surface-card text-sm text-muted-foreground">
                      {initials(h)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-text-secondary">
                      {i === 0 ? "Hosted by" : "Co-host"}
                    </p>
                    <p className="text-sm font-medium text-foreground">{h}</p>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground sm:ml-auto"
                onClick={() => toast.success(`Following ${event.organizer}.`)}
              >
                Follow
              </Button>
            </div>

            {/* Ordered, toggleable content blocks */}
            {orderedBlocks.map((b) => (
              <PageBlock key={b.id} block={b} event={event} accent={accent} />
            ))}
          </div>

          {/* Registration sidebar */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface-subtle">
              <div className="flex items-center gap-3 border-b border-border p-4">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-border bg-surface-card">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {MONTHS[m - 1]}
                  </span>
                  <span className="text-lg font-bold leading-none text-white">
                    {d}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(event.date)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {event.time} · {y}
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                  Select ticket
                </p>
                {tickets.map((t, i) => {
                  const isActive = selected === i;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelected(i)}
                      style={isActive ? { borderColor: accent.color } : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        isActive
                          ? "bg-surface-card"
                          : "border-border bg-transparent hover:bg-surface-card",
                      )}
                    >
                      <span
                        style={
                          isActive
                            ? { backgroundColor: accent.color, borderColor: accent.color }
                            : undefined
                        }
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          isActive ? "" : "border-[#444]",
                        )}
                      >
                        {isActive ? (
                          <Check className="h-3 w-3" style={{ color: accent.text }} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {t.name}
                        </span>
                        {t.note ? (
                          <span className="block text-xs text-text-secondary">
                            {t.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                        {t.price === 0 ? "Free" : `$${t.price}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-border p-4">
                <Button
                  style={soldOut ? undefined : accentStyle}
                  disabled={soldOut}
                  className="w-full hover:opacity-90 disabled:opacity-60"
                  onClick={() => setCheckoutOpen(true)}
                >
                  {soldOut ? (
                    "Sold out"
                  ) : (
                    <>
                      {tickets[selected].price === 0 ? "Register" : "Get tickets"}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
                  <Ticket className="h-3.5 w-3.5" />
                  {remaining > 0
                    ? `${remaining.toLocaleString()} tickets remaining`
                    : "Sold out"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => toast.success("Added to calendar.")}
                  >
                    <CalendarCheck className="h-4 w-4" /> Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => toast.success("Share link copied.")}
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Good to know */}
            <div className="rounded-2xl border border-border bg-surface-subtle p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Good to know
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <TypeIcon className="h-4 w-4" /> Format
                  </span>
                  <span className="text-muted-foreground">{event.type}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <Gauge className="h-4 w-4" /> Capacity
                  </span>
                  <span className="text-muted-foreground">
                    {event.capacity.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <Languages className="h-4 w-4" /> Language
                  </span>
                  <span className="text-muted-foreground">{language}</span>
                </div>
              </div>
            </div>

            {/* What you'll be asked */}
            <div className="rounded-2xl border border-border bg-surface-subtle p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> At registration
              </p>
              <ul className="space-y-2">
                {regQuestions.map((q) => (
                  <li
                    key={q}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#525252]" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-tertiary">
              <Image
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`}
                alt="Geiger"
                width={12}
                height={12}
              />
              Powered by Geiger Events
            </p>
          </div>
        </div>
      </div>

      <TicketCheckout
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setResumeResult(null);
        }}
        event={event}
        ticket={tickets[selected]}
        remaining={remaining}
        live={live}
        accent={accent}
        resumeResult={resumeResult}
        onPurchased={(res) => {
          if (typeof res.sold === "number") setSoldOverride(res.sold);
        }}
      />
    </div>
  );
}

// Full-screen overlay used inside the editor for live (unsaved-design) preview.
// Pushes a history entry on open so the browser Back button closes the preview
// instead of leaving the dashboard — the bug where Back dropped you on the
// landing page.
export function EventPublicPage({ event, onClose, design }) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.history.pushState({ geigerPreview: true }, "");
    const onPop = () => onClose?.();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  if (!event) return null;

  const mode = (design || defaultPageDesign()).mode;

  // Route Back through history so the in-page button and the browser Back
  // button share one path (the popstate handler calls onClose).
  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history.state &&
      window.history.state.geigerPreview
    ) {
      window.history.back();
    } else {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      {/* Preview chrome */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> Public page preview
          {mode !== "standard" ? (
            <span className="capitalize text-text-tertiary">· {mode}</span>
          ) : null}
        </span>
      </div>
      <EventPublicPageContent event={event} design={design} />
    </div>
  );
}

export default EventPublicPage;
