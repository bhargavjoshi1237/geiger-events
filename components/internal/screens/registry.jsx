import { EventsOverviewScreen } from "./overview/events_overview";
import { EventsHomeScreen } from "./events/events_home";
import { AllEventsScreen } from "./events/all_events";
import { TemplatesScreen } from "./events/templates";
import { EventSeriesScreen } from "./events/event_series";
import { EventWallScreen } from "./events/event_wall/wall_detail";
import { RegistrationsScreen } from "./registrations/registrations";
import { RegistrationFormsScreen } from "./registrations/registration_forms";
import { WaitlistScreen } from "./registrations/waitlist";
import { ApprovalGatesScreen } from "./registrations/approval_gates";
import { CapacityLimitsScreen } from "./registrations/capacity_limits";
import { DietaryAccessibilityScreen } from "./registrations/dietary_accessibility";
import {
  RegisterOnBehalfScreen,
  PlusOnesScreen,
  ConditionalQuestionsScreen,
  GroupRegistrationScreen,
  TokenGatedScreen,
  MemberOnlyScreen,
  RegistrationDeadlinesScreen,
  AutofillReturningScreen,
  ConfirmationPageScreen,
  WaitlistAutoPromotionScreen,
} from "./registrations/folded_redirect";
import { AllWorkflowsScreen } from "./workflows/all_workflows";
import { VenuesScreen } from "./venues/all_venues";
import { TicketTypesScreen } from "./tickets/ticket_types";
import { DiscountsScreen } from "./tickets/discounts";
import { PaymentMethodsScreen } from "./tickets/payment_methods";
import { PayoutsScreen } from "./tickets/payouts";
import { DynamicPricingScreen } from "./tickets/dynamic_pricing";
import { OrdersAttendeesScreen } from "./tickets/orders_attendees";
import { InvoiceProfilesScreen } from "./tickets/invoice_profiles";
import { ContactBookScreen } from "./guests/contact_book";
import { GuestListScreen } from "./guests/guest_list";
import { SegmentsScreen } from "./guests/segments";
import { DataRequestsScreen } from "./guests/data_requests";

/**
 * Maps a sidebar nav title to its screen component. Titles must exactly match
 * the `title` fields in `components/internal/sidebar/sidebar_nav.jsx`.
 *
 * Per-event features (cover media, tickets, visibility, sharing, etc.) are NOT
 * top-level screens — they live as tabs inside the Event editor
 * (`events/event_detail.jsx`), opened by selecting an event in All Events.
 *
 * Anything not listed here falls back to the ComingSoonScreen.
 */
export const SCREEN_REGISTRY = {
  // Overview
  Overview: EventsOverviewScreen,

  // Events area (workspace-level only)
  Events: EventsHomeScreen,
  "All Events": AllEventsScreen,
  Templates: TemplatesScreen,
  "Event Series": EventSeriesScreen,
  "Event Wall": EventWallScreen,

  // Venues area (workspace-level). The sectioned venue editor opens by
  // selecting a row (?venue=<id>); per-venue concerns are its sections.
  Venues: VenuesScreen,

  // Tickets area. Ticket Types is a reusable-records screen (like Discounts).
  // The rest are GLOBAL project-level record managers (reusable coupons, rules,
  // methods, policies, profiles — each with its own edit page) that get attached
  // to an event from the event editor's Ticketing section. Orders & Attendees
  // also carries a cross-event orders list. See screens/tickets/.
  "Ticket Types": TicketTypesScreen,
  "Discounts & Codes": DiscountsScreen,
  "Payments & Methods": PaymentMethodsScreen,
  Payouts: PayoutsScreen,
  "Dynamic Pricing": DynamicPricingScreen,
  "Orders & Attendees": OrdersAttendeesScreen,
  "Invoices & Receipts": InvoiceProfilesScreen,

  // Registrations area. Six substantive screens; the remaining sub-items are
  // per-entity config/behaviours that fold onto a host screen with a context
  // banner (see registrations/folded_redirect.jsx) — never ComingSoon.
  RSVPs: RegistrationsScreen,
  "Registration Forms": RegistrationFormsScreen,
  Waitlist: WaitlistScreen,
  "Approval Gates": ApprovalGatesScreen,
  "Capacity Limits": CapacityLimitsScreen,
  "Dietary & Accessibility": DietaryAccessibilityScreen,
  // Folded → host screen + banner.
  "Plus-ones": PlusOnesScreen,
  "Token-gated": TokenGatedScreen,
  "Member-only": MemberOnlyScreen,
  "Conditional Questions": ConditionalQuestionsScreen,
  "Group Registration": GroupRegistrationScreen,
  "Registration Deadlines": RegistrationDeadlinesScreen,
  "Autofill Returning": AutofillReturningScreen,
  "Register on Behalf": RegisterOnBehalfScreen,
  "Waitlist Auto-promotion": WaitlistAutoPromotionScreen,
  "Confirmation Page": ConfirmationPageScreen,

  // Guests area — four workspace destinations. Contact Book is the CRM hub:
  // Import, Find duplicates and Block-an-email are actions on it (Import/Dedupe
  // open as sub-views), and the old Blocklist is a "Blocked" filter. Per-contact
  // surfaces (profile, tags/notes, activity, consent) are its drawer tabs;
  // Who's-going / attendee export live on Guest List.
  "Guest List": GuestListScreen,
  "Contact Book": ContactBookScreen,
  Segments: SegmentsScreen,
  "Data Requests": DataRequestsScreen,

  // Workflows area (automation engine). The dual-view builder (list + canvas)
  // opens from a row in All Workflows. The parent "Workflows" tab shows the
  // list; "Workflow Templates" and "Run History" are deferred ⇒ ComingSoon.
  Workflows: AllWorkflowsScreen,
  "All Workflows": AllWorkflowsScreen,
};

export function getScreen(title) {
  return SCREEN_REGISTRY[title] || null;
}
