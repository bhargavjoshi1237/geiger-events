"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { validateEventAccessCode } from "@/lib/supabase/access_codes";
import { gatedTicketIds } from "@/lib/events/access_codes";
import { eventBundles, bundlePrice, bundleTicketCount } from "@/lib/events/bundles";
import { listEventTicketsResolved } from "@/lib/supabase/ticketing";
import { getVenue } from "@/lib/supabase/venues";
import { getWallByProject } from "@/lib/supabase/event_wall";
import { getPublicDietaryConfig } from "@/lib/supabase/dietary";

import { buildTickets, groupTickets } from "./tickets";

export function usePageData({ event, live }) {
  const [resolvedTickets, setResolvedTickets] = useState(null);

  const gatedIds = gatedTicketIds(event);
  const [unlockedCodes, setUnlockedCodes] = useState({});
  const [codeInput, setCodeInput] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);

  const [now, setNow] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => alive && setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const [wallLogo, setWallLogo] = useState("");
  const needsWallLogo = !event.organizerAvatar && !!event.projectId;
  useEffect(() => {
    if (!needsWallLogo) return;
    let alive = true;
    getWallByProject(event.projectId).then((wall) => {
      if (alive) setWallLogo(wall?.logoUrl || "");
    });
    return () => {
      alive = false;
    };
  }, [needsWallLogo, event.projectId]);

  const priceById = Object.fromEntries(
    (Array.isArray(event.tickets) ? event.tickets : []).map((t) => [String(t.id), Number(t.price) || 0]),
  );
  const baseTickets = buildTickets(event, resolvedTickets)
    .filter((t) => !gatedIds.has(String(t.id)) || unlockedCodes[String(t.id)])
    .map((t) =>
      gatedIds.has(String(t.id)) && unlockedCodes[String(t.id)]
        ? { ...t, accessCode: unlockedCodes[String(t.id)] }
        : t,
    );
  const bundleOptions = eventBundles(event).map((b) => ({
    id: null,
    bundleId: b.id,
    name: b.name,
    price: bundlePrice(b, priceById),
    qty: 0,
    note: b.description || `${bundleTicketCount(b)} tickets together`,
  }));
  const tickets = [...baseTickets, ...bundleOptions];
  const ticketGroups = groupTickets(event, tickets);

  const [selected, setSelected] = useState(Math.min(1, tickets.length - 1));
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const applyAccessCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeBusy(true);
    const res = await validateEventAccessCode(event.id, code);
    setCodeBusy(false);
    if (res.ok && res.ticketIds.length) {
      setUnlockedCodes((prev) => {
        const next = { ...prev };
        for (const id of res.ticketIds) next[String(id)] = res.code || code;
        return next;
      });
      setCodeInput("");
      toast.success("Tickets unlocked.");
    } else {
      toast.error("That code isn't valid for this event.");
    }
  };

  const [soldOverride, setSoldOverride] = useState(null);
  const [resumeResult, setResumeResult] = useState(null);
  const [approvedResume, setApprovedResume] = useState(null);
  const [venueOpen, setVenueOpen] = useState(false);
  const [daConfig, setDaConfig] = useState(null);
  const [venueData, setVenueData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (event.projectId) {
      getPublicDietaryConfig(event.projectId).then(
        (c) => alive && setDaConfig(c),
      );
    }
    if (event.venueId) {
      getVenue(event.venueId).then((v) => alive && setVenueData(v));
    }
    if (event.id) {
      listEventTicketsResolved(event.id).then(
        (rows) => alive && setResolvedTickets(rows ?? []),
      );
    }
    return () => {
      alive = false;
    };
  }, [event.projectId, event.venueId, event.id]);

  const guidelines = [
    ...(Array.isArray(venueData?.guidelines) ? venueData.guidelines : []),
    ...(Array.isArray(event.guidelines) ? event.guidelines : []),
  ].filter((g) => g && g.label);

  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");
    if (sessionId) {
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.sold === "number") setSoldOverride(data.sold);
          setResumeResult({
            ok: Boolean(data.ok),
            orderId: data.orderId,
            error: data.error,
            ticket: data.ticket,
            quantity: data.quantity,
            name: data.name,
            email: data.email,
          });
          setCheckoutOpen(true);
        })
        .catch(() => {
          setResumeResult({ ok: false, error: "Couldn't confirm your payment." });
          setCheckoutOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, "", window.location.pathname);
        });
    } else if (canceled) {
      toast.error("Checkout canceled — you haven't been charged.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("approved")) {
      const contact = {
        name: params.get("name") || "",
        email: params.get("email") || "",
      };
      window.history.replaceState({}, "", window.location.pathname);
      Promise.resolve().then(() => {
        setApprovedResume(contact);
        setCheckoutOpen(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    gatedIds,
    codeInput,
    setCodeInput,
    codeBusy,
    applyAccessCode,
    now,
    wallLogo,
    tickets,
    ticketGroups,
    selected,
    setSelected,
    checkoutOpen,
    setCheckoutOpen,
    soldOverride,
    setSoldOverride,
    resumeResult,
    setResumeResult,
    approvedResume,
    setApprovedResume,
    venueOpen,
    setVenueOpen,
    daConfig,
    guidelines,
  };
}
