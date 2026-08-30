import {
  slotBookingEnabled,
  slotBookingRequired,
  eventSlots,
} from "@/lib/events/slots";
import {
  hasPurchasables,
  visiblePurchasables,
  purchasablesUnitTotal,
} from "@/lib/events/purchasables";
import { discountBase } from "@/lib/supabase/discounts";
import { discountAmountFor, ticketDiscountIds } from "@/lib/events/discount_rules";
import { earlybirdEnabled, earlybirdReduction } from "@/lib/events/earlybird";
import { donationEnabled, donationConfig } from "@/lib/events/donation";
import {
  groupPurchaseEnabled,
  groupConfig,
  groupAllowsTicket,
  groupDiscountAmount,
} from "@/lib/events/group";
import { ticketAvailable } from "@/lib/events/reserved";

const optionPrice = (offering, id) => {
  const opt = offering.options.find((x) => x.id === id);
  return opt ? Number(opt.price) || 0 : 0;
};

export function derivePricing({
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
}) {
  const price =
    expoOn && boothSel?.pricing === "direct" && boothSel.boothIds?.length
      ? boothSel.price
      : ticket?.price || 0;
  const ticketId = ticket?.id != null ? String(ticket.id) : null;
  const isBundle = !!ticket?.bundleId;

  const ebOn = !isBundle && earlybirdEnabled(event);
  const ebReduction = ebOn ? earlybirdReduction(event, price) : 0;
  const effPrice = Math.max(0, price - ebReduction);

  const slotBookingOn = slotBookingEnabled(event);
  const slotRequired = slotBookingRequired(event);
  const bookableSlots = slotBookingOn
    ? eventSlots(event, { ticketId: ticketId ?? undefined }).filter((s) => s.enabled !== false)
    : [];
  const selectedSlot = bookableSlots.find((s) => s.id === slotId) || null;
  const slotDelta = selectedSlot ? Number(selectedSlot.priceDelta) || 0 : 0;

  const usePurchasables = hasPurchasables(event);

  const offerings = usePurchasables
    ? []
    : (Array.isArray(event.offerings) ? event.offerings : [])
        .filter((o) => o.enabled && Array.isArray(o.options) && o.options.length)
        .filter(
          (o) =>
            o.appliesTo === "all" ||
            (Array.isArray(o.appliesTo) && o.appliesTo.includes(ticket?.name)),
        );

  const offeringsUnit = offerings.reduce((sum, o) => {
    const sel = selections[o.id];
    if (o.selectionType === "single") return sum + (sel ? optionPrice(o, sel) : 0);
    const arr = Array.isArray(sel) ? sel : [];
    return sum + arr.reduce((s, id) => s + optionPrice(o, id), 0);
  }, 0);

  const purSelectedIds = Object.entries(purSelections)
    .filter(([, v]) => (typeof v === "number" ? v > 0 : !!v))
    .map(([k]) => k);
  const visiblePurs = usePurchasables
    ? visiblePurchasables(event, {
        slot: selectedSlot,
        ticketId,
        ticketName: ticket?.name,
        qty,
        isMember: false,
        selectedIds: purSelectedIds,
      })
    : [];
  const purUnit = purchasablesUnitTotal(visiblePurs, purSelections);

  const addonUnit = offeringsUnit + purUnit + slotDelta;
  const subtotal = (effPrice + addonUnit) * qty;

  // A code is offered on a ticket only when that ticket lists at least one
  // coupon — codes are attached per ticket, never to the event as a whole.
  const ticketCouponIds = ticketDiscountIds(ticket);
  const discountEnabled =
    !isBundle &&
    event.discountSettings?.enabled !== false &&
    ticketCouponIds.length > 0;
  const discountAppliesTo = event.discountSettings?.appliesTo || "order";
  // A code left over from a previous ticket must not keep discounting: it only
  // counts while it is applied AND this ticket actually accepts codes.
  const discountAmount =
    appliedDiscount && discountEnabled
      ? discountAmountFor(appliedDiscount, {
          base: discountBase({ price: effPrice, qty, addonUnit }, discountAppliesTo),
          qty,
          maxDiscount: appliedDiscount.maxDiscount ?? null,
        })
      : 0;

  const groupOn = !isBundle && groupPurchaseEnabled(event) && groupAllowsTicket(event, ticketId);
  const gCfg = groupConfig(event);
  const isGroup = groupOn && qty >= gCfg.minSeats;
  const groupDiscount = isGroup ? groupDiscountAmount(event, effPrice * qty) : 0;

  const donationOn = !isBundle && donationEnabled(event);
  const donCfg = donationConfig(event);

  const total = Math.max(0, subtotal - discountAmount - groupDiscount) + donationAmount;
  const isFree = total === 0;
  const hardMax = groupOn ? (gCfg.maxSeats > 0 ? gCfg.maxSeats : 50) : 10;
  const availCap = ticketAvailable(event, { id: ticketId, qty: ticket?.qty }, event.ticketSold || {});
  const maxQty = Math.min(
    Math.max(1, remaining || 1),
    Number.isFinite(availCap) ? Math.max(1, availCap) : hardMax,
    hardMax,
  );

  return {
    price,
    ticketId,
    isBundle,
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
  };
}
