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
  // Land on Memberships when returning from a membership Stripe Checkout.
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("membership_session")) return "memberships";
    }
    return "home";
  });
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState({ plans: [], paymentsEnabled: false });
  const [busyPlanId, setBusyPlanId] = useState(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const loadData = () =>
    fetch("/api/portal/data")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ orders: [], memberships: [], tickets: [] }));

  const loadPlans = () =>
    fetch("/api/portal/membership/plans")
      .then((r) => r.json())
      .then((d) => setPlans({ plans: d.plans || [], paymentsEnabled: !!d.paymentsEnabled }))
      .catch(() => {});

  useEffect(() => {
    loadData();
    loadPlans();
  }, []);

  // Confirm a membership Stripe Checkout on return, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("membership_session");
    const canceled = params.get("membership_canceled");
    const cleanUrl = () =>
      window.history.replaceState({}, "", `${basePath}/login`);
    if (canceled) {
      toast.info("Checkout canceled.");
      cleanUrl();
      return;
    }
    if (!sessionId) return;
    fetch("/api/portal/membership/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.enrolled) {
          toast.success(`You're now a member of ${d.planName || "the plan"}.`);
          loadData();
          loadPlans();
        } else {
          toast.error(d.error || "We couldn't confirm your membership.");
        }
      })
      .catch(() => toast.error("We couldn't confirm your membership."))
      .finally(cleanUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyMembership = async (plan) => {
    if (!plan || busyPlanId) return;
    setBusyPlanId(plan.id);
    try {
      const returnUrl = `${window.location.origin}${basePath}/login`;
      const r = await fetch("/api/portal/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, returnUrl }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url; // to Stripe
        return;
      }
      if (d.enrolled) {
        toast.success(`You're now a member of ${d.planName || plan.name}.`);
        await Promise.all([loadData(), loadPlans()]);
      } else {
        toast.error(d.error || "Couldn't start checkout.");
      }
    } catch {
      toast.error("Couldn't start checkout.");
    } finally {
      setBusyPlanId(null);
    }
  };

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
        return (
          <PortalHome
            member={member}
            data={data}
            onNavigate={setTab}
            availablePlans={(plans.plans || []).filter((p) => !p.held).length}
          />
        );
      case "tickets":
        return <PortalTickets tickets={data.tickets} />;
      case "orders":
        return <PortalOrders orders={data.orders} />;
      case "memberships":
        return (
          <PortalMemberships
            memberships={data.memberships}
            plans={plans.plans}
            paymentsEnabled={plans.paymentsEnabled}
            busyPlanId={busyPlanId}
            onBuy={buyMembership}
          />
        );
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
