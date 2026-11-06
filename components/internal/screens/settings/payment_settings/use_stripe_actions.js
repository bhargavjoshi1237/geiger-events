"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { connectStripe, disconnectStripe, refreshStripe } from "@/lib/pay/client";

// Connect hands off to Stripe-hosted onboarding; refresh and disconnect hand the new account summary to `onAccount`.
export function useStripeActions(projectId, onAccount) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState(null);

  function run(name, action, onResult) {
    setPendingAction(name);
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error.message || "Something went wrong.");
      else onResult(result);
    });
  }

  return {
    isPending,
    busy: (name) => isPending && pendingAction === name,
    connect: (country) =>
      run("connect", () => connectStripe(projectId, { country }), (result) => {
        if (result?.url) window.location.assign(result.url);
      }),
    refresh: () => run("refresh", () => refreshStripe(projectId), (account) => onAccount(account)),
    disconnect: (onDone) =>
      run("disconnect", () => disconnectStripe(projectId), (account) => {
        onAccount(account);
        toast.success("Stripe disconnected");
        onDone?.();
      }),
  };
}
