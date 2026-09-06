import { Share } from "react-native";

import { fmtShortDay, money } from "@/lib/format";
import type { Ticket } from "@/types/portal";

// Public event pages live on the marketing host, not the API host.
const WEB_BASE = (
  process.env.EXPO_PUBLIC_WEB_BASE_URL || "https://geiger.studio/events"
).replace(/\/+$/, "");

// Only the event page is public on the web; pass and ticket go out as text.
export function eventUrl(ticket: Ticket): string {
  return ticket.eventId ? `${WEB_BASE}/e/${ticket.eventId}` : "";
}

function whenLine(ticket: Ticket): string {
  return [ticket.eventDate ? fmtShortDay(ticket.eventDate) : "Date TBA", ticket.eventTime]
    .filter(Boolean)
    .join(" · ");
}

function placeLine(ticket: Ticket): string {
  return [ticket.venue, ticket.city].filter(Boolean).join(", ");
}

async function deviceShare(title: string, message: string): Promise<boolean> {
  try {
    await Share.share({ title, message });
    return true;
  } catch (e) {
    console.warn("[share] failed", e);
    return false;
  }
}

export function sharePass(ticket: Ticket): Promise<boolean> {
  const lines = [
    `My pass: ${ticket.eventName}`,
    [whenLine(ticket), placeLine(ticket)].filter(Boolean).join(" · "),
    `Order ${ticket.orderCode} · ${ticket.buyerName || ticket.buyerEmail}`,
  ];
  return deviceShare(`Pass · ${ticket.eventName}`, lines.filter(Boolean).join("\n"));
}

export function shareTicket(ticket: Ticket): Promise<boolean> {
  const lines = [
    `${ticket.eventName} — ${ticket.ticket || "Admission"}${ticket.quantity > 1 ? ` × ${ticket.quantity}` : ""}`,
    [whenLine(ticket), placeLine(ticket)].filter(Boolean).join(" · "),
    `Order ${ticket.orderCode}${ticket.paid ? ` · ${money(ticket.total)}` : ""}`,
  ];
  return deviceShare(`Ticket · ${ticket.eventName}`, lines.filter(Boolean).join("\n"));
}

export function shareEventLink(ticket: Ticket): Promise<boolean> {
  const url = eventUrl(ticket);
  if (!url) return Promise.resolve(false);
  return deviceShare(ticket.eventName, `${ticket.eventName}\n${url}`);
}
