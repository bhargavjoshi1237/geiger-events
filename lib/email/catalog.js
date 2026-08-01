// The catalog of transactional emails Geiger Events sends.
//
// One entry per email type. It is the single source of truth for three things:
//   • Settings -> Notifications renders a toggle per entry, grouped by section;
//   • the server-side gate (lib/email/notifications.js) looks a key up here to
//     decide whether a send is allowed for a project;
//   • `template` names the template that must exist in geiger-dash, which owns
//     the whole email stack (rendering + Resend delivery + the send log).
//
// `live` marks the entries that already have a send site in this app. The rest
// are declared so the catalog is the complete plan of record — their toggle is
// stored and honored the moment a send site is wired, and the screen labels
// them "Planned" so nobody mistakes an unwired type for a broken one.
//
// Pure data: no icons, no React, no client-only imports — a server route reads
// this too.

export const NOTIFICATIONS_MODULE = "notifications";

export const EMAIL_GROUPS = [
  {
    key: "registrations",
    label: "Registrations & RSVPs",
    desc: "What a guest hears from the moment they register until the event is over.",
  },
  {
    key: "orders",
    label: "Tickets & orders",
    desc: "Purchase, delivery, payment and refund mail for anyone who buys a ticket.",
  },
  {
    key: "onsite",
    label: "Check-in & on-site",
    desc: "Mail sent around the door — check-in receipts and re-sent passes.",
  },
  {
    key: "memberships",
    label: "Memberships",
    desc: "The membership lifecycle: joining, renewing, lapsing.",
  },
  {
    key: "portal",
    label: "Members portal",
    desc: "Account and support mail for buyers signed in to the portal.",
  },
  {
    key: "team",
    label: "Team & internal alerts",
    desc: "Mail that goes to your own team rather than to guests.",
  },
  {
    key: "program",
    label: "Program & content",
    desc: "Speakers, sessions, recordings and certificates.",
  },
  {
    key: "partners",
    label: "Partners & suppliers",
    desc: "Sponsors, venues, housing, purchase orders and affiliates.",
  },
  {
    key: "marketing",
    label: "Marketing & campaigns",
    desc: "Bulk sends from Campaigns. Off here means nothing goes out at all.",
  },
];

