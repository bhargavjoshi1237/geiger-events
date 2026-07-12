"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import PortalTopbar from "./portal_topbar";
import PortalSidebar from "./portal_sidebar";
import PortalHome from "./portal_home";
import PortalTickets from "./portal_tickets";
import PortalOrders from "./portal_orders";
import PortalMemberships from "./portal_memberships";
import PortalMessages from "./portal_messages";
import PortalNotifications from "./portal_notifications";
import PortalAccount from "./portal_account";

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
    const cleanUrl = () => window.history.replaceState({}, "", `${basePath}/members`);
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
      const returnUrl = `${window.location.origin}${basePath}/members`;
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

  const counts = {
    tickets: data?.tickets?.length || null,
    orders: data?.orders?.length || null,
    memberships: data?.memberships?.length || null,
    messages: unreadThreads || null,
    notifications: notifications.unread || null,
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background font-sans text-foreground selection:bg-surface-strong">
      <SidebarProvider
        className="!flex h-full min-w-0 flex-col"
        style={{ flexDirection: "column" }}
      >
        <PortalTopbar
          member={member}
          basePath={basePath}
          unread={notifications.unread}
          onNavigate={setTab}
          onSignOut={signOut}
        />
        <div className="relative flex flex-1 overflow-hidden">
          <PortalSidebar tab={tab} onTab={setTab} counts={counts} basePath={basePath} />
          <SidebarInset className="relative flex h-full flex-1 flex-col overflow-hidden border-none bg-transparent">
            <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[500px] rounded-full bg-white/[0.02] blur-[120px]" />
            <main className="relative z-10 w-full min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
              {renderTab()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default PortalShell;
