"use client";

import React, { useEffect, useState } from "react";
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
  Users,
  Phone,
  Mail,
  Navigation,
  ExternalLink,
  SquareParking,
  Accessibility,
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
  resolveHero,
  resolveSidebar,
  themeButtonStyle,
  coverOverlayStyle,
} from "@/lib/events/theme";
import { PageBlock } from "./page_blocks";
import { PageFooter } from "./page_footer";
import { buyTicket } from "@/lib/supabase/orders";
import {
  registerForEvent,
  hasWaitlistedRegistration,
} from "@/lib/supabase/registrations";
import { getVenue } from "@/lib/supabase/venues";
import {
  AMENITY_LABEL,
  AMENITIES,
  venueCapacity,
  venueLocation,
  VENUE_TYPE_MAP,
} from "../venues/constants";
import { getUser } from "@/lib/supabase/user";
import {
  splitRegistrationAnswers,
  DIETARY_ANSWER_PREFIX,
} from "@/lib/events/registration_answers";
import {
  getPublicDietaryConfig,
  submitDietaryRequest,
} from "@/lib/supabase/dietary";
import { GUIDELINE_CATEGORY_MAP } from "../registrations/constants";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const CO_HOSTS = ["Marco Reyes", "Priya Shah"];
const REG_QUESTIONS = ["Full name", "Dietary requirements", "T-shirt size"];
const TYPE_ICON = { "In-person": MapPin, Online: Video, Hybrid: Globe };
// amenity key -> lucide icon, so the venue dialog can show each amenity with its
// own glyph instead of a flat text badge.
const AMENITY_ICON = Object.fromEntries(AMENITIES.map((a) => [a.key, a.icon]));

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
      // Keep the stable tier id so checkout can enforce this tier's inventory.
      id: t.id ?? null,
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

