"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Clock,
  FileText,
  Link2Off,
  Loader2,
  Mail,
  PencilLine,
  Trophy,
  XCircle,
} from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Logo } from "@geiger/ui";
import { portalFetch } from "@/lib/portal/portal_fetch";
import { deadlineInfo, formatDay, formatDeadline, formatMoney } from "@/lib/sourcing/rfp_model";

import { RfpBrief } from "./rfp_brief";
import { BidForm, BidSummary, draftFromBid } from "./bid_form";

const noop = () => () => {};
// True once hydrated, so local-time formatting never mismatches the server render.
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

function useNow(initial) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

function Shell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Logo size={18} />
            Request for proposal
          </div>
          <span className="text-xs text-text-tertiary">Geiger Events</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">{children}</main>
    </div>
  );
}

function Card({ title, description, action, children }) {
  return (
    <section className="rounded-xl border border-border bg-surface-subtle">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-text-secondary">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

function Notice({ icon: Icon, tone = "neutral", title, children }) {
  const tones = {
    neutral: "border-border bg-surface-subtle text-text-secondary",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="text-sm opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

function Unavailable({ reason }) {
  const missing = reason === "not_found";
  return (
    <Shell>
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
          <Link2Off className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            {missing ? "This link isn't active" : "We couldn't load this request"}
          </p>
          <p className="mx-auto max-w-sm text-sm text-text-secondary">
            {missing
              ? "Each email carries a private link, and a newer email replaces the older link. Open the most recent email from the organiser, or ask them to resend it."
              : "Something went wrong on our side. Try again in a minute."}
          </p>
        </div>
      </div>
    </Shell>
  );
}

const REASON_COPY = {
  expired: "The response deadline has passed, so this proposal can't be sent.",
  closed: "The organiser has closed this request to new proposals.",
  not_found: "This link is no longer active. Open the most recent email from the organiser.",
  unavailable: "We couldn't reach the server. Your proposal wasn't sent — try again.",
};

export function RfpResponsePage({ token, initial, serverNow }) {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState(
    () => initial?.ok && initial.state === "open" && !initial.bid && initial.recipient?.status !== "declined",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const isClient = useIsClient();
  const now = useNow(serverNow);

  if (!data?.ok) return <Unavailable reason={data?.reason} />;

  const { rfp, recipient, bid, state } = data;
  const deadline = deadlineInfo(rfp.responseDeadline, now);
  const deadlineText = formatDeadline(rfp.responseDeadline, isClient ? undefined : "UTC");
  const open = state === "open";
  const declined = recipient?.status === "declined";

  const post = async (body) => {
    try {
      const res = await portalFetch(`/api/rfp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({ ok: false, reason: "unavailable" }));
      if (json?.data?.ok) setData(json.data);
      return json;
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };

  const submit = async (draft) => {
    setSubmitting(true);
    setError("");
    const res = await post({ action: "submit", bid: draft });
    setSubmitting(false);
    if (!res?.ok) {
      setError(res?.message || REASON_COPY[res?.reason] || "Your proposal couldn't be sent.");
      if (res?.reason === "expired" || res?.reason === "closed") setEditing(false);
      return;
    }
    setSent({ revision: res.revision, total: res.total });
    setEditing(false);
    toast.success("Proposal sent.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const decline = async () => {
    setDeclining(true);
    const res = await post({ action: "decline", reason: declineReason });
    setDeclining(false);
    if (!res?.ok) {
      toast.error(REASON_COPY[res?.reason] || "Couldn't record that.");
      return;
    }
    setDeclineOpen(false);
    setEditing(false);
    setSent(null);
    toast.success("Thanks — the organiser has been told you're passing.");
  };

  const organiser = rfp.organizerName || rfp.contactName || "The organiser";

  return (
    <Shell>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          {organiser} · for {recipient?.name || "your venue"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{rfp.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {rfp.responseDeadline ? (
            <Badge variant={open ? deadline.tone : "neutral"}>
              <Clock /> {open ? deadline.label : "Closed"}
            </Badge>
          ) : null}
          {rfp.eventName ? <Badge variant="neutral">{rfp.eventName}</Badge> : null}
          {bid ? <Badge variant="info">Revision {bid.revision} on file</Badge> : null}
        </div>
        {rfp.responseDeadline ? (
          <p className="text-xs text-text-tertiary">Responses close {deadlineText}</p>
        ) : null}
      </div>

      {sent ? (
        <Notice icon={CheckCircle2} tone="success" title={`Proposal sent — revision ${sent.revision}`}>
          {formatMoney(sent.total, rfp.currency, { cents: true })} total. You can revise it any time before the deadline;
          the organiser always sees your latest version.
        </Notice>
      ) : null}
      {state === "awarded" ? (
        <Notice icon={Trophy} tone="success" title="Your proposal was selected">
          {organiser} chose your venue. They&apos;ll be in touch to confirm the contract.
        </Notice>
      ) : null}
      {state === "lost" ? (
        <Notice icon={CheckCircle2} title="This request has been awarded">
          {organiser} chose another venue this time. Thank you for your proposal.
        </Notice>
      ) : null}
      {state === "cancelled" ? (
        <Notice icon={Ban} title="This request was cancelled">
          {organiser} cancelled the RFP, so no proposals are being considered.
        </Notice>
      ) : null}
      {state === "closed" ? (
        <Notice icon={Ban} title="Closed to new proposals">
          {organiser} has stopped taking proposals{bid ? " — your latest one is still on file" : ""}.
        </Notice>
      ) : null}
      {state === "expired" ? (
        <Notice icon={Clock} tone="warning" title="The deadline has passed">
          Responses closed {deadlineText}.{bid ? " Your latest proposal is on file." : ""}
          {rfp.contactEmail ? ` Contact ${rfp.contactEmail} if you still want to respond.` : ""}
        </Notice>
      ) : null}
      {open && declined && !editing ? (
        <Notice icon={XCircle} title="You declined this request">
          {recipient.declineReason ? `"${recipient.declineReason}". ` : ""}Changed your mind? You can still send a proposal
          until the deadline.
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <PencilLine className="h-4 w-4" /> Send a proposal
            </Button>
          </div>
        </Notice>
      ) : null}

      <Card title="The brief" description={rfp.decisionDate ? `Decision expected by ${formatDay(rfp.decisionDate)}.` : undefined}>
        <RfpBrief rfp={rfp} />
        {rfp.contactName || rfp.contactEmail ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm text-text-secondary">
            <Mail className="h-4 w-4" />
            Questions go to {rfp.contactName || "the organiser"}
            {rfp.contactEmail ? (
              <a className="font-medium text-foreground underline-offset-4 hover:underline" href={`mailto:${rfp.contactEmail}`}>
                {rfp.contactEmail}
              </a>
            ) : null}
          </div>
        ) : null}
      </Card>

      {editing && open ? (
        <Card
          title={bid ? `Revise your proposal` : "Your proposal"}
          description={
            bid
              ? `You're editing revision ${bid.revision}. Submitting files revision ${bid.revision + 1}.`
              : "Price the brief line by line. You can revise it until the deadline."
          }
        >
          <BidForm
            key={bid ? `rev-${bid.revision}` : "new"}
            rfp={rfp}
            initialDraft={draftFromBid(bid, rfp)}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={bid || declined ? () => setEditing(false) : undefined}
            onDecline={declined ? undefined : () => setDeclineOpen(true)}
          />
        </Card>
      ) : bid ? (
        <Card
          title={`Your proposal · revision ${bid.revision}`}
          description={bid.submittedAt ? `Sent ${formatDay(bid.submittedAt)}${bid.submittedByName ? ` by ${bid.submittedByName}` : ""}.` : undefined}
          action={
            open ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <PencilLine className="h-4 w-4" /> Revise
              </Button>
            ) : null
          }
        >
          <BidSummary bid={bid} currency={rfp.currency} attendees={rfp.attendees} />
          {open && !declined ? (
            <div className="mt-5 border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="text-text-secondary" onClick={() => setDeclineOpen(true)}>
                Withdraw and decline
              </Button>
            </div>
          ) : null}
        </Card>
      ) : open && !declined ? (
        <Card title="Your proposal">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">Price the brief line by line. No account is needed.</p>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setEditing(true)}>
              <FileText className="h-4 w-4" /> Start your proposal
            </Button>
          </div>
        </Card>
      ) : null}

      <Dialog open={declineOpen} onOpenChange={(o) => !declining && setDeclineOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
            <DialogDescription>
              {organiser} will see that you&apos;re passing{bid ? ", and your proposal leaves their comparison" : ""}. You can
              still respond later while the RFP is open.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Optional — e.g. fully booked on those dates."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={declining}>
              Keep it open
            </Button>
            <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={decline} disabled={declining}>
              {declining ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

export default RfpResponsePage;
