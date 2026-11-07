"use client";

import React, { useState } from "react";
import { Building2, CheckCircle2, Loader2, Mail, Trophy } from "lucide-react";

import { EmptyState, SectionCard, SettingRow, SettingsList, StatusPill } from "@/components/internal/shared/screen_kit";
import { BidSummary } from "@/components/rfp/bid_form";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDay, formatMoney } from "@/lib/sourcing/rfp_model";

import { BID_STATUS_MAP, RECIPIENT_STATUS_MAP, recipientDisplayStatus, relativeTime } from "./constants";

// Confirms an award and spells out every side effect before it happens.
export function AwardDialog({ target, rfp, eventName, venueName, losers, onOpenChange, onConfirm }) {
  const [notify, setNotify] = useState(true);
  const [linkEvent, setLinkEvent] = useState(true);
  const [busy, setBusy] = useState(false);
  const recipient = target?.recipient;
  const bid = target?.bid;
  const existingVenue = Boolean(recipient?.venueId && venueName);

  const confirm = async () => {
    setBusy(true);
    const ok = await onConfirm({ bid, recipient, notify, linkEvent: Boolean(rfp.eventId) && linkEvent });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Award to {recipient?.name}?</DialogTitle>
          <DialogDescription>
            {bid ? `${formatMoney(bid.total, bid.currency)} · revision ${bid.revision}. ` : ""}This closes the RFP — the other
            bids are marked rejected and the RFP stops taking proposals.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 rounded-lg border border-border bg-surface-subtle p-4 text-sm text-text-secondary">
          <li className="flex gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
            {existingVenue
              ? `Saves the agreed line items, concessions and terms on ${venueName} in your Venues book.`
              : `Adds ${recipient?.name || "the venue"} to your Venues book with its contact and location, and saves the agreed line items, concessions and terms on it.`}
          </li>
          {recipient?.pipelineRecordId ? (
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Marks the pipeline lead as Booked and links it to the venue.
            </li>
          ) : null}
        </ul>

        <SettingsList>
          <SettingRow
            title="Email the result"
            description={`Award notice to ${recipient?.name || "the winner"}${losers ? ` and a regret notice to ${losers} other venue${losers === 1 ? "" : "s"}` : ""}.`}
            control={<Switch checked={notify} onCheckedChange={setNotify} />}
          />
          {rfp.eventId ? (
            <SettingRow
              title={`Set as ${eventName || "the event"}'s venue`}
              description="Updates the event's venue, address and city."
              control={<Switch checked={linkEvent} onCheckedChange={setLinkEvent} />}
            />
          ) : null}
        </SettingsList>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Award
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The outcome once awarded, or the shortlist to award from.
export function AwardSection({ form, recipients, bids, venuesById, now, canAward, sendingNotices, onAward, onOpenVenue, onResendNotices }) {
  const current = bids.filter((b) => b.isCurrent);
  const winnerBid = form.awardedBidId ? bids.find((b) => b.id === form.awardedBidId) : null;
  const winner = winnerBid ? recipients.find((r) => r.id === winnerBid.recipientId) : null;
  const venue = form.awardedVenueId ? venuesById[form.awardedVenueId] : null;

  if (form.status === "awarded" && winnerBid) {
    const notices = recipients.filter((r) => r.invitedAt && ["awarded", "lost"].includes(r.status));
    const failed = notices.filter((r) => !(r.emailStatus?.kind === (r.status === "awarded" ? "award" : "regret") && r.emailStatus?.status === "sent"));
    return (
      <div className="space-y-6">
        <SectionCard bodyPadding={false}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-card text-emerald-600 dark:text-emerald-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-secondary">Awarded {form.awardedAt ? formatDay(form.awardedAt) : ""}</p>
              <p className="text-lg font-semibold text-foreground">{winner?.name || venue?.name || "Winning venue"}</p>
              <p className="text-sm text-text-secondary">
                {formatMoney(winnerBid.total, winnerBid.currency)} · revision {winnerBid.revision}
                {form.attendees ? ` · ${formatMoney(winnerBid.total / form.attendees, winnerBid.currency, { cents: true })} per attendee` : ""}
              </p>
            </div>
            {form.awardedVenueId ? (
              <Button variant="outline" onClick={() => onOpenVenue(form.awardedVenueId)}>
                <Building2 className="h-4 w-4" /> Open venue
              </Button>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Agreed terms" description="Saved on the venue as a contract, so the rate card travels with it.">
          <BidSummary bid={winnerBid} currency={form.currency} attendees={form.attendees} />
        </SectionCard>

        <SectionCard
          title="Notices"
          description="Award and regret emails to everyone who was invited."
          action={
            failed.length ? (
              <Button size="sm" variant="outline" disabled={sendingNotices} onClick={onResendNotices}>
                {sendingNotices ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send {failed.length} unsent
              </Button>
            ) : null
          }
        >
          <div className="divide-y divide-border">
            {notices.map((r) => {
              const s = r.emailStatus || {};
              const kind = r.status === "awarded" ? "award" : "regret";
              const sent = s.kind === kind && s.status === "sent";
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-foreground">{r.name}</span>
                    <StatusPill status={recipientDisplayStatus(r)} map={RECIPIENT_STATUS_MAP} />
                  </div>
                  <span className={cn("shrink-0 text-xs", sent ? "text-text-secondary" : "text-amber-700 dark:text-amber-400")}>
                    {sent
                      ? `${kind === "award" ? "Award" : "Regret"} sent ${relativeTime(s.at, now)}`
                      : s.kind === kind && s.status === "failed"
                        ? "Email failed"
                        : s.kind === kind && s.status === "off"
                          ? "Emails switched off"
                          : "Not sent"}
                  </span>
                </div>
              );
            })}
            {!notices.length ? <p className="py-2 text-sm text-text-secondary">Nobody was invited by email.</p> : null}
          </div>
        </SectionCard>
      </div>
    );
  }

  if (form.status === "cancelled") {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState icon={Trophy} title="This RFP was cancelled" description="Nothing can be awarded." />
      </div>
    );
  }

  const awardable = current
    .filter((b) => b.status !== "rejected")
    .map((b) => ({ bid: b, recipient: recipients.find((r) => r.id === b.recipientId) }))
    .filter((e) => e.recipient && e.recipient.status !== "declined")
    .sort((a, b) => (a.bid.status === "shortlisted" ? -1 : 0) - (b.bid.status === "shortlisted" ? -1 : 0) || a.bid.total - b.bid.total);

  if (!awardable.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Trophy}
          title="Nothing to award yet"
          description="Once venues bid, shortlist the strongest in Bid comparison and award the winner here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Shortlisted bids first, then by price. Awarding converts the venue into your Venues book with the agreed terms.
      </p>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface-subtle">
        {awardable.map(({ bid, recipient }) => (
          <div key={bid.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{recipient.name}</span>
                <StatusPill status={bid.status} map={BID_STATUS_MAP} />
              </div>
              <p className="text-xs text-text-secondary">
                {formatMoney(bid.total, bid.currency)} · revision {bid.revision} · sent {relativeTime(bid.submittedAt, now)}
              </p>
            </div>
            {canAward ? (
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAward(bid)}>
                <Trophy className="h-4 w-4" /> Award
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AwardSection;
