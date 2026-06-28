"use client";

import React from "react";
import { Info } from "lucide-react";

import { RegistrationsScreen } from "./registrations";
import { RegistrationFormsScreen } from "./registration_forms";
import { WaitlistScreen } from "./waitlist";

// Several Registrations sidebar sub-items are per-entity config or behaviours
// rather than standalone workspace surfaces (per the architecture rule:
// per-entity config isn't a top-level screen). Instead of duplicate tables,
// they resolve to their host screen with a short banner explaining where the
// feature actually lives — so every sidebar entry is real and reachable.

function FoldedBanner({ message }) {
  return (
    <div className="w-full px-2 pt-4 lg:px-0 lg:max-w-[85%] mx-auto">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

// Build a screen that shows the banner above a host screen.
function folded(Host, message) {
  function FoldedScreen() {
    return (
      <>
        <FoldedBanner message={message} />
        <Host />
      </>
    );
  }
  return FoldedScreen;
}

// --- Folded onto RSVPs (RegistrationsScreen) ---------------------------------
export const RegisterOnBehalfScreen = folded(
  RegistrationsScreen,
  "Register someone on their behalf with “Add registrant” here on RSVPs — comps, VIPs, and phone signups are added as organizer entries.",
);

export const PlusOnesScreen = folded(
  RegistrationsScreen,
  "Plus-ones are managed per registration. Open any registrant to view and edit their named guests; the party size shows in the table.",
);

// --- Folded onto Registration Forms ------------------------------------------
export const ConditionalQuestionsScreen = folded(
  RegistrationFormsScreen,
  "Conditional questions are built in the form builder — open a form’s Fields tab and add a “show when” rule to any question.",
);

export const GroupRegistrationScreen = folded(
  RegistrationFormsScreen,
  "Group registration is a form setting — enable it on a form’s Access tab to let one person register a team and collect details per seat.",
);

export const TokenGatedScreen = folded(
  RegistrationFormsScreen,
  "Token-gating is a form access rule — turn it on in a form’s Access tab to require a connected wallet holding a specific token.",
);

export const MemberOnlyScreen = folded(
  RegistrationFormsScreen,
  "Member-only access is a form rule — set it on a form’s Access tab to restrict registration to your members or an email domain.",
);

export const RegistrationDeadlinesScreen = folded(
  RegistrationFormsScreen,
  "Open and close windows are set per form on the Access tab — registration opens and closes automatically on those dates.",
);

export const AutofillReturningScreen = folded(
  RegistrationFormsScreen,
  "Autofill for returning guests is a form toggle on the Access tab — recognised contacts get their known fields pre-filled.",
);

export const ConfirmationPageScreen = folded(
  RegistrationFormsScreen,
  "The post-registration confirmation page is edited on each form’s Confirmation tab — heading, message, calendar links, and sharing.",
);

// --- Folded onto Waitlist ----------------------------------------------------
export const WaitlistAutoPromotionScreen = folded(
  WaitlistScreen,
  "Auto-promotion rules are set per event — use “Rules” on any event’s waitlist to enable auto-promote, the claim window, and notifications.",
);
