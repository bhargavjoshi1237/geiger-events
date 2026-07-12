"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  Home,
  Ticket,
  ShoppingBag,
  BadgeCheck,
  User,
  MessagesSquare,
  Bell,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { initials } from "./portal_kit";
import PortalHome from "./portal_home";
import PortalTickets from "./portal_tickets";
import PortalOrders from "./portal_orders";
import PortalMemberships from "./portal_memberships";
import PortalMessages from "./portal_messages";
import PortalNotifications from "./portal_notifications";
import PortalAccount from "./portal_account";

const NAV = [
  { key: "home", label: "Home", icon: Home },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "memberships", label: "Memberships", icon: BadgeCheck },
  { key: "messages", label: "Messages", icon: MessagesSquare },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "account", label: "Account", icon: User },
];

export function PortalShell({ member: initialMember }) {
  const [member, setMember] = useState(initialMember);
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
  const [threads, setThreads] = useState(null);
  const [notifications, setNotifications] = useState({ items: [], unread: 0 });
  const [messageDraft, setMessageDraft] = useState(null);
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

  const loadThreads = () =>
    fetch("/api/portal/threads")
      .then((r) => r.json())
      .then((d) => setThreads(d.threads || []))
      .catch(() => setThreads([]));

  const loadNotifications = () =>
    fetch("/api/portal/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications({ items: d.items || [], unread: d.unread || 0 }))
      .catch(() => {});

  useEffect(() => {
    loadData();
    loadPlans();
    loadThreads();
    loadNotifications();
  }, []);

  // Confirm a membership Stripe Checkout on return, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("membership_session");
    const canceled = params.get("membership_canceled");
    const cleanUrl = () => window.history.replaceState({}, "", `${basePath}/login`);
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

  // Mark the announcements feed read when the member opens Notifications.
  useEffect(() => {
    if (tab !== "notifications" || !notifications.unread) return;
    fetch("/api/portal/notifications", { method: "POST" })
      .then(() =>
        setNotifications((n) => ({
          ...n,
          unread: 0,
          items: n.items.map((i) => ({ ...i, unread: false })),
        })),
      )
      .catch(() => {});
  }, [tab, notifications.unread]);

  const signOut = async () => {
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => {});
    toast.success("Signed out.");
    window.location.href = `${basePath}/login`;
  };

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
        window.location.href = d.url;
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

  // Open the message composer prefilled with an order's context.
  const messageOrganiser = (order) => {
    setMessageDraft(
      order
        ? {
            subject: order.eventName ? `Re: ${order.eventName}` : "",
            orderId: order.id,
            contextLabel: `${order.eventName || "Order"} · ${order.orderCode || ""}`,
          }
        : {},
    );
    setTab("messages");
  };

  const requestRefund = async (order, reason) => {
    const r = await fetch("/api/portal/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, reason }),
    });
    const d = await r.json();
    if (r.ok) {
      toast.success("Refund request sent to the organiser.");
      await loadData();
      return true;
    }
    toast.error(d.error || "Couldn't submit your request.");
    return false;
  };

  const unreadThreads = (threads || []).filter((t) => t.unread).length;

  const countFor = (key) => {
    if (key === "messages") return unreadThreads || null;
    if (key === "notifications") return notifications.unread || null;
    if (!data) return null;
    if (key === "tickets") return data.tickets?.length || null;
    if (key === "orders") return data.orders?.length || null;
    if (key === "memberships") return data.memberships?.length || null;
    return null;
  };

  const renderTab = () => {
    if (tab === "messages") {
      return (
        <PortalMessages
          threads={threads || []}
          loading={threads === null}
          initialCompose={messageDraft}
          onConsumeCompose={() => setMessageDraft(null)}
          onRefresh={loadThreads}
        />
      );
    }
    if (tab === "notifications") {
      return <PortalNotifications items={notifications.items} loading={false} />;
    }
    if (tab === "account") {
      return <PortalAccount member={member} onMemberChange={setMember} />;
    }
    if (!data) {
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
        return (
          <PortalTickets
            tickets={data.tickets}
            onMessage={messageOrganiser}
            onRequestRefund={requestRefund}
          />
        );
      case "orders":
        return (
          <PortalOrders
            orders={data.orders}
            onMessage={messageOrganiser}
            onRequestRefund={requestRefund}
          />
        );
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
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <Image
            src={`${basePath}/logo1.svg`}
            alt="Geiger Events"
            width={20}
            height={20}
            className="geiger-logo"
            priority
          />
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
        {NAV.map((n) => {
          const badge = countFor(n.key);
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => setTab(n.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === n.key
                  ? "bg-surface-hover text-foreground"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              <n.icon className="h-4 w-4" /> {n.label}
              {badge ? (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-6 sm:px-6">
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
                    <span
                      className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                        n.key === "messages" || n.key === "notifications"
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-strong text-muted-foreground"
                      }`}
                    >
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
