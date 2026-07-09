"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { conferenceApi } from "@/lib/supabase/conference";
import { MODULES } from "./modules";

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
export const VenueSourcingScreen = screen("venue_lead");
export const HousingTravelScreen = screen("housing");
export const CallForPapersScreen = screen("paper");
export const CertificatesScreen = screen("certificate");
export const AgendaBuilderScreen = screen("session");
export const RecordingsScreen = screen("recording");
