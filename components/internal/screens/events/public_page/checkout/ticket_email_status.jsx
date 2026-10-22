"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Mail, MailCheck, RotateCw } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";

const endpoint = (sessionId) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/checkout/email?session_id=${encodeURIComponent(sessionId)}`;

// The email is sent just after payment is confirmed, so the screen polls briefly for its outcome.
const POLL_EVERY_MS = 2000;
const POLL_FOR_MS = 30000;

function copyFor(status, to, orderNo) {
  switch (status) {
    case "sent":
      return {
        icon: MailCheck,
        tone: "border-emerald-500/25 bg-emerald-500/10",
        iconTone: "text-emerald-600 dark:text-emerald-400",
        title: `Tickets sent to ${to}`,
        note: "Check your inbox — and your spam folder if they aren't there in a few minutes.",
        resend: true,
      };
    case "failed":
      return {
        icon: AlertTriangle,
        tone: "border-amber-500/25 bg-amber-500/10",
        iconTone: "text-amber-600 dark:text-amber-400",
        title: "We couldn't email your tickets yet",
        note: `Your order${orderNo ? ` ${orderNo}` : ""} is confirmed. Send the tickets to ${to} again.`,
        resend: true,
      };
    case "off":
      return {
        icon: Mail,
        tone: "border-border bg-surface-card",
        iconTone: "text-text-tertiary",
        title: "This event doesn't email tickets",
        note: `Your order${orderNo ? ` ${orderNo}` : ""} is confirmed — keep the number for the door.`,
      };
    case "slow":
      return {
        icon: Mail,
        tone: "border-border bg-surface-card",
        iconTone: "text-text-tertiary",
        title: `Your tickets are on their way to ${to}`,
        note: "If nothing arrives in a few minutes, check your spam folder or send them again.",
        resend: true,
      };
    default:
      return {
        icon: Loader2,
        spin: true,
        tone: "border-border bg-surface-card",
        iconTone: "text-text-tertiary",
        title: `Emailing your tickets to ${to}…`,
        note: "This usually takes a few seconds.",
      };
  }
}

// Whether the ticket email actually went out, so a buyer leaves the page knowing where their tickets are.
export function TicketEmailStatus({ sessionId, email, orderId }) {
  const [state, setState] = useState({ status: "pending", to: email });
  const [timedOut, setTimedOut] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!sessionId || state.status !== "pending") return undefined;
    let alive = true;
    let timer = null;
    const started = Date.now();
    const poll = async () => {
      try {
        const res = await fetch(endpoint(sessionId));
        const data = await res.json();
        if (!alive) return;
        if (data?.status && data.status !== "pending") {
          setState(data);
          return;
        }
      } catch {
        // A missed poll just waits for the next one.
      }
      if (!alive) return;
      if (Date.now() - started > POLL_FOR_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_EVERY_MS);
    };
    timer = setTimeout(poll, 800);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sessionId, state.status]);

  const resend = async () => {
    setSending(true);
    try {
      const res = await fetch(endpoint(sessionId), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't send your tickets again.");
        return;
      }
      setState(data);
      setTimedOut(false);
      if (data.status === "sent") toast.success(`Tickets sent again to ${data.to}.`);
      else toast.error("That didn't go through either. Try again in a minute.");
    } catch {
      toast.error("Couldn't send your tickets again.");
    } finally {
      setSending(false);
    }
  };

  const to = state.to || email || "your email";
  const orderNo = orderId ? `#${String(orderId).slice(0, 8)}` : "";
  const status = state.status === "pending" && timedOut ? "slow" : state.status;
  const view = copyFor(status, to, orderNo);
  const Icon = view.icon;

  return (
    <div
      aria-live="polite"
      className={cn("flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left", view.tone)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", view.iconTone, view.spin && "animate-spin")} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-foreground">{view.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{view.note}</p>
      </div>
      {view.resend ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={sending}
          onClick={resend}
          className="-my-1 shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Resend
        </Button>
      ) : null}
    </div>
  );
}
