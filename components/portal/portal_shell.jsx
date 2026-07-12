"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MembershipsList, OrdersList, TicketsList } from "./portal_lists";

const TABS = [
  { key: "memberships", label: "Memberships" },
  { key: "orders", label: "Orders" },
  { key: "tickets", label: "Tickets" },
];

export function PortalShell({ member }) {
  const [tab, setTab] = useState("memberships");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/portal/data")
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ orders: [], memberships: [], tickets: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const signOut = async () => {
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => {});
    toast.success("Signed out.");
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`;
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Geiger Events</p>
          <p className="truncate text-xs text-text-secondary">{member.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex gap-1 rounded-lg border border-border bg-surface-card p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-surface-hover text-foreground"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tab === "memberships" ? (
          <MembershipsList items={data.memberships} />
        ) : tab === "orders" ? (
          <OrdersList items={data.orders} />
        ) : (
          <TicketsList items={data.tickets} />
        )}
      </div>
    </div>
  );
}

export default PortalShell;
