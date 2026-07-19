"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { conferenceApi } from "@/lib/supabase/conference";
import { MODULES } from "./modules";

// Bespoke screens that outgrow the flat record list live in their own files and
// are re-exported here: Agenda Builder (event → schedule), Floor Plan & Booths
// (interactive expo map), Mobile Event App (singleton config + live preview).
export { AgendaBuilderScreen } from "./agenda_builder";
export { FloorPlanScreen } from "./floor_plan";
export { MobileAppScreen } from "./mobile_app";
export { CaptionsTranscriptionScreen } from "./captions";
export { VenueSourcingScreen } from "./venue_sourcing";
export { HousingTravelScreen } from "./housing_travel";

// Thin per-module screen exports over the shared RecordsScreen, one per
// Conference sidebar title (mirrors campaigns/lenses.jsx). Each is wired into
// registry.jsx under the exact sidebar title.

const screen = (key) => {
  const mod = MODULES[key];
  function ModuleScreen() {
    return <RecordsScreen mod={mod} api={conferenceApi} />;
  }
  ModuleScreen.displayName = `${mod.singular.replace(/\s+/g, "")}Screen`;
  return ModuleScreen;
};

export const SpeakersScreen = screen("speaker");
export const SponsorsScreen = screen("sponsor");
export const SponsorshipPackagesScreen = screen("package");
export const ExpoBoothsScreen = screen("booth");
export const CallForPapersScreen = screen("paper");
export const CertificatesScreen = screen("certificate");
export const RecordingsScreen = screen("recording");
export const SpeakerBackstageScreen = screen("backstage");
export const LivestreamRoomsScreen = screen("room");
export const WebinarRoomsScreen = screen("webinar");
export const BreakoutRoomsScreen = screen("breakout");
export const SponsorRoomsScreen = screen("sponsor_room");
export const SpeakerPortalScreen = screen("portal_invite");
export const SimuliveOnDemandScreen = screen("simulive");
export const AssignAgendaScreen = screen("agenda_assignment");
