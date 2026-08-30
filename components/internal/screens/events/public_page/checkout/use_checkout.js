"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { validateEventDiscount, discountBase } from "@/lib/supabase/discounts";
import { buyTicket } from "@/lib/supabase/orders";
import { holdSeats, releaseSeats } from "@/lib/supabase/seating";
import { holdBooths } from "@/lib/supabase/expo";
import {
  registerForEvent,
  hasWaitlistedRegistration,
} from "@/lib/supabase/registrations";
import { getUser } from "@/lib/supabase/user";
import {
  splitRegistrationAnswers,
  DIETARY_ANSWER_PREFIX,
} from "@/lib/events/registration_answers";
import {
  getPublicTicketQuestions,
  saveTicketAnswers,
} from "@/lib/supabase/ticket_questions";

import { makeDisclaimerSlot } from "../disclaimer";
import { derivePricing } from "./pricing";
import {
  seatKey,
  buildSelections,
  buildPurchasables,
  buildAttendees,
  slotRecord,
  buildTicketAnswers,
} from "./order_payload";
import { validateCheckoutDetails } from "./validate";

// Buyer-facing text for each rejection reason the discount RPC can return.
// Codes are scoped per ticket now, so "not_allowed" means this ticket rather
// than this event.
function discountReasonMessage(reason) {
  switch (reason) {
    case "limit":
      return "This code has reached its limit.";
    case "not_allowed":
      return "This code doesn't work on this ticket.";
    case "pending":
      return "This code isn't active yet.";
    case "expired":
      return "This code has expired.";
    case "min_qty":
      return "This code needs a larger quantity.";
    case "max_qty":
      return "This code can't be used on this many tickets.";
    default:
      return "That code isn't valid.";
  }
}

