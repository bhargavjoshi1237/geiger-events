"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { communityApi } from "@/lib/supabase/community";
import { MODULES } from "./modules";

// Thin per-module screen exports over the shared RecordsScreen, one per Community
// sidebar title. Wired into registry.jsx under the exact titles.

const screen = (key) => {
  const mod = MODULES[key];
  function ModuleScreen() {
    return <RecordsScreen mod={mod} api={communityApi} />;
  }
  ModuleScreen.displayName = `${mod.singular.replace(/\s+/g, "")}Screen`;
  return ModuleScreen;
};

export const PollsScreen = screen("poll");
export const SurveysScreen = screen("survey");
export const AnnouncementsScreen = screen("announcement");
