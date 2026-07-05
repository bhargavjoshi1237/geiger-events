"use client";

import React from "react";

import { CampaignsScreen } from "./campaigns";
import { LENS } from "./constants";

// Channel/type lenses onto the Campaigns hub. Each pre-filters the list and
// pre-sets the create dialog (see LENS in constants). Segmentation folds onto
// the shared Segments screen; Template Builder / Drip Sequences / Deliverability
// / Personalization are their own screens — not lenses.

const lens = (key) => {
  function LensScreen() {
    return <CampaignsScreen preset={LENS[key]} />;
  }
  LensScreen.displayName = `${key.replace(/\s+/g, "")}Screen`;
  return LensScreen;
}

export const NewslettersScreen = lens("Newsletters");
export const EmailInvitesScreen = lens("Email Invites");
export const SmsInvitesScreen = lens("SMS Invites");
export const WhatsAppInvitesScreen = lens("WhatsApp Invites");
export const TextBlastsScreen = lens("Text Blasts");
export const AutomatedRemindersScreen = lens("Automated Reminders");
export const PushNotificationsScreen = lens("Push Notifications");
export const AbTestingScreen = lens("A/B Testing");
export const SendSchedulingScreen = lens("Send Scheduling");
