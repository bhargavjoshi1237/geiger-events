"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, Home, Ticket, ShoppingBag, BadgeCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { initials } from "./portal_kit";
import PortalHome from "./portal_home";
import PortalTickets from "./portal_tickets";
import PortalOrders from "./portal_orders";
import PortalMemberships from "./portal_memberships";
import PortalAccount from "./portal_account";

const NAV = [
  { key: "home", label: "Home", icon: Home },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "memberships", label: "Memberships", icon: BadgeCheck },
  { key: "account", label: "Account", icon: User },
];

export function PortalShell({ member: initialMember }) {
  const [member, setMember] = useState(initialMember);
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
    window.location.href = `${basePath}/login`;
  };

  const countFor = (key) => {
    if (!data) return null;
    if (key === "tickets") return data.tickets?.length || null;
    if (key === "orders") return data.orders?.length || null;
    if (key === "memberships") return data.memberships?.length || null;
    return null;
  };

  const renderTab = () => {
    if (!data && tab !== "account") {
      return (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      );
    }
    switch (tab) {
      case "home":
        return <PortalHome member={member} data={data} onNavigate={setTab} />;
      case "tickets":
        return <PortalTickets tickets={data.tickets} />;
      case "orders":
        return <PortalOrders orders={data.orders} />;
      case "memberships":
        return <PortalMemberships memberships={data.memberships} />;
      case "account":
        return <PortalAccount member={member} onMemberChange={setMember} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            G
          </div>
          <p className="text-sm font-semibold">Geiger Events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-strong text-[11px] font-semibold text-foreground">
              {initials(member?.name, member?.email)}
            </div>
            <span className="max-w-[14rem] truncate text-xs text-text-secondary">
              {member?.name || member?.email}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav className="sticky top-[57px] z-20 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-3 py-2 backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => setTab(n.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === n.key
                ? "bg-surface-hover text-foreground"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </button>
        ))}
      </nav>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-6 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            {NAV.map((n) => {
              const active = tab === n.key;
              const badge = countFor(n.key);
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => setTab(n.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-surface-hover text-foreground"
                      : "text-text-secondary hover:bg-surface-active hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{n.label}</span>
                  {badge ? (
                    <span className="rounded-full bg-surface-strong px-1.5 text-[11px] tabular-nums text-muted-foreground">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{renderTab()}</main>
      </div>
    </div>
  );
}

export default PortalShell;