export function useCheckout({
  open,
  event,
  ticket: baseTicket,
  remaining,
  live,
  entry,
  onPurchased,
  resumeResult,
  approvedResume,
  daConfig,
}) {
  const disclaimerSlot = makeDisclaimerSlot(event);
  const seating = event?.seating || null;
  const seatingOn = Boolean(seating?.seatMapId);
  const seatMode = seating?.mode || "map-first";
  const [seatSel, setSeatSel] = useState(null);

  const expo = event?.expo || null;
  const expoOn = !seatingOn && Boolean(expo?.hallMapId);
  const [boothSel, setBoothSel] = useState(null);

  const seatTicket =
    seatingOn && seatMode === "map-first" && seatSel?.ticketId
      ? (event?.tickets || []).find((t) => String(t.id) === String(seatSel.ticketId)) || null
      : null;
  const boothTicket =
    expoOn && boothSel?.ticketId
      ? (event?.tickets || []).find((t) => String(t.id) === String(boothSel.ticketId)) || null
      : null;

  const ticket = seatTicket || boothTicket || baseTicket;

  const defaultEntryStep =
    (seatingOn && (seating?.mode || "map-first") === "map-first" && "seats") ||
    (expoOn && "booths") ||
    "details";
  const entryStep =
    entry === "price"
      ? (expoOn && "booths") || "details"
      : entry === "seats" &&
          seatingOn &&
          (seating?.mode || "map-first") === "map-first"
        ? "seats"
        : defaultEntryStep;
  const [step, setStep] = useState(entryStep);
  const [qty, setQty] = useState(1);
  const [slotId, setSlotId] = useState(null);
  const [purSelections, setPurSelections] = useState({});
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountBusy, setDiscountBusy] = useState(false);
  const [donationAmount, setDonationAmount] = useState(0);
  const [donationCustom, setDonationCustom] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const seatHoldRef = useRef(null);
  useEffect(() => {
    seatHoldRef.current = seatSel?.seatIds?.length ? seatSel.token : null;
  }, [seatSel]);

  const keepHoldRef = useRef(false);
  useEffect(() => {
    if (!open) return undefined;
    keepHoldRef.current = false;
    return () => {
      if (!keepHoldRef.current && seatHoldRef.current && event?.id) {
        releaseSeats(event.id, seatHoldRef.current);
      }
    };
  }, [open, event?.id]);

  const attributedRef = useRef(null);
  useEffect(() => {
    const orderId = order?.orderId;
    if (!live || !orderId || attributedRef.current === orderId) return;
    attributedRef.current = orderId;
    import("@/addons/affiliates/lib/attribution")
      .then((mod) =>
        mod.attributeOrderFromStorage(event.id, orderId, {
          code: appliedDiscount?.code ?? null,
        }),
      )
      .catch(() => {});
  }, [live, order, event.id, appliedDiscount]);

  const [selections, setSelections] = useState({});
  const [answers, setAnswers] = useState({});
  const [ticketQuestions, setTicketQuestions] = useState([]);
  const [ticketAnswers, setTicketAnswers] = useState({});
  const [regStatus, setRegStatus] = useState(null);
  const [doneTicketName, setDoneTicketName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState(null);

  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

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

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    getPublicTicketQuestions(ticket?.ticketTypeId).then((rows) => {
      if (!alive) return;
      setTicketQuestions(rows ?? []);
      setTicketAnswers({});
    });
    return () => {
      alive = false;
    };
  }, [open, ticket?.ticketTypeId]);

  const pricing = derivePricing({
    event,
    ticket,
    expoOn,
    boothSel,
    qty,
    slotId,
    selections,
    purSelections,
    appliedDiscount,
    donationAmount,
    remaining,
  });
  const {
    price,
    ticketId,
    ebReduction,
    effPrice,
    slotRequired,
    bookableSlots,
    selectedSlot,
    usePurchasables,
    offerings,
    visiblePurs,
    addonUnit,
    discountEnabled,
    ticketCouponIds,
    discountAppliesTo,
    discountAmount,
    gCfg,
    isGroup,
    groupDiscount,
    donationOn,
    donCfg,
    total,
    isFree,
    maxQty,
  } = pricing;

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

  const setAttendee = (i, field, value) =>
    setAttendees((prev) => {
      const next = [...prev];
      next[i] = { ...(next[i] || {}), [field]: value };
      return next;
    });

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
        setPurSelections({});
        setSlotId(null);
        setDiscountInput("");
        setAppliedDiscount(null);
        setDiscountBusy(false);
        setAnswers({});
        setTicketAnswers({});
        setDonationAmount(0);
        setDonationCustom("");
        setAttendees([]);
      } else {
        setStep(entryStep);
        setQty(1);
        setName(approvedResume?.name || "");
        setEmail(approvedResume?.email || "");
        setOrder(null);
        setErrorMsg("");
        setBusy(false);
        setSelections({});
        setPurSelections({});
        setSlotId(null);
        setDiscountInput("");
        setAppliedDiscount(null);
        setDiscountBusy(false);
        setAnswers({});
        setTicketAnswers({});
        setRegStatus(null);
        setDonationAmount(0);
        setDonationCustom("");
        setAttendees([]);
      }
    }
  }

  const rsvpCfg = event.rsvp || {};
  const requiresApproval = !!rsvpCfg.requireApproval;
  const allowWaitlist = rsvpCfg.waitlist !== false;
  const blockWaitlistedRebook = !!rsvpCfg.blockWaitlistedRebook;
  const regQuestions = (Array.isArray(event.questions) ? event.questions : [])
    .filter((q) => q && q.label)
    .filter((q) => !/^(full\s*)?name$|^e-?mail$/i.test(q.label.trim()));
  const setAnswer = (id) => (value) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const setTicketAnswer = (seat, qid) => (value) =>
    setTicketAnswers((a) => ({ ...a, [seatKey(seat, qid)]: value }));

  const persistTicketAnswers = async ({ registrationId = null, clientRef = null }) => {
    if (!live || !ticketQuestions.length || !ticket?.ticketTypeId) return;
    const rows = buildTicketAnswers(qty, ticketQuestions, ticketAnswers);
    if (!rows.length) return;
    await saveTicketAnswers({
      eventId: event.id,
      ticketTypeId: ticket.ticketTypeId,
      ticketRef: ticket.id,
      registrationId,
      clientRef,
      answers: rows,
    });
  };

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
      enforceCapacity: false,
    };
  };

  const doRegister = async () => {
    if (!live) {
      setRegStatus(requiresApproval ? "Pending" : "Confirmed");
      return null;
    }
    const res = await registerForEvent(buildRegistration());
    setRegStatus(res.ok ? res.status : requiresApproval ? "Pending" : "Confirmed");
    return res;
  };

  const finalize = async () => {
    setBusy(true);
    setDoneTicketName(ticket?.name || "");
    if (!live) {
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
      selections: buildSelections(offerings, selections),
      purchasables: buildPurchasables(visiblePurs, purSelections),
      slot: slotRecord(selectedSlot),
      slotId: selectedSlot?.id ?? null,
      discountCode: appliedDiscount?.code ?? null,
      donation: donationAmount,
      attendees: buildAttendees(isGroup, qty, attendees),
      bundleId: ticket?.bundleId ?? null,
      accessCode: ticket?.accessCode ?? null,
      seatIds: seatSel?.seatIds ?? null,
      seatToken: seatSel?.token ?? null,
      boothIds: boothSel?.boothIds ?? null,
      boothToken: boothSel?.token ?? null,
    });
    if (res.ok) {
      keepHoldRef.current = true;
      if (approvedResume) setRegStatus("Confirmed");
      else {
        const regRes = await doRegister();
        await persistTicketAnswers({ registrationId: regRes?.registration?.id || null });
      }
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

  const requestApproval = async () => {
    setBusy(true);
    const regRes = await doRegister();
    await persistTicketAnswers({ registrationId: regRes?.registration?.id || null });
    setBusy(false);
    setOrder({ orderId: null, pending: true });
    setStep("done");
  };

  const startStripeCheckout = async () => {
    if (!live) {
      await finalize();
      return;
    }
    setBusy(true);
    const clientRef = ticketQuestions.length ? crypto.randomUUID() : null;
    if (clientRef) await persistTicketAnswers({ clientRef });
    if (seatSel?.seatIds?.length && seatSel.token) {
      const extended = await holdSeats(event.id, seatSel.seatIds, seatSel.token, 30);
      if (!extended?.ok) {
        setBusy(false);
        setErrorMsg("Your seats were taken while you were deciding. Please pick again.");
        setStep("error");
        return;
      }
    }
    if (boothSel?.boothIds?.length && boothSel.token) {
      const extended = await holdBooths(event.id, boothSel.boothIds, boothSel.token, 40);
      if (!extended?.ok) {
        setBusy(false);
        setErrorMsg("Your booths were taken while you were deciding. Please pick again.");
        setStep("error");
        return;
      }
    }
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
          selections: buildSelections(offerings, selections),
          purchasables: buildPurchasables(visiblePurs, purSelections),
          slot: slotRecord(selectedSlot),
          slotId: selectedSlot?.id ?? null,
          discountCode: appliedDiscount?.code ?? null,
          donation: donationAmount,
          attendees: buildAttendees(isGroup, qty, attendees),
          bundleId: ticket?.bundleId ?? null,
          accessCode: ticket?.accessCode ?? null,
          answers,
          formId: event.formId || null,
          clientRef,
          seatToken: seatSel?.token ?? null,
          boothToken: boothSel?.token ?? null,
          skipRegistration: !!approvedResume,
          returnUrl: window.location.href.split("?")[0],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        keepHoldRef.current = true;
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

  const validateDetails = () =>
    validateCheckoutDetails({
      name,
      email,
      qty,
      slotRequired,
      bookableSlots,
      selectedSlot,
      isGroup,
      attendees,
      offerings,
      selections,
      regQuestions,
      answers,
      inquiryQuestions,
      inquiryKey,
      ticketQuestions,
      ticketAnswers,
    });

  const proceed = async () => {
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
      requestApproval();
    } else if (isFree) {
      finalize();
    } else if (event.payments?.enabled === false) {
      toast.error("Online payments are currently disabled for this event.");
    } else {
      startStripeCheckout();
    }
  };

  const submitDetails = () => {
    if (!validateDetails()) return;
    if (seatingOn && seatMode === "type-first") {
      setStep("seats");
      return;
    }
    if (usePurchasables && visiblePurs.length) {
      setStep("addons");
      return;
    }
    proceed();
  };

  const confirmBooths = () => {
    if (!boothSel?.boothIds?.length) {
      toast.error("Pick your stand to continue.");
      return;
    }
    if (!boothSel.ticketId) {
      toast.error(
        boothSel.pricing === "direct"
          ? "Exhibitor space isn't on sale for this event yet."
          : "That booth isn't on sale for this event.",
      );
      return;
    }
    setStep("details");
  };

  const confirmSeats = () => {
    const chosen = seatSel?.seatIds?.length || 0;
    if (chosen === 0) {
      toast.error("Pick your seats to continue.");
      return;
    }
    if (seatMode === "map-first") {
      if (!seatSel?.ticketId) {
        toast.error("That section isn't on sale for this event.");
        return;
      }
      setStep("details");
      return;
    }
    if (chosen !== qty) {
      toast.error(`Pick ${qty} seat${qty > 1 ? "s" : ""} to match your order.`);
      return;
    }
    if (usePurchasables && visiblePurs.length) {
      setStep("addons");
      return;
    }
    proceed();
  };

  const confirmAddons = () => {
    const missingReq = visiblePurs.find((p) => {
      if (!p.required) return false;
      const v = purSelections[p.id];
      return typeof v === "number" ? v <= 0 : !v;
    });
    if (missingReq) {
      toast.error(`Please add ${missingReq.name}.`);
      return;
    }
    proceed();
  };

  const togglePurchasable = (id) =>
    setPurSelections((s) => ({ ...s, [id]: !s[id] }));
  const setPurchasableQty = (id, value) =>
    setPurSelections((s) => ({ ...s, [id]: Math.max(0, Number(value) || 0) }));

  // A code is resolved against the ticket in the basket: scoping lives on the
  // ticket, and quantity/time rules are evaluated server-side from qty + now.
  const resolveDiscount = useCallback(
    (code) => {
      if (!live)
        return Promise.resolve({
          ok: true,
          id: "preview",
          code: code.toUpperCase(),
          discountType: "percent",
          value: 10,
          applyPer: "order",
          maxDiscount: null,
        });
      return validateEventDiscount(event.id, code, {
        ticketId,
        qty,
        base: discountBase(
          { price: effPrice, qty, addonUnit },
          discountAppliesTo,
        ),
      });
    },
    [live, event.id, ticketId, qty, effPrice, addonUnit, discountAppliesTo],
  );

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountBusy(true);
    const res = await resolveDiscount(code);
    setDiscountBusy(false);
    if (res.ok) {
      setAppliedDiscount(res);
      toast.success(`Code ${res.code} applied.`);
    } else {
      setAppliedDiscount(null);
      toast.error(discountReasonMessage(res.reason));
    }
  };
  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountInput("");
  };

  // Re-resolve an applied code whenever the basket changes. Quantity tiers and
  // time windows are evaluated server-side, so nudging the quantity from 2 to 4
  // can change WHICH rule wins — and a code valid on one ticket may not be on
  // another. Short debounce so dragging the quantity stepper isn't chatty.
  const appliedCode = appliedDiscount?.code || "";
  const couponCount = ticketCouponIds.length;
  useEffect(() => {
    if (!appliedCode || !live) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      // Ticket accepts no codes at all — drop the held code.
      if (!couponCount) {
        if (!alive) return;
        setAppliedDiscount(null);
        setDiscountInput("");
        return;
      }
      const res = await resolveDiscount(appliedCode);
      if (!alive) return;
      if (res.ok) {
        setAppliedDiscount(res);
      } else {
        setAppliedDiscount(null);
        setDiscountInput("");
        toast.error(discountReasonMessage(res.reason));
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // resolveDiscount captures ticketId/qty/base; re-running on those is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, live, couponCount, resolveDiscount, ticketId, qty]);

  const headerLabel =
    step === "done"
      ? regStatus === "Pending"
        ? "Registration received"
        : regStatus === "Waitlisted"
          ? "You're on the waitlist"
          : "Order confirmed"
      : step === "error"
        ? "Checkout"
        : step === "addons"
          ? "Add-ons"
          : "Get Tickets";

  return {
    seating,
    seatMode,
    seatSel,
    setSeatSel,
    expo,
    boothSel,
    setBoothSel,
    ticket,
    ticketId,
    step,
    setStep,
    qty,
    setQty,
    slotId,
    setSlotId,
    purSelections,
    discountInput,
    setDiscountInput,
    appliedDiscount,
    discountBusy,
    donationAmount,
    setDonationAmount,
    donationCustom,
    setDonationCustom,
    attendees,
    setAttendee,
    name,
    setName,
    email,
    setEmail,
    busy,
    order,
    errorMsg,
    selections,
    answers,
    setAnswer,
    ticketQuestions,
    ticketAnswers,
    setTicketAnswer,
    regStatus,
    doneTicketName,
    price,
    ebReduction,
    effPrice,
    bookableSlots,
    usePurchasables,
    offerings,
    visiblePurs,
    addonUnit,
    discountEnabled,
    discountAmount,
    gCfg,
    isGroup,
    groupDiscount,
    donationOn,
    donCfg,
    total,
    isFree,
    maxQty,
    requiresApproval,
    approvedResume,
    regQuestions,
    inquiryQuestions,
    inquiryKey,
    toggleInquiryMulti,
    selectSingle,
    toggleMultiple,
    isChosen,
    submitDetails,
    confirmBooths,
    confirmSeats,
    confirmAddons,
    togglePurchasable,
    setPurchasableQty,
    applyDiscount,
    removeDiscount,
    headerLabel,
    disclaimerSlot,
  };
}