export const EMAIL_NOTIFICATIONS = [
  // --- Registrations & RSVPs -------------------------------------------------
  {
    key: "registration_confirmed",
    group: "registrations",
    label: "Registration confirmed",
    description: "Free RSVPs and registrations that need no payment.",
    audience: "Guest",
    template: "events.registration_confirmed",
    live: false,
  },
  {
    key: "registration_pending",
    group: "registrations",
    label: "Registration received, awaiting approval",
    description: "Sent when the event has an approval gate on it.",
    audience: "Guest",
    template: "events.registration_pending",
    live: false,
  },
  {
    key: "registration_approved",
    group: "registrations",
    label: "Registration approved",
    description: "Approval-gate decision with a link back to finish and pay.",
    audience: "Guest",
    template: "events.registration_approved",
    live: true,
  },
  {
    key: "registration_declined",
    group: "registrations",
    label: "Registration declined",
    description: "The other half of the approval-gate decision.",
    audience: "Guest",
    template: "events.registration_declined",
    live: false,
  },
  {
    key: "waitlist_joined",
    group: "registrations",
    label: "Added to the waitlist",
    description: "Confirms the spot in the queue and their position.",
    audience: "Guest",
    template: "events.waitlist_joined",
    live: false,
  },
  {
    key: "waitlist_promoted",
    group: "registrations",
    label: "A spot opened up",
    description: "Fires on waitlist auto-promotion, with a claim deadline.",
    audience: "Guest",
    template: "events.waitlist_promoted",
    live: false,
  },
  {
    key: "event_reminder",
    group: "registrations",
    label: "Event reminder",
    description: "The countdown mail before doors open.",
    audience: "Guest",
    template: "events.event_reminder",
    live: false,
  },
  {
    key: "event_updated",
    group: "registrations",
    label: "Event details changed",
    description: "Goes out when the date, time or venue moves.",
    audience: "Guest",
    template: "events.event_updated",
    live: false,
  },
  {
    key: "event_cancelled",
    group: "registrations",
    label: "Event cancelled",
    description: "Cancellation notice, with refund handling if money changed hands.",
    audience: "Guest",
    template: "events.event_cancelled",
    live: false,
  },
  {
    key: "post_event_followup",
    group: "registrations",
    label: "Post-event follow-up",
    description: "Thanks, feedback survey and links to any recordings.",
    audience: "Guest",
    template: "events.post_event_followup",
    live: false,
  },

  // --- Tickets & orders ------------------------------------------------------
  {
    key: "ticket_purchase_confirmation",
    group: "orders",
    label: "Purchase confirmation",
    description: "Sent the moment Stripe checkout is fulfilled.",
    audience: "Buyer",
    template: "events.ticket_purchase_confirmation",
    live: true,
  },
  {
    key: "ticket_delivery",
    group: "orders",
    label: "Ticket delivery",
    description: "The QR ticket and wallet pass, separate from the receipt.",
    audience: "Buyer",
    template: "events.ticket_delivery",
    live: false,
  },
  {
    key: "order_receipt",
    group: "orders",
    label: "Receipt / invoice",
    description: "The billing document built from the invoice profile.",
    audience: "Buyer",
    template: "events.order_receipt",
    live: false,
  },
  {
    key: "order_cancelled",
    group: "orders",
    label: "Order cancelled",
    description: "Confirms an order the organizer or buyer cancelled.",
    audience: "Buyer",
    template: "events.order_cancelled",
    live: false,
  },
  {
    key: "refund_requested",
    group: "orders",
    label: "Refund request received",
    description: "Acknowledges a request filed from the portal.",
    audience: "Buyer",
    template: "events.refund_requested",
    live: false,
  },
  {
    key: "refund_processed",
    group: "orders",
    label: "Refund processed",
    description: "Confirms the amount refunded and when it lands.",
    audience: "Buyer",
    template: "events.refund_processed",
    live: false,
  },
  {
    key: "refund_declined",
    group: "orders",
    label: "Refund declined",
    description: "Explains the decision against the event's refund policy.",
    audience: "Buyer",
    template: "events.refund_declined",
    live: false,
  },
  {
    key: "payment_failed",
    group: "orders",
    label: "Payment failed",
    description: "A charge was declined and the order is on hold.",
    audience: "Buyer",
    template: "events.payment_failed",
    live: false,
  },
  {
    key: "installment_reminder",
    group: "orders",
    label: "Payment plan installment due",
    description: "Reminder before each scheduled installment is taken.",
    audience: "Buyer",
    template: "events.installment_reminder",
    live: false,
  },
  {
    key: "ticket_transfer",
    group: "orders",
    label: "Ticket transferred to you",
    description: "The claim link the new holder needs to accept a transfer.",
    audience: "Recipient",
    template: "events.ticket_transfer",
    live: false,
  },
  {
    key: "group_purchase_invite",
    group: "orders",
    label: "Claim your spot in a group booking",
    description: "Invites each member of a group purchase to register.",
    audience: "Guest",
    template: "events.group_purchase_invite",
    live: false,
  },
  {
    key: "access_code_delivery",
    group: "orders",
    label: "Access code",
    description: "Delivers a code for access-code-gated ticket types.",
    audience: "Guest",
    template: "events.access_code_delivery",
    live: false,
  },

  // --- Check-in & on-site ----------------------------------------------------
  {
    key: "checkin_confirmation",
    group: "onsite",
    label: "Checked in",
    description: "Receipt sent when a guest is scanned through the door.",
    audience: "Guest",
    template: "events.checkin_confirmation",
    live: false,
  },
  {
    key: "ticket_resend",
    group: "onsite",
    label: "Ticket re-sent",
    description: "Re-delivers a QR ticket or wallet pass on request.",
    audience: "Guest",
    template: "events.ticket_resend",
    live: false,
  },

  // --- Memberships -----------------------------------------------------------
  {
    key: "membership_welcome",
    group: "memberships",
    label: "Welcome to the membership",
    description: "Confirms the plan and everything it unlocks.",
    audience: "Member",
    template: "events.membership_welcome",
    live: false,
  },
  {
    key: "membership_renewal_reminder",
    group: "memberships",
    label: "Membership renewing soon",
    description: "Heads-up before an auto-renewing period rolls over.",
    audience: "Member",
    template: "events.membership_renewal_reminder",
    live: false,
  },
  {
    key: "membership_renewed",
    group: "memberships",
    label: "Membership renewed",
    description: "Confirms the new period and the amount charged.",
    audience: "Member",
    template: "events.membership_renewed",
    live: false,
  },
  {
    key: "membership_payment_failed",
    group: "memberships",
    label: "Membership payment failed",
    description: "Asks the member to update their card before access lapses.",
    audience: "Member",
    template: "events.membership_payment_failed",
    live: false,
  },
  {
    key: "membership_ended",
    group: "memberships",
    label: "Membership ended",
    description: "Sent when a membership expires or is cancelled.",
    audience: "Member",
    template: "events.membership_ended",
    live: false,
  },

  // --- Members portal --------------------------------------------------------
  {
    key: "portal_set_password",
    group: "portal",
    label: "Set or reset your password",
    description:
      "The one-time setup link for the members portal. Currently borrows the shared account.password_reset template.",
    audience: "Member",
    template: "account.password_reset",
    live: true,
  },
  {
    key: "portal_password_changed",
    group: "portal",
    label: "Password changed",
    description: "Security confirmation after a successful password change.",
    audience: "Member",
    template: "events.portal_password_changed",
    live: false,
  },
  {
    key: "portal_support_reply",
    group: "portal",
    label: "Reply to your support thread",
    description: "Tells a member the organizer answered their message.",
    audience: "Member",
    template: "events.portal_support_reply",
    live: false,
  },
  {
    key: "portal_announcement",
    group: "portal",
    label: "New announcement",
    description: "Emails a published announcement to connected members.",
    audience: "Member",
    template: "events.portal_announcement",
    live: false,
  },

  // --- Team & internal alerts ------------------------------------------------
  {
    key: "team_invite",
    group: "team",
    label: "Workspace invitation",
    description: "The join link for someone invited under Team & Members.",
    audience: "Teammate",
    template: "events.team_invite",
    live: false,
  },
  {
    key: "team_invite_accepted",
    group: "team",
    label: "Invitation accepted",
    description: "Notifies the inviter that the teammate joined.",
    audience: "Teammate",
    template: "events.team_invite_accepted",
    live: false,
  },
  {
    key: "organizer_alert",
    group: "team",
    label: "Event alerts",
    description:
      "The rules built on an event's Alerts tab — milestones, sales thresholds and registration activity.",
    audience: "Team",
    template: "events.organizer_alert",
    live: false,
  },
  {
    key: "sales_digest",
    group: "team",
    label: "Sales digest & scheduled reports",
    description: "The recurring roll-up of sales, registrations and revenue.",
    audience: "Team",
    template: "events.sales_digest",
    live: false,
  },
  {
    key: "data_request",
    group: "team",
    label: "Data request updates",
    description: "Acknowledges and closes out a guest's export or erasure request.",
    audience: "Guest",
    template: "events.data_request",
    live: false,
  },

  // --- Program & content -----------------------------------------------------
  {
    key: "cfp_submission_received",
    group: "program",
    label: "Talk submission received",
    description: "Acknowledges a Call for Papers submission.",
    audience: "Speaker",
    template: "events.cfp_submission_received",
    live: false,
  },
  {
    key: "cfp_decision",
    group: "program",
    label: "Talk accepted or declined",
    description: "The review decision, with next steps when accepted.",
    audience: "Speaker",
    template: "events.cfp_decision",
    live: false,
  },
  {
    key: "speaker_invite",
    group: "program",
    label: "Speaker portal invite",
    description: "Access to Speaker Backstage to upload bio, slides and availability.",
    audience: "Speaker",
    template: "events.speaker_invite",
    live: false,
  },
  {
    key: "session_reminder",
    group: "program",
    label: "Session starting soon",
    description: "Reminder for a session on someone's agenda, or a stream going live.",
    audience: "Guest",
    template: "events.session_reminder",
    live: false,
  },
  {
    key: "recording_available",
    group: "program",
    label: "Recording available",
    description: "Tells attendees the replay is up in the portal.",
    audience: "Guest",
    template: "events.recording_available",
    live: false,
  },
  {
    key: "certificate_issued",
    group: "program",
    label: "Certificate issued",
    description: "Delivers a CEU certificate of attendance.",
    audience: "Guest",
    template: "events.certificate_issued",
    live: false,
  },

  // --- Partners & suppliers --------------------------------------------------
  {
    key: "sponsor_confirmation",
    group: "partners",
    label: "Sponsorship or booth confirmed",
    description: "Confirms a package or expo booth and what it includes.",
    audience: "Sponsor",
    template: "events.sponsor_confirmation",
    live: false,
  },
  {
    key: "venue_rfp",
    group: "partners",
    label: "Venue RFP",
    description: "Sends a sourcing proposal request out to a shortlisted venue.",
    audience: "Venue",
    template: "events.venue_rfp",
    live: false,
  },
  {
    key: "booking_confirmation",
    group: "partners",
    label: "Booking confirmed",
    description: "Instant Book and housing/travel reservations.",
    audience: "Supplier",
    template: "events.booking_confirmation",
    live: false,
  },
  {
    key: "purchase_order",
    group: "partners",
    label: "Purchase order",
    description: "Emails an inventory purchase order to the supplier.",
    audience: "Supplier",
    template: "events.purchase_order",
    live: false,
  },
  {
    key: "affiliate_approved",
    group: "partners",
    label: "Affiliate application approved",
    description: "Sends the affiliate their referral link. Needs the Affiliates add-on.",
    audience: "Affiliate",
    template: "events.affiliate_approved",
    live: false,
  },
  {
    key: "affiliate_payout",
    group: "partners",
    label: "Affiliate payout sent",
    description: "Confirms cleared commission and the amount paid.",
    audience: "Affiliate",
    template: "events.affiliate_payout",
    live: false,
  },

  // --- Marketing & campaigns -------------------------------------------------
  {
    key: "campaign_broadcast",
    group: "marketing",
    label: "Campaign broadcasts",
    description: "One-off sends from Campaigns and Email Invites.",
    audience: "Audience",
    template: "events.campaign_broadcast",
    live: false,
  },
  {
    key: "drip_sequence",
    group: "marketing",
    label: "Drip sequences",
    description: "Automated multi-step nurture sends.",
    audience: "Audience",
    template: "events.drip_sequence",
    live: false,
  },
];

export const EMAIL_NOTIFICATION_KEYS = EMAIL_NOTIFICATIONS.map((n) => n.key);

export function notificationsInGroup(groupKey) {
  return EMAIL_NOTIFICATIONS.filter((n) => n.group === groupKey);
}

// Every type is on by default — an unwired type simply never fires, so opting in
// up front means a send site starts working the moment it is built.
export const defaultNotificationConfig = () => ({
  enabled: true,
  types: Object.fromEntries(EMAIL_NOTIFICATION_KEYS.map((key) => [key, true])),
});

// Is `key` allowed for this config bag? Unknown keys and a missing bag default
// to allowed, so a newly added catalog entry is never silently suppressed.
export function isNotificationAllowed(config, key) {
  if (!config || typeof config !== "object") return true;
  if (config.enabled === false) return false;
  const types = config.types && typeof config.types === "object" ? config.types : {};
  return types[key] !== false;
}
