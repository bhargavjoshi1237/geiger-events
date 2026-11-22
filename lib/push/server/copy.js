import { safeZone } from "../../meetings/time.js";
import { eventStart, fmtEventWhen, fmtLead, fmtWhen } from "./time.js";

// Push copy per type from preloaded context. Pure: (row, ctx) -> { title, body, route, data } | { skip }.

const MAX_BODY = 178;

export function clip(text, max = MAX_BODY) {
  const s = String(text ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const join = (...parts) => parts.filter(Boolean).join(" · ");

function place(event) {
  return [event?.venue, event?.city].filter(Boolean).join(", ");
}

function money(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0 || !currency) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format(n);
  } catch {
    return "";
  }
}

function eventName(event) {
  return event?.name || "your event";
}

const ticketsRoute = (orderId) => (orderId ? `/tickets/${orderId}` : "/tickets");
const orderRoute = (orderId) => (orderId ? `/orders/${orderId}` : "/orders");

function done(title, body, route, data = {}) {
  return { title: clip(title, 80), body: clip(body), route: route || null, data };
}

const RENDER = {
  order_confirmed(row, ctx) {
    const order = ctx.order;
    const event = ctx.event;
    if (!order || !event) return { skip: "render" };
    if (row.ref?.organizer) {
      const size = Number(row.ref.groupSize) || 0;
      return done(
        "Your group booking is confirmed",
        join(size ? `${size} tickets for ${eventName(event)}` : eventName(event), fmtEventWhen(event)) +
          ". Each guest gets their own pass.",
        "/home",
        { orderId: order.id, eventId: event.id },
      );
    }
    const qty = Number(order.quantity) || 1;
    return done(
      `You're going to ${eventName(event)}`,
      `${join(`${qty > 1 ? `${qty} × ` : ""}${order.ticket_name || "Ticket"}`, fmtEventWhen(event), place(event))}. Your pass is in the app.`,
      ticketsRoute(order.id),
      { orderId: order.id, eventId: event.id },
    );
  },

  ticket_gifted(row, ctx) {
    const { order, event } = ctx;
    if (!order || !event) return { skip: "render" };
    return done(
      `${ctx.organizerName || "Someone"} got you a ticket`,
      `${join(eventName(event), fmtEventWhen(event), place(event))}. Your pass is ready in the app.`,
      ticketsRoute(order.id),
      { orderId: order.id, eventId: event.id },
    );
  },

  order_cancelled(row, ctx) {
    const { order, event } = ctx;
    if (!order) return { skip: "render" };
    return done(
      "Order cancelled",
      `Your ${order.ticket_name || "ticket"} order for ${eventName(event)} was cancelled. Any refund will show on the order.`,
      orderRoute(order.id),
      { orderId: order.id, eventId: event?.id || null },
    );
  },

  refund_update(row, ctx) {
    const { order, event } = ctx;
    const status = row.ref?.status;
    const amount = money(row.ref?.amount, ctx.currency);
    const data = { orderId: row.ref?.orderId || null, eventId: event?.id || null };
    const route = orderRoute(row.ref?.orderId);
    if (status === "Approved") {
      return done("Refund approved", `${amount ? `Your ${amount} refund` : "Your refund"} for ${eventName(event)} was approved. We'll let you know once it's issued.`, route, data);
    }
    if (status === "Denied") {
      return done("Refund request declined", `The organiser declined your refund request for ${eventName(event)}. Open the order to message them.`, route, data);
    }
    if (!order && !event) return { skip: "render" };
    return done("Refund issued", `${amount ? `${amount} is` : "Your refund is"} on its way for ${eventName(event)}. It can take 5–10 business days to appear.`, route, data);
  },

  payment_failed(row, ctx) {
    const event = ctx.event;
    return done(
      "Payment didn't go through",
      `Your payment for ${eventName(event)} failed, so the order wasn't completed. You can try again from the event page.`,
      "/orders",
      { eventId: event?.id || null },
    );
  },

  registration_update(row, ctx) {
    const { registration, event } = ctx;
    if (!registration || !event) return { skip: "render" };
    if (ctx.coveredByOrder) return { skip: "covered" };
    const when = join(fmtEventWhen(event), place(event));
    const data = { registrationId: registration.id, eventId: event.id };
    const status = row.ref?.status || registration.status;
    const previous = row.ref?.previous;
    if (status === "Confirmed" && previous === "Waitlisted") {
      return done("A spot opened up", `You're off the waitlist for ${eventName(event)}. ${when}.`, "/home", data);
    }
    if (status === "Confirmed" && previous === "Pending") {
      return done(`You're approved for ${eventName(event)}`, `The organiser approved your registration. ${when}.`, "/home", data);
    }
    if (status === "Confirmed") {
      return done(`You're registered for ${eventName(event)}`, `${when}.`, "/home", data);
    }
    if (status === "Pending") {
      return done("Registration received", `The organiser will review your registration for ${eventName(event)} and let you know.`, "/home", data);
    }
    if (status === "Waitlisted") {
      const pos = Number(row.ref?.position) || Number(registration.waitlist_position) || 0;
      return done(
        "You're on the waitlist",
        `${eventName(event)} is full${pos ? `. You're #${pos} on the waitlist` : ""}. We'll tell you the moment a spot opens.`,
        "/home",
        data,
      );
    }
    if (status === "Declined") {
      return done("Registration not approved", `The organiser couldn't approve your registration for ${eventName(event)}.`, "/home", data);
    }
    return { skip: "render" };
  },

  checked_in(row, ctx) {
    const { event, order } = ctx;
    if (!event) return { skip: "render" };
    const at = ctx.checkedInAt ? fmtWhen(new Date(ctx.checkedInAt), safeZone(event.timezone)).split(" · ").pop() : "";
    const gate = row.ref?.gate ? ` at ${row.ref.gate}` : "";
    return done(
      `Checked in to ${eventName(event)}`,
      `${order?.ticket_name || "Your ticket"} was scanned${gate}${at ? ` at ${at}` : ""}. Not you? Message the organiser.`,
      order ? ticketsRoute(order.id) : "/home",
      { orderId: order?.id || null, eventId: event.id },
    );
  },

  event_starting(row, ctx) {
    const { event } = ctx;
    if (!event) return { skip: "render" };
    const offset = Number(row.ref?.offset) || 0;
    const { hasTime } = eventStart(event);
    const orderId = row.ref?.orderId || null;
    const title =
      offset >= 1440
        ? offset === 1440 ? `Tomorrow: ${eventName(event)}` : `${eventName(event)} is in ${fmtLead(offset)}`
        : `${eventName(event)} starts in ${fmtLead(offset)}`;
    const body = `${join(hasTime ? fmtEventWhen(event) : "", place(event))}${hasTime || place(event) ? ". " : ""}${orderId ? "Tap for your pass." : "See you there."}`;
    const route = orderId ? (offset <= 60 ? `/pass/${orderId}` : ticketsRoute(orderId)) : "/home";
    return done(title, body, route, { orderId, eventId: event.id });
  },

  meeting_soon(row, ctx) {
    const { meeting } = ctx;
    if (!meeting || meeting.status !== "scheduled") return { skip: "render" };
    const others = (ctx.meetingOthers || []).join(" & ");
    return done(
      "Meeting in 10 minutes",
      join(others ? `With ${others}` : "", meeting.location_name || ""),
      "/notifications",
      { meetingId: meeting.id, eventId: meeting.event_id },
    );
  },

  live_starting(row, ctx) {
    const { room } = ctx;
    if (!room) return { skip: "render" };
    return done(`${room.name || "A live room"} is live`, "It's starting now. Tap to join.", `/live/${room.id}`, { roomId: room.id });
  },

  membership_expiring(row, ctx) {
    const { membership } = ctx;
    if (!membership || membership.status !== "Active") return { skip: "render" };
    const days = Number(row.ref?.days) || 0;
    const plan = membership.planName || "membership";
    const ends = membership.expires_at ? fmtWhen(new Date(membership.expires_at), "UTC", { hasTime: false }) : "";
    return done(
      days === 1 ? `Your ${plan} ends tomorrow` : `Your ${plan} ends in ${days} days`,
      `It expires ${ends ? `on ${ends}` : "soon"}. Renew to keep your access.`,
      "/memberships",
      { membershipId: membership.id },
    );
  },

  membership_expired(row, ctx) {
    const { membership } = ctx;
    if (!membership) return { skip: "render" };
    return done(
      `Your ${membership.planName || "membership"} has ended`,
      "Renew any time to get your access back.",
      "/memberships",
      { membershipId: membership.id },
    );
  },

  event_changed(row, ctx) {
    const { event } = ctx;
    if (!event || event.deleted_at) return { skip: "render" };
    const changed = Array.isArray(row.ref?.changed) ? row.ref.changed : [];
    const time = changed.includes("time");
    const venue = changed.includes("venue");
    const where = [event.venue, event.address || event.city].filter(Boolean).join(", ");
    const title = time && venue ? `${eventName(event)} has moved` : time ? `Time change: ${eventName(event)}` : `Venue change: ${eventName(event)}`;
    const body =
      time && venue ? `Now ${join(fmtEventWhen(event), where)}.` : time ? `Now ${fmtEventWhen(event)}.` : `Now at ${where || "a new venue"}.`;
    return done(title, body, `/events/${event.id}`, { eventId: event.id });
  },

  event_cancelled(row, ctx) {
    const { event } = ctx;
    return done(
      `${eventName(event)} is cancelled`,
      "The organiser cancelled this event. Check your order for refund details.",
      "/orders",
      { eventId: event?.id || row.event_id || null },
    );
  },

  thread_reply(row, ctx) {
    const { thread, threadMessage, event } = ctx;
    if (!thread || !threadMessage) return { skip: "render" };
    const from = event?.organizer || event?.name || "The organiser";
    return done(
      thread.subject ? `${from}: ${thread.subject}` : `Message from ${from}`,
      threadMessage.body || "Sent you a message.",
      `/messages/${thread.id}`,
      { threadId: thread.id },
    );
  },

  announcement(row, ctx) {
    const { announcement } = ctx;
    if (!announcement) return { skip: "render" };
    const cfg = announcement.config && typeof announcement.config === "object" ? announcement.config : {};
    return done(announcement.name || "Announcement", cfg.body || "Tap to read.", "/notifications", { announcementId: announcement.id });
  },

  chat_reply(row, ctx) {
    const { chatMessage, channel } = ctx;
    if (!chatMessage || !channel || chatMessage.deleted_at) return { skip: "render" };
    const route = channel.kind === "qa" ? `/qa/${channel.id}` : `/community/${channel.id}`;
    return done(`${chatMessage.author_name || "Someone"} replied to you`, join(channel.name, chatMessage.body), route, { channelId: channel.id });
  },

  chat_organiser_post(row, ctx) {
    const { chatMessage, channel } = ctx;
    if (!chatMessage || !channel || chatMessage.deleted_at) return { skip: "render" };
    const route = channel.kind === "qa" ? `/qa/${channel.id}` : `/community/${channel.id}`;
    return done(channel.name ? `New in ${channel.name}` : "New organiser post", chatMessage.body, route, { channelId: channel.id });
  },

  qa_answer(row, ctx) {
    const { chatMessage, channel } = ctx;
    if (!chatMessage || !channel || chatMessage.deleted_at) return { skip: "render" };
    return done("Your question was answered", `${chatMessage.author_name || "Organiser"}: ${chatMessage.body}`, `/qa/${channel.id}`, { channelId: channel.id });
  },
};

// Server-built copy (meetings, test sends) rides in ref.copy and passes straight through.
export function renderRow(row, ctx = {}) {
  const pre = row.ref?.copy;
  let out;
  if (pre && typeof pre === "object" && pre.title) {
    out = done(pre.title, pre.body || "", pre.route || null, pre.data && typeof pre.data === "object" ? pre.data : {});
  } else {
    const fn = RENDER[row.type];
    if (!fn) return { skip: "render" };
    out = fn(row, ctx);
    if (out.skip) return out;
  }
  const data = { ...out.data, type: row.type, notificationId: row.id };
  if (out.route) data.route = out.route;
  return { ...out, data };
}
