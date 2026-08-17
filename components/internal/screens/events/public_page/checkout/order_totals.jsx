"use client";

import { earlybirdLabel } from "@/lib/events/earlybird";

function TotalRow({ total }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">Total</span>
      <span className="text-lg font-bold tabular-nums text-foreground">
        {total === 0 ? "Free" : `$${total}`}
      </span>
    </div>
  );
}

export function DetailsTotals({ event, checkout }) {
  const {
    addonUnit,
    discountAmount,
    ebReduction,
    groupDiscount,
    donationAmount,
    qty,
    effPrice,
    appliedDiscount,
    gCfg,
    total,
  } = checkout;

  return (
    <div className="border-t border-border pt-4">
      {addonUnit > 0 || discountAmount > 0 || ebReduction > 0 || groupDiscount > 0 || donationAmount > 0 ? (
        <div className="mb-2 space-y-1 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>
              Tickets ({qty} × ${effPrice})
            </span>
            <span className="tabular-nums">${effPrice * qty}</span>
          </div>
          {ebReduction > 0 ? (
            <div className="flex justify-between text-emerald-400">
              <span>Early bird ({earlybirdLabel(event)})</span>
              <span className="tabular-nums">−${ebReduction * qty}</span>
            </div>
          ) : null}
          {addonUnit > 0 ? (
            <div className="flex justify-between">
              <span>
                Add-ons ({qty} × ${addonUnit})
              </span>
              <span className="tabular-nums">${addonUnit * qty}</span>
            </div>
          ) : null}
          {discountAmount > 0 ? (
            <div className="flex justify-between text-emerald-400">
              <span>Discount ({appliedDiscount.code})</span>
              <span className="tabular-nums">−${discountAmount}</span>
            </div>
          ) : null}
          {groupDiscount > 0 ? (
            <div className="flex justify-between text-emerald-400">
              <span>Group discount ({gCfg.discountPercent}%)</span>
              <span className="tabular-nums">−${groupDiscount}</span>
            </div>
          ) : null}
          {donationAmount > 0 ? (
            <div className="flex justify-between">
              <span>Donation</span>
              <span className="tabular-nums">${donationAmount}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <TotalRow total={total} />
    </div>
  );
}

export function AddonsTotals({ checkout }) {
  const { qty, price, addonUnit, discountAmount, appliedDiscount, total } = checkout;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 space-y-1 text-xs text-text-secondary">
        <div className="flex justify-between">
          <span>
            Tickets ({qty} × ${price})
          </span>
          <span className="tabular-nums">${price * qty}</span>
        </div>
        {addonUnit > 0 ? (
          <div className="flex justify-between">
            <span>Extras</span>
            <span className="tabular-nums">${addonUnit * qty}</span>
          </div>
        ) : null}
        {discountAmount > 0 ? (
          <div className="flex justify-between text-emerald-400">
            <span>Discount ({appliedDiscount.code})</span>
            <span className="tabular-nums">−${discountAmount}</span>
          </div>
        ) : null}
      </div>
      <TotalRow total={total} />
    </div>
  );
}
