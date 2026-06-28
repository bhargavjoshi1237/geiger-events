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
  CreditCard,
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

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const CO_HOSTS = ["Marco Reyes", "Priya Shah"];
const REG_QUESTIONS = ["Full name", "Dietary requirements", "T-shirt size"];
const TYPE_ICON = { "In-person": MapPin, Online: Video, Hybrid: Globe };

// --- Demo checkout card helpers --------------------------------------------

// Detect the card brand from the leading digits as the buyer types.
function detectCardBrand(value) {
  const n = (value || "").replace(/\D/g, "");
  if (!n) return null;
  if (/^4/.test(n)) return "visa";
  if (/^(34|37)/.test(n)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]\d|720))/.test(n)) return "mastercard";
  return null;
}

// Auto-format an expiry as the buyer types: digits only, padded single-digit
// month (5 → 05), then "MM / YY".
function formatExpiry(value) {
  let d = (value || "").replace(/\D/g, "");
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  d = d.slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

// Card-brand wordmarks (SVG Logos by Gil Barbara). Rendered on a white chip so
// each brand keeps its intended contrast against the dark field.
function CardBrandMark({ brand, className }) {
  if (brand === "visa") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 83"
        role="img"
        aria-label="Visa"
      >
        <defs>
          <linearGradient id="card-visa-grad" x1="45.974%" x2="54.877%" y1="-2.006%" y2="100%">
            <stop offset="0%" stopColor="#222357" />
            <stop offset="100%" stopColor="#254aa5" />
          </linearGradient>
        </defs>
        <path
          fill="url(#card-visa-grad)"
          d="M132.397 56.24c-.146-11.516 10.263-17.942 18.104-21.763c8.056-3.92 10.762-6.434 10.73-9.94c-.06-5.365-6.426-7.733-12.383-7.825c-10.393-.161-16.436 2.806-21.24 5.05l-3.744-17.519c4.82-2.221 13.745-4.158 23-4.243c21.725 0 35.938 10.724 36.015 27.351c.085 21.102-29.188 22.27-28.988 31.702c.069 2.86 2.798 5.912 8.778 6.688c2.96.392 11.131.692 20.395-3.574l3.636 16.95c-4.982 1.814-11.385 3.551-19.357 3.551c-20.448 0-34.83-10.87-34.946-26.428m89.241 24.968c-3.967 0-7.31-2.314-8.802-5.865L181.803 1.245h21.709l4.32 11.939h26.528l2.506-11.939H256l-16.697 79.963zm3.037-21.601l6.265-30.027h-17.158zm-118.599 21.6L88.964 1.246h20.687l17.104 79.963zm-30.603 0L53.941 26.782l-8.71 46.277c-1.022 5.166-5.058 8.149-9.54 8.149H.493L0 78.886c7.226-1.568 15.436-4.097 20.41-6.803c3.044-1.653 3.912-3.098 4.912-7.026L41.819 1.245H63.68l33.516 79.963z"
          transform="matrix(1 0 0 -1 0 82.668)"
        />
      </svg>
    );
  }
  if (brand === "mastercard") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 199"
        role="img"
        aria-label="Mastercard"
      >
        <path d="M46.54 198.011V184.84c0-5.05-3.074-8.342-8.343-8.342c-2.634 0-5.488.878-7.464 3.732c-1.536-2.415-3.731-3.732-7.024-3.732c-2.196 0-4.39.658-6.147 3.073v-2.634h-4.61v21.074h4.61v-11.635c0-3.731 1.976-5.488 5.05-5.488c3.072 0 4.61 1.976 4.61 5.488v11.635h4.61v-11.635c0-3.731 2.194-5.488 5.048-5.488c3.074 0 4.61 1.976 4.61 5.488v11.635zm68.271-21.074h-7.463v-6.366h-4.61v6.366h-4.171v4.17h4.17v9.66c0 4.83 1.976 7.683 7.245 7.683c1.976 0 4.17-.658 5.708-1.536l-1.318-3.952c-1.317.878-2.853 1.098-3.951 1.098c-2.195 0-3.073-1.317-3.073-3.513v-9.44h7.463zm39.076-.44c-2.634 0-4.39 1.318-5.488 3.074v-2.634h-4.61v21.074h4.61v-11.854c0-3.512 1.536-5.488 4.39-5.488c.878 0 1.976.22 2.854.439l1.317-4.39c-.878-.22-2.195-.22-3.073-.22m-59.052 2.196c-2.196-1.537-5.269-2.195-8.562-2.195c-5.268 0-8.78 2.634-8.78 6.805c0 3.513 2.634 5.488 7.244 6.147l2.195.22c2.415.438 3.732 1.097 3.732 2.195c0 1.536-1.756 2.634-4.83 2.634s-5.488-1.098-7.025-2.195l-2.195 3.512c2.415 1.756 5.708 2.634 9 2.634c6.147 0 9.66-2.853 9.66-6.805c0-3.732-2.854-5.708-7.245-6.366l-2.195-.22c-1.976-.22-3.512-.658-3.512-1.975c0-1.537 1.536-2.415 3.951-2.415c2.635 0 5.269 1.097 6.586 1.756zm122.495-2.195c-2.635 0-4.391 1.317-5.489 3.073v-2.634h-4.61v21.074h4.61v-11.854c0-3.512 1.537-5.488 4.39-5.488c.879 0 1.977.22 2.855.439l1.317-4.39c-.878-.22-2.195-.22-3.073-.22m-58.833 10.976c0 6.366 4.39 10.976 11.196 10.976c3.073 0 5.268-.658 7.463-2.414l-2.195-3.732c-1.756 1.317-3.512 1.975-5.488 1.975c-3.732 0-6.366-2.634-6.366-6.805c0-3.951 2.634-6.586 6.366-6.805c1.976 0 3.732.658 5.488 1.976l2.195-3.732c-2.195-1.757-4.39-2.415-7.463-2.415c-6.806 0-11.196 4.61-11.196 10.976m42.588 0v-10.537h-4.61v2.634c-1.537-1.975-3.732-3.073-6.586-3.073c-5.927 0-10.537 4.61-10.537 10.976s4.61 10.976 10.537 10.976c3.073 0 5.269-1.097 6.586-3.073v2.634h4.61zm-16.904 0c0-3.732 2.415-6.805 6.366-6.805c3.732 0 6.367 2.854 6.367 6.805c0 3.732-2.635 6.805-6.367 6.805c-3.951-.22-6.366-3.073-6.366-6.805m-55.1-10.976c-6.147 0-10.538 4.39-10.538 10.976s4.39 10.976 10.757 10.976c3.073 0 6.147-.878 8.562-2.853l-2.196-3.293c-1.756 1.317-3.951 2.195-6.146 2.195c-2.854 0-5.708-1.317-6.367-5.05h15.587v-1.755c.22-6.806-3.732-11.196-9.66-11.196m0 3.951c2.853 0 4.83 1.757 5.268 5.05h-10.976c.439-2.854 2.415-5.05 5.708-5.05m114.372 7.025v-18.879h-4.61v10.976c-1.537-1.975-3.732-3.073-6.586-3.073c-5.927 0-10.537 4.61-10.537 10.976s4.61 10.976 10.537 10.976c3.074 0 5.269-1.097 6.586-3.073v2.634h4.61zm-16.903 0c0-3.732 2.414-6.805 6.366-6.805c3.732 0 6.366 2.854 6.366 6.805c0 3.732-2.634 6.805-6.366 6.805c-3.952-.22-6.366-3.073-6.366-6.805m-154.107 0v-10.537h-4.61v2.634c-1.537-1.975-3.732-3.073-6.586-3.073c-5.927 0-10.537 4.61-10.537 10.976s4.61 10.976 10.537 10.976c3.074 0 5.269-1.097 6.586-3.073v2.634h4.61zm-17.123 0c0-3.732 2.415-6.805 6.366-6.805c3.732 0 6.367 2.854 6.367 6.805c0 3.732-2.635 6.805-6.367 6.805c-3.951-.22-6.366-3.073-6.366-6.805" />
        <path fill="#ff5f00" d="M93.298 16.903h69.15v124.251h-69.15z" />
        <path fill="#eb001b" d="M97.689 79.029c0-25.245 11.854-47.637 30.074-62.126C114.373 6.366 97.47 0 79.03 0C35.343 0 0 35.343 0 79.029s35.343 79.029 79.029 79.029c18.44 0 35.343-6.366 48.734-16.904c-18.22-14.269-30.074-36.88-30.074-62.125" />
        <path fill="#f79e1b" d="M255.746 79.029c0 43.685-35.343 79.029-79.029 79.029c-18.44 0-35.343-6.366-48.734-16.904c18.44-14.488 30.075-36.88 30.075-62.125s-11.855-47.637-30.075-62.126C141.373 6.366 158.277 0 176.717 0c43.686 0 79.03 35.563 79.03 79.029" />
      </svg>
    );
  }
  if (brand === "amex") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        role="img"
        aria-label="American Express"
      >
        <path fill="#fff" d="M0 0h256v256H0z" />
        <path fill="#006fcf" d="M0 0v256h256v-40.448h-35.328l-13.056-15.273l-13.568 15.273H93.696v-81.321H60.585l41.39-93.696h40.274l9.728 21.248V40.535h50.007l8.361 22.272l8.192-22.272H256V0zm227.072 53.76l-13.143 34.647l-3.497 9.39l-3.584-9.39l-13.225-34.647h-28.928v68.27h17.408V77.573l-.087-8.965l3.415 8.965l16.64 44.457h16.553l16.727-44.457l3.241-8.878v53.335H256V53.76zm-115.712 0l-30.208 68.27h19.794l5.294-13.143h33.111l5.289 13.143h20.055l-30.039-68.27zm8.018 23.127l3.415-8.53l3.415 8.53l7.081 17.234h-20.992zm109.061 57.431l-20.567 22.098l-20.48-22.098h-79.703v68.009h57.006v-14.76h-39.598v-11.864h38.83v-14.674h-38.83v-11.95h39.598v-14.76l31.826 34.129l-31.826 33.879h22.016l20.736-22.185l20.649 22.185h22.61l-31.913-34.135l31.913-33.874zm8.274 33.792L256 187.735v-38.999z" />
      </svg>
    );
  }
  return null;
}

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
}) {
  const [step, setStep] = useState("details"); // details | payment | done | error
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selections, setSelections] = useState({});
  // Answers to the event's registration questions, keyed by question id. The
  // resulting registration status (Confirmed / Pending / Waitlisted) is kept so
  // the confirmation step can tailor its copy.
  const [answers, setAnswers] = useState({});
  const [regStatus, setRegStatus] = useState(null);

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
  const cardBrand = detectCardBrand(card);

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
  // React's recommended alternative to a setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep("details");
      setQty(1);
      setName("");
      setEmail("");
      setCard("");
      setOrder(null);
      setErrorMsg("");
      setBusy(false);
      setSelections({});
      setAnswers({});
      setRegStatus(null);
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
    let dietary = "";
    let accessibility = "";
    const bag = {};
    for (const q of regQuestions) {
      const val = answers[q.id];
      if (val === undefined || val === "" || val === false) continue;
      if (/diet|allerg/i.test(q.label)) dietary = String(val);
      else if (/accessib|mobility|disab/i.test(q.label)) accessibility = String(val);
      else bag[q.label] = val;
    }
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
    } else {
      setStep("payment");
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
        : step === "payment"
          ? "Payment"
          : "Get tickets";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>
            {event.name} · {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

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
          </div>
        ) : null}

        {/* Step: payment (paid tickets only) */}
        {step === "payment" ? (
          <div className="grid gap-4">
            <div className="space-y-2 rounded-xl border border-border bg-surface-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  {ticket?.name} × {qty}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  ${price * qty}
                </span>
              </div>
              {addonUnit > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Add-ons × {qty}</span>
                  <span className="tabular-nums text-muted-foreground">
                    ${addonUnit * qty}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span className="text-foreground">Total due</span>
                <span className="tabular-nums text-white">${total}</span>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Card number
                </label>
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <Input
                    inputMode="numeric"
                    value={card}
                    onChange={(e) =>
                      setCard(
                        e.target.value
                          .replace(/[^\d]/g, "")
                          .slice(0, 16)
                          .replace(/(.{4})/g, "$1 ")
                          .trim(),
                      )
                    }
                    placeholder="4242 4242 4242 4242"
                    className={cn("!pl-9", cardBrand && "!pr-16")}
                  />
                  {cardBrand ? (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center rounded bg-white px-1 py-0.5 shadow-sm">
                      <CardBrandMark brand={cardBrand} className="h-4 w-auto" />
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Expiry
                  </label>
                  <Input
                    inputMode="numeric"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM / YY"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    CVC
                  </label>
                  <Input placeholder="123" inputMode="numeric" />
                </div>
              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
              <Lock className="h-3 w-3" /> Demo checkout — no real charge is made.
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setStep("details")}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                Back
              </Button>
              <Button
                style={accentStyle}
                className="flex-1 hover:opacity-90"
                disabled={busy}
                onClick={finalize}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Pay ${total}</>
                )}
              </Button>
            </div>
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
                    : `${qty} × ${ticket?.name} for ${event.name}.${email ? ` A confirmation is on its way to ${email}.` : ""}`}
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
        onClose={() => setCheckoutOpen(false)}
        event={event}
        ticket={tickets[selected]}
        remaining={remaining}
        live={live}
        accent={accent}
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