// One line in the confirmation "receipt" — an icon, a label, and a right-aligned
// value. Keeps the done step legible and scannable.
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
  // Set when the guest arrived from an approval email (?approved=1): opens at
  // details with contact prefilled and skips filing a second registration (they
  // were already approved). `{ name, email }` or null.
  approvedResume,
  // The project's public Dietary & Accessibility config (inquiry questions +
  // requests master switch). Null until fetched; may be null if unconfigured.
  daConfig,
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
        setName(approvedResume?.name || "");
        setEmail(approvedResume?.email || "");
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
  // Optional policy: one entry per guest while waitlisted (blocks re-booking).
  const blockWaitlistedRebook = !!rsvpCfg.blockWaitlistedRebook;
  // The event's custom questions, minus the name/email we already collect.
  const regQuestions = (Array.isArray(event.questions) ? event.questions : [])
    .filter((q) => q && q.label)
    .filter((q) => !/^(full\s*)?name$|^e-?mail$/i.test(q.label.trim()));
  const setAnswer = (id) => (value) =>
    setAnswers((a) => ({ ...a, [id]: value }));
  // Structured Dietary & Accessibility inquiry (radio/multiselect) attached to
  // this event's ticket form. Answers are keyed with the dietary: prefix so they
  // ride the answers bag without colliding with custom questions.
  const inquiryQuestions =
    event.dietaryInquiry?.attach && Array.isArray(daConfig?.questions)
      ? daConfig.questions
      : [];
  const inquiryKey = (q) => `${DIETARY_ANSWER_PREFIX}${q.id}`;
  const toggleInquiryMulti = (q, label) =>
    setAnswers((a) => {
      const key = inquiryKey(q);
      const arr = Array.isArray(a[key]) ? a[key] : [];
      return {
        ...a,
        [key]: arr.includes(label)
          ? arr.filter((x) => x !== label)
          : [...arr, label],
      };
    });
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
      // This registration is always filed after a successful buy_ticket (free or
      // paid), which already enforced capacity — don't re-gate it here.
      enforceCapacity: false,
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
      ticketId: ticket?.id ?? null,
      price,
      quantity: qty,
      addons: addonUnit,
      selections: buildSelections(),
    });
    if (res.ok) {
      // The order is recorded; also write the person-coming record so they
      // appear in the RSVPs / Waitlist / Approval screens. Skip it when the guest
      // came from an approval link — they're already an approved registration and
      // a second one would duplicate them on the guest list.
      if (approvedResume) setRegStatus("Confirmed");
      else await doRegister();
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketName: ticket?.name,
          ticketId: ticket?.id ?? null,
          ticketPrice: price,
          quantity: qty,
          addonUnit,
          name,
          email,
          selections: buildSelections(),
          answers,
          formId: event.formId || null,
          // Approved guests are already a registration — skip filing a second
          // one when their payment is confirmed on return.
          skipRegistration: !!approvedResume,
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

  const submitDetails = async () => {
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
    const missingInq = inquiryQuestions.find((q) => {
      if (!q.required) return false;
      const v = answers[inquiryKey(q)];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === "";
    });
    if (missingInq) {
      toast.error(`Please answer "${missingInq.label}".`);
      return;
    }
    // Policy: if this guest is already waitlisted, don't let them book again.
    if (live && blockWaitlistedRebook) {
      setBusy(true);
      const already = await hasWaitlistedRegistration(event.id, email);
      setBusy(false);
      if (already) {
        toast.error(
          "You're already on the waitlist for this event — you can't book again.",
        );
        return;
      }
    }
    if (requiresApproval && !approvedResume) {
      // Request to register — no payment, lands as Pending for approval.
      requestApproval();
    } else if (isFree) {
      // Already-approved guests (approvedResume) and free events settle here —
      // no charge, straight to a confirmed spot.
      finalize();
    } else if (event.payments?.enabled === false) {
      toast.error("Online payments are currently disabled for this event.");
    } else {
      // Approved guests paying for their spot land here too (approval already
      // granted, so we skip the request-approval branch above).
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
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

        {/* Body scrolls within the fixed-height dialog; the header stays put.
            Scrollbar hidden (suite convention) so it doesn't clutter the form. */}
        <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Step: details */}
        {step === "details" ? (
          <div className="grid gap-4">
            {approvedResume ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm text-foreground">
                  You&apos;re approved for{" "}
                  <span className="font-medium">{event.name}</span> — complete
                  your ticket below to secure your spot.
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

              {/* Dietary & Accessibility inquiry (attached radio/multiselect). */}
              {inquiryQuestions.length ? (
                <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-3">
                  {daConfig?.inquiryTitle ? (
                    <p className="text-sm font-semibold text-foreground">
                      {daConfig.inquiryTitle}
                    </p>
                  ) : null}
                  {daConfig?.inquiryDescription ? (
                    <p className="-mt-1 text-xs text-text-secondary">
                      {daConfig.inquiryDescription}
                    </p>
                  ) : null}
                  {inquiryQuestions.map((q) => {
                    const key = inquiryKey(q);
                    const val = answers[key];
                    return (
                      <div key={q.id} className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">
                          {q.label}
                          {q.required ? (
                            <span className="ml-1 text-red-400">*</span>
                          ) : null}
                        </label>
                        <div className="flex flex-col gap-1.5">
                          {(q.options || []).map((opt) => {
                            const checked =
                              q.type === "multiselect"
                                ? Array.isArray(val) && val.includes(opt.label)
                                : val === opt.label;
                            return (
                              <label
                                key={opt.id}
                                className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground"
                              >
                                {q.type === "multiselect" ? (
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() =>
                                      toggleInquiryMulti(q, opt.label)
                                    }
                                  />
                                ) : (
                                  <span
                                    role="radio"
                                    aria-checked={checked}
                                    tabIndex={0}
                                    onClick={() => setAnswer(key)(opt.label)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setAnswer(key)(opt.label);
                                      }
                                    }}
                                    className={cn(
                                      "flex h-4 w-4 items-center justify-center rounded-full border",
                                      checked
                                        ? "border-transparent"
                                        : "border-border-strong",
                                    )}
                                    style={
                                      checked
                                        ? { backgroundColor: accent.color }
                                        : undefined
                                    }
                                  >
                                    {checked ? (
                                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    ) : null}
                                  </span>
                                )}
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
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
              ) : requiresApproval && !approvedResume ? (
                "Request to register"
              ) : isFree ? (
                "Complete registration"
              ) : (
                <>
                  Continue to payment <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {!isFree && !(requiresApproval && !approvedResume) ? (
              <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
                <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Step: done — copy adapts to the resulting registration status. */}
        {step === "done" ? (
          (() => {
            const isConfirmed =
              regStatus !== "Pending" && regStatus !== "Waitlisted";
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
                  <p className="text-xl font-semibold text-white">
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

                {/* Receipt — the key facts, scannable at a glance. */}
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

                {/* Post-purchase Dietary & Accessibility request — master switch
                    (project) AND this event's opt-in must both be on. */}
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
              </div>
            );
          })()
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

// Venue detail, opened by clicking the venue line on the public page. Fetches
// the managed venue by id (public read RLS allows it); falls back to the event's
// text snapshot in preview / no-DB mode so it always shows something.
function VenueDetailsDialog({ open, onClose, venueId, fallback, accent }) {
  // null until the fetch resolves; the loaded venue is keyed by id so a fetch
  // for a different venue re-loads. `loaded` distinguishes "not fetched yet"
  // from "fetched, no managed row" (falls back to the event snapshot).
  const [venue, setVenue] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    getVenue(venueId).then((v) => {
      if (!alive) return;
      setVenue(v);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [open, venueId]);

  const v = venue || fallback;
  const cap = venueCapacity(v);
  const fullAddress = [v?.address, v?.city, v?.postcode, v?.country]
    .filter(Boolean)
    .join(", ");
  const mapHref =
    v?.latitude != null && v?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`
      : fullAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        : null;
  const amenities = Array.isArray(v?.amenities) ? v.amenities : [];
  const seated = Number(v?.seatedCapacity) || 0;
  const standing = Number(v?.standingCapacity) || 0;
  const location = venueLocation(v);
  const contacts = [
    v?.contactPhone ? { icon: Phone, label: v.contactPhone, href: `tel:${v.contactPhone}` } : null,
    v?.contactEmail ? { icon: Mail, label: v.contactEmail, href: `mailto:${v.contactEmail}` } : null,
    v?.website ? { icon: Globe, label: v.website.replace(/^https?:\/\//, ""), href: v.website } : null,
  ].filter(Boolean);
  // Getting-there / parking notes, rendered as icon + labeled-block rows.
  const notes = [
    v?.transitNotes ? { icon: Navigation, label: "Getting there", text: v.transitNotes } : null,
    v?.parkingNotes ? { icon: SquareParking, label: "Parking", text: v.parkingNotes } : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{v?.name || "Venue"}</DialogTitle>
            {v?.type ? (
              <Badge variant={VENUE_TYPE_MAP[v.type]?.variant || "neutral"}>
                {v.type}
              </Badge>
            ) : null}
          </div>
          <DialogDescription>{location || "Venue details"}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!loaded && !venue ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading venue…
            </div>
          ) : (
            <>
              {v?.coverUrl ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.coverUrl}
                    alt={`${v.name} cover`}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
              ) : null}

              {v?.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {v.description}
                </p>
              ) : null}

              {/* Address — full width, left-aligned so long addresses wrap
                  legibly instead of squishing against the right edge. */}
              {fullAddress ? (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Address
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {fullAddress}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Capacity — seated / standing as their own tiles when both are
                  set, otherwise a single combined figure. */}
              {cap ? (
                <div className="grid grid-cols-2 gap-3">
                  {seated && standing ? (
                    <>
                      <CapacityTile label="Seated" value={seated} />
                      <CapacityTile label="Standing" value={standing} />
                    </>
                  ) : (
                    <div className="col-span-2">
                      <CapacityTile label="Capacity" value={cap} />
                    </div>
                  )}
                </div>
              ) : null}

              {amenities.length ? (
                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Amenities
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {amenities.map((a) => {
                      const Icon = AMENITY_ICON[a] || Check;
                      return (
                        <div
                          key={a}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-muted-foreground"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                          <span className="min-w-0 truncate">
                            {AMENITY_LABEL[a] || a}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {notes.length ? (
                <div className="space-y-3">
                  {notes.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div key={n.label} className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                            {n.label}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {n.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {contacts.length ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
                  {contacts.map((c) => {
                    const Icon = c.icon;
                    return (
                      <a
                        key={c.label}
                        href={c.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                        <span className="min-w-0 truncate">{c.label}</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>

        {mapHref ? (
          <div className="shrink-0 pt-2">
            <Button
              asChild
              className="w-full hover:opacity-90"
              style={{ backgroundColor: accent.color, color: accent.text }}
            >
              <a href={mapHref} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" /> Get directions
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// A single capacity figure — big number over a small label — for the venue
// dialog's capacity tiles.
function CapacityTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <Users className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// The shared, chrome-less public page body. Rendered both inside the editor
// preview overlay and on the standalone /e/[id] published route. `live` enables
// real ticket purchases (DB-backed); the editor preview leaves it off.
// Post-purchase communication request shown on the order-success step. Files a
// free-text dietary/accessibility query against the event (no submission before
// a completed sign-up). In preview (!live) it just simulates.
function PostPurchaseRequest({ event, name, email, prompt, accentStyle, live }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast.error("Type your request first.");
      return;
    }
    setSending(true);
    if (!live) {
      setSending(false);
      setSent(true);
      toast.success("Request sent.");
      return;
    }
    const res = await submitDietaryRequest({
      eventId: event.id,
      name,
      email,
      message,
    });
    setSending(false);
    if (res) {
      setSent(true);
      toast.success("Request sent to the organizer.");
    } else {
      toast.error("Couldn't send your request.");
    }
  };

  if (sent) {
    return (
      <div className="w-full rounded-xl border border-border bg-surface-card p-3 text-left text-sm text-text-secondary">
        Thanks — we&apos;ve shared your request with the organizer.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-border bg-surface-card p-3 text-left">
      <p className="text-sm font-medium text-foreground">
        Dietary or accessibility need?
      </p>
      {prompt ? <p className="text-xs text-text-secondary">{prompt}</p> : null}
      <Textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Let the organizer know…"
      />
      <Button
        style={accentStyle}
        className="w-full hover:opacity-90"
        disabled={sending}
        onClick={submit}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {sending ? "Sending…" : "Send request"}
      </Button>
    </div>
  );
}

export function EventPublicPageContent({ event, design, live = false }) {
  const tickets = buildTickets(event);
  const [selected, setSelected] = useState(Math.min(1, tickets.length - 1));
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // After a live purchase the RPC returns the new sold count; reflect it so the
  // remaining counter and sold-out state update without a page reload.
  const [soldOverride, setSoldOverride] = useState(null);
  // Set once, on mount, when the buyer just landed back from Stripe Checkout.
  const [resumeResult, setResumeResult] = useState(null);
  // Set on mount when arriving from an approval email (?approved=1) — carries the
  // prefilled contact so checkout opens ready to pay.
  const [approvedResume, setApprovedResume] = useState(null);
  // The venue-detail dialog, opened by clicking the venue line.
  const [venueOpen, setVenueOpen] = useState(false);
  // Project D&A config (inquiry + requests) and the linked venue's row, fetched
  // for the public guidelines block + ticket-form inquiry. Both anon-readable.
  const [daConfig, setDaConfig] = useState(null);
  const [venueData, setVenueData] = useState(null);
  useEffect(() => {
    let alive = true;
    if (event.projectId) {
      getPublicDietaryConfig(event.projectId).then(
        (c) => alive && setDaConfig(c),
      );
    }
    if (event.venueId) {
      getVenue(event.venueId).then((v) => alive && setVenueData(v));
    }
    return () => {
      alive = false;
    };
  }, [event.projectId, event.venueId]);

  // Venue guidelines first, then the event's own — both shown (the event adds
  // to, doesn't replace, the venue's).
  const guidelines = [
    ...(Array.isArray(venueData?.guidelines) ? venueData.guidelines : []),
    ...(Array.isArray(event.guidelines) ? event.guidelines : []),
  ].filter((g) => g && g.label);

  // Confirm a Stripe redirect return (?session_id=) or note a cancellation
  // (?canceled=1), then strip the query string so a refresh doesn't re-verify.
  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");
    if (sessionId) {
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
      )
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
    } else if (params.get("approved")) {
      // Arrived from an approval email — open checkout straight to the details/
      // payment step, prefilled, so the approved guest can secure their spot.
      const contact = {
        name: params.get("name") || "",
        email: params.get("email") || "",
      };
      window.history.replaceState({}, "", window.location.pathname);
      // Defer out of the effect body (avoids synchronous setState-in-effect) so
      // the dialog's open transition still fires its prefill/reset.
      Promise.resolve().then(() => {
        setApprovedResume(contact);
        setCheckoutOpen(true);
      });
    }
    // Runs once on mount, right after a Stripe redirect back to this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Standard mode always renders the tuned default look, regardless of any
  // saved theme tweaks. Themed honors the saved brand theme. Merge over the
  // defaults so a partial or hand-authored pageDesign (e.g. one missing
  // `blocks`/`showGallery`) can never crash the renderer.
  const defaults = defaultPageDesign();
  const cfg = design ? { ...defaults, ...design } : defaults;
  const effective = cfg.mode === "standard" ? defaults : cfg;
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
  const selectedTicket = tickets[selected] || tickets[0] || null;
  // Per-tier sold counts (system counter, kept separate from the editable tiers).
  const tierSold =
    event.ticketSold && typeof event.ticketSold === "object"
      ? event.ticketSold
      : {};
  // Event-level remaining (base capacity; 0 = unlimited). The overbook buffer is
  // a private allowance and is deliberately not advertised on the public page.
  const eventRemaining =
    event.capacity > 0 ? Math.max(0, event.capacity - soldCount) : Infinity;
  // Selected tier's own remaining (qty 0 = unlimited).
  const tierQty = Number(selectedTicket?.qty) || 0;
  const tierRemaining =
    tierQty > 0
      ? Math.max(0, tierQty - (Number(tierSold[selectedTicket?.id]) || 0))
      : Infinity;
  const remaining = Math.min(eventRemaining, tierRemaining);
  const soldOut = Number.isFinite(remaining) && remaining <= 0;
  // The stepper's upper bound (finite; unlimited falls back to a sane cap).
  const checkoutRemaining = Number.isFinite(remaining) ? remaining : 9999;
  // "Show tickets remaining" toggle (Registration Settings). Default on.
  const showRemaining = event.regSettings?.showRemaining !== false;
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

  // Header/hero + sidebar arrangement (Themed only; Standard stays classic).
  const hero = themed ? resolveHero(theme) : "classic";
  const sidebarLeft = themed && resolveSidebar(theme) === "left";
  const primaryBtnStyle = themed ? themeButtonStyle(theme, accent) : accentStyle;
  // Content-column rhythm follows the brand spacing (theme.density) when themed.
  const sectionGapStyle = themed
    ? { gap: "var(--ev-section-gap, 2.75rem)" }
    : undefined;
  // A banner hero always keeps at least a light scrim so overlaid text is legible.
  const bannerOverlay =
    coverOverlayStyle(theme, accent) ||
    (hero === "banner"
      ? {
          backgroundImage:
            "linear-gradient(to top, rgb(0 0 0 / 0.6), transparent 70%)",
        }
      : null);

  // Cover image contents, reused by the in-column cover and the banner hero.
  const coverInner = event.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.coverUrl}
      alt={`${event.name} cover`}
      className="h-full w-full object-cover"
    />
  ) : (
    <ImageIcon className="h-12 w-12" />
  );

  // Title / meta / tags — `centered` centers everything (centered hero).
  const titleMeta = (centered) => (
    <div className={cn("space-y-4", centered && "text-center")}>
      <div className={cn("flex flex-wrap gap-2", centered && "justify-center")}>
        {tags.map((t) => (
          <Badge key={t} variant="neutral">
            {t}
          </Badge>
        ))}
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {event.name}
      </h1>
      <div
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground",
          centered && "justify-center",
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-text-secondary" />
          {formatDate(event.date)} · {event.time}
        </span>
        {event.venueId ? (
          <button
            type="button"
            onClick={() => setVenueOpen(true)}
            className="flex items-center gap-2 text-left transition-colors hover:text-foreground"
          >
            <MapPin className="h-4 w-4 text-text-secondary" />
            <span className="underline decoration-dotted underline-offset-4">
              {event.venue}
              {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-text-secondary" />
            {event.venue}
            {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
          </span>
        )}
      </div>
    </div>
  );

  // Gallery thumbnail strip (or placeholders), shared by column + banner heroes.
  const galleryStrip =
    effective.showGallery && gallery.length ? (
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
    ) : null;

  // In-column cover + gallery strip (classic / centered heroes).
  const coverWrap = (
    <div className="space-y-3">
      <div
        className={cn(
          "relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-border text-[#3a3a3a]",
          event.coverUrl ? "" : coverClass,
        )}
        style={event.coverUrl ? undefined : coverStyle}
      >
        {coverInner}
        <div className="absolute left-4 top-4 flex gap-2">
          <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
            <TypeIcon className="h-3 w-3" />
            {event.type}
          </Badge>
        </div>
      </div>
      {galleryStrip}
    </div>
  );

  const hostsBlock = (
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
  );

  // Full-width banner hero — cover with the title/meta overlaid on a scrim.
  const bannerBlock = (
    <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
      <div
        className={cn(
          "relative flex aspect-[21/9] items-center justify-center overflow-hidden text-[#3a3a3a]",
          event.coverUrl ? "" : coverClass,
        )}
        style={event.coverUrl ? undefined : coverStyle}
      >
        {coverInner}
      </div>
      {bannerOverlay ? (
        <div className="pointer-events-none absolute inset-0" style={bannerOverlay} />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <div className="space-y-3">
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
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatDate(event.date)} · {event.time}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.venue}
              {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

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
        {hero === "banner" ? bannerBlock : null}
        <div
          className={cn(
            "grid grid-cols-1 gap-10 lg:gap-16",
            sidebarLeft
              ? "lg:grid-cols-[380px_1fr]"
              : "lg:grid-cols-[1fr_380px]",
          )}
        >
          {/* Main column */}
          <div
            className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
            style={sectionGapStyle}
          >
            {hero === "classic" ? (
              <>
                {coverWrap}
                {titleMeta(false)}
              </>
            ) : null}
            {hero === "centered" ? (
              <>
                {titleMeta(true)}
                {coverWrap}
              </>
            ) : null}
            {hero === "minimal" ? titleMeta(false) : null}
            {hero === "banner" ? galleryStrip : null}

            {hostsBlock}

            {/* Ordered, toggleable content blocks */}
            {orderedBlocks.map((b) => (
              <PageBlock key={b.id} block={b} event={event} accent={accent} />
            ))}
          </div>

          {/* Registration sidebar */}
          <div
            className={cn(
              "space-y-4 lg:sticky lg:top-20 lg:self-start",
              sidebarLeft && "lg:order-first",
            )}
          >
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
                  style={soldOut ? undefined : primaryBtnStyle}
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
                {showRemaining ? (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
                    <Ticket className="h-3.5 w-3.5" />
                    {soldOut
                      ? "Sold out"
                      : Number.isFinite(remaining)
                        ? `${remaining.toLocaleString()} tickets remaining`
                        : "Tickets available"}
                  </p>
                ) : null}
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

            {/* Dietary & Accessibility guidelines (venue + event, merged). */}
            {guidelines.length ? (
              <div className="rounded-2xl border border-border bg-surface-subtle p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Accessibility className="h-4 w-4 text-muted-foreground" />
                  Dietary & Accessibility
                </p>
                <div className="space-y-3">
                  {guidelines.map((g, i) => {
                    const cat = GUIDELINE_CATEGORY_MAP[g.category];
                    return (
                      <div key={g.id || i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          {cat ? (
                            <Badge variant={cat.variant}>{cat.label}</Badge>
                          ) : null}
                          <span className="text-sm font-medium text-foreground">
                            {g.label}
                          </span>
                        </div>
                        {g.detail ? (
                          <p className="text-sm text-text-secondary">
                            {g.detail}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <PageFooter footer={effective.footer} accent={accent} />
      </div>

      <TicketCheckout
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setResumeResult(null);
          setApprovedResume(null);
        }}
        event={event}
        ticket={tickets[selected]}
        remaining={checkoutRemaining}
        live={live}
        accent={accent}
        resumeResult={resumeResult}
        approvedResume={approvedResume}
        daConfig={daConfig}
        onPurchased={(res) => {
          if (typeof res.sold === "number") setSoldOverride(res.sold);
        }}
      />

      <VenueDetailsDialog
        open={venueOpen}
        onClose={() => setVenueOpen(false)}
        venueId={event.venueId}
        accent={accent}
        fallback={{
          name: event.venue,
          address: event.address,
          city: event.city,
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
