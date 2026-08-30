"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { submitDietaryRequest } from "@/lib/supabase/dietary";

export function PostPurchaseRequest({ event, name, email, prompt, accentStyle, live }) {
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
