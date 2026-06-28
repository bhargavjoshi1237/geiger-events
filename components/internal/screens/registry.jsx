import { EventsOverviewScreen } from "./overview/events_overview";
import { EventsHomeScreen } from "./events/events_home";
import { AllEventsScreen } from "./events/all_events";
import { TemplatesScreen } from "./events/templates";
import { EventSeriesScreen } from "./events/event_series";
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

  // Workflows area (automation engine). The dual-view builder (list + canvas)
  // opens from a row in All Workflows. The parent "Workflows" tab shows the
  // list; "Workflow Templates" and "Run History" are deferred ⇒ ComingSoon.
  Workflows: AllWorkflowsScreen,
  "All Workflows": AllWorkflowsScreen,
};

export function getScreen(title) {
  return SCREEN_REGISTRY[title] || null;
}
