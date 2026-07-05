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
import { WorkflowTemplatesScreen } from "./workflows/workflow_templates";
import { RunHistoryScreen } from "./workflows/run_history";
import { VenuesScreen } from "./venues/all_venues";
import { OrganiserProfileScreen } from "./discovery/organiser_profile";
import { TicketTypesScreen } from "./tickets/ticket_types";
import { TicketTiersScreen } from "./tickets/ticket_tiers";
import { DiscountsScreen } from "./tickets/discounts";
import { PaymentMethodsScreen } from "./tickets/payment_methods";
import { PayoutsScreen } from "./tickets/payouts";
import { DynamicPricingScreen } from "./tickets/dynamic_pricing";
import { OrdersAttendeesScreen } from "./tickets/orders_attendees";
import { InvoiceProfilesScreen } from "./tickets/invoice_profiles";
import { BundlesScreen } from "./tickets/bundles";
import { MultiCurrencyScreen } from "./tickets/multi_currency";
import { AntiScalpingScreen } from "./tickets/anti_scalping";
import { EarlybirdSalesScreen } from "./tickets/earlybird";
import { DonationsScreen } from "./tickets/donations";
import { AccessCodeTicketsScreen } from "./tickets/access_codes";
import { ReservedSeatingScreen } from "./tickets/reserved_seating";
import { RefundsScreen } from "./tickets/refunds";
import { PaymentPlansScreen } from "./tickets/payment_plans";
import { TransfersScreen } from "./tickets/transfers";
import { GroupPurchasingScreen } from "./tickets/group_purchasing";
import { TaxesScreen } from "./tickets/taxes";
import { MembershipPlansScreen } from "./memberships/membership_plans";
import { MembersScreen } from "./memberships/members";
import { MembershipSettingsScreen } from "./memberships/membership_settings";
import { ContactBookScreen } from "./guests/contact_book";
import { GuestListScreen } from "./guests/guest_list";
import { WhosGoingScreen } from "./guests/whos_going";
import { AttendeeExportScreen } from "./guests/attendee_export";
import { SegmentsScreen } from "./guests/segments";
import { TagsScreen } from "./guests/tags";
import { NotesScreen } from "./guests/notes";
import { DataRequestsScreen } from "./guests/data_requests";
import { QrTicketsScreen } from "./checkin/qr_tickets";
import { WalletPassesScreen } from "./checkin/wallet_passes";
import { CheckinAppScreen } from "./checkin/checkin_app";
import { DoorSalesScreen } from "./checkin/door_sales";
import { OfflineCheckinScreen } from "./checkin/offline_checkin";
import { KioskModeScreen } from "./checkin/kiosk_mode";
import { BadgePrintingScreen } from "./checkin/badge_printing";
import { SessionCheckinScreen } from "./checkin/session_checkin";
import { RfidNfcScreen } from "./checkin/rfid_nfc";
import { SelfCheckinScreen } from "./checkin/self_checkin";
import { MultiGateZonesScreen } from "./checkin/multigate_zones";
import { RealTimeAttendanceScreen } from "./checkin/real_time_attendance";
import { StaffScanningRolesScreen } from "./checkin/staff_scanning_roles";
import { LeadRetrievalScreen } from "./checkin/lead_retrieval";
import { NameSearchLookupScreen } from "./checkin/name_search_lookup";
import { CampaignsScreen } from "./campaigns/campaigns";
import {
  NewslettersScreen,
  EmailInvitesScreen,
  SmsInvitesScreen,
  WhatsAppInvitesScreen,
  TextBlastsScreen,
  AutomatedRemindersScreen,
  PushNotificationsScreen,
  AbTestingScreen,
  SendSchedulingScreen,
} from "./campaigns/lenses";
import { SegmentationScreen } from "./campaigns/segmentation";
import { EmailTemplateBuilderScreen } from "./campaigns/email_template_builder";
import { DripSequencesScreen } from "./campaigns/drip_sequences";
import { DeliverabilityScreen } from "./campaigns/deliverability";
import { PersonalizationScreen } from "./campaigns/personalization";

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

  // Discovery — a single destination: the project's public organiser profile
  // (rendered on the /w/<slug> wall) and the audience following it for updates.
  Discovery: OrganiserProfileScreen,

  // Tickets area. Ticket Types is a reusable-records screen (like Discounts).
  // The rest are GLOBAL project-level record managers (reusable coupons, rules,
  // methods, policies, profiles — each with its own edit page) that get attached
  // to an event from the event editor's Ticketing section. Orders & Attendees
  // also carries a cross-event orders list. See screens/tickets/.
  "Ticket Types": TicketTypesScreen,
  "Ticket Tiers": TicketTiersScreen,
  "Discounts & Codes": DiscountsScreen,
  "Payments & Methods": PaymentMethodsScreen,
  Payouts: PayoutsScreen,
  "Dynamic Pricing": DynamicPricingScreen,
  Bundles: BundlesScreen,
  "Multi-currency": MultiCurrencyScreen,
  "Anti-scalping & Resale": AntiScalpingScreen,
  "Early-bird Sales": EarlybirdSalesScreen,
  Donations: DonationsScreen,
  "Access-code Tickets": AccessCodeTicketsScreen,
  "Reserved Seating": ReservedSeatingScreen,
  Refunds: RefundsScreen,
  "Payment Plans": PaymentPlansScreen,
  Transfers: TransfersScreen,
  "Group Purchasing": GroupPurchasingScreen,
  Taxes: TaxesScreen,
  "Orders & Attendees": OrdersAttendeesScreen,
  "Invoices & Receipts": InvoiceProfilesScreen,

  // Memberships area (own sidebar section). Plans are reusable records
  // (ticketing_records module 'membership'); Members is the enrollment roster;
  // Membership Settings is the project-global enable + join config.
  "Membership Plans": MembershipPlansScreen,
  Members: MembersScreen,
  "Membership Settings": MembershipSettingsScreen,

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

  // Guests area — the CRM hub + audience tools. Contact Book is the hub: Import,
  // Find duplicates and Block-an-email are actions on it (Import/Dedupe open as
  // sub-views), and the old Blocklist is a "Blocked" filter. Guest List is the
  // all-time roster; Who's Going is the upcoming-only lens; Attendee Export builds
  // exports many ways; Tags manages the contact tag vocabulary; Notes is the
  // cross-contact note feed. Per-contact surfaces (profile, tags/notes, activity,
  // consent) remain the Contact Book drawer tabs.
  "Contact Book": ContactBookScreen,
  "Guest List": GuestListScreen,
  "Who's Going": WhosGoingScreen,
  "Attendee Export": AttendeeExportScreen,
  Segments: SegmentsScreen,
  Tags: TagsScreen,
  Notes: NotesScreen,
  "Data Requests": DataRequestsScreen,

  // Workflows area (automation engine). The dual-view builder (list + canvas)
  // opens from a row in All Workflows. Workflow Templates is a curated gallery
  // whose "Use template" mints a workflow and hands off to the builder; Run
  // History logs each execution (reads events.workflow_runs).
  Workflows: AllWorkflowsScreen,
  "All Workflows": AllWorkflowsScreen,
  "Workflow Templates": WorkflowTemplatesScreen,
  "Run History": RunHistoryScreen,

  // Check-in area. Global settings screens (QR, wallet, app, door, kiosk,
  // session, RFID, self, gates) turn features on for the project + configure
  // them; each also gets a per-event enable in the event editor's Check-in
  // group. Report/rules screens (Real-time Attendance, Badge Printing, Lead
  // Retrieval, Name-search Lookup, Staff Scanning Roles) read/write the check-in
  // data layer. Offline Check-in is a themed under-development surface. The
  // Phase-2 staff routes (scanner/kiosk/door POS) are separate app routes.
  // "Capacity Control" and "Smart Badges" stay on ComingSoon for now.
  "QR Tickets": QrTicketsScreen,
  "Wallet Passes": WalletPassesScreen,
  "Check-in App": CheckinAppScreen,
  "Door Sales": DoorSalesScreen,
  "Offline Check-in": OfflineCheckinScreen,
  "Kiosk Mode": KioskModeScreen,
  "Badge Printing": BadgePrintingScreen,
  "Session Check-in": SessionCheckinScreen,
  "RFID / NFC": RfidNfcScreen,
  "Self Check-in": SelfCheckinScreen,
  "Multi-gate & Zones": MultiGateZonesScreen,
  "Real-time Attendance": RealTimeAttendanceScreen,
  "Staff Scanning Roles": StaffScanningRolesScreen,
  "Lead Retrieval": LeadRetrievalScreen,
  "Name-search Lookup": NameSearchLookupScreen,

  // Campaigns area. One hub (Campaigns) backs a channel-aware records list +
  // editor; the channel/type sub-items are preset-filtered LENSES onto that hub
  // (Newsletters, Invites, Blasts, Reminders, Push, plus A/B Testing and Send
  // Scheduling). Email Template Builder and Drip Sequences are reusable-records
  // screens; Deliverability and Personalization are project-settings singletons;
  // Segmentation folds onto the shared Segments screen. See screens/campaigns/.
  Campaigns: CampaignsScreen,
  Newsletters: NewslettersScreen,
  "Automated Reminders": AutomatedRemindersScreen,
  "Email Invites": EmailInvitesScreen,
  "SMS Invites": SmsInvitesScreen,
  "WhatsApp Invites": WhatsAppInvitesScreen,
  "Text Blasts": TextBlastsScreen,
  Segmentation: SegmentationScreen,
  "Email Template Builder": EmailTemplateBuilderScreen,
  "Drip Sequences": DripSequencesScreen,
  "A/B Testing": AbTestingScreen,
  "Send Scheduling": SendSchedulingScreen,
  Deliverability: DeliverabilityScreen,
  Personalization: PersonalizationScreen,
  "Push Notifications": PushNotificationsScreen,
};

export function getScreen(title) {
  return SCREEN_REGISTRY[title] || null;
}
