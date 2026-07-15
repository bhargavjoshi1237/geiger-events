"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { advertisingApi } from "@/lib/supabase/advertising";
import { MODULES } from "./modules";

// Thin per-module screen exports over the shared RecordsScreen, one per record-
// backed Advertising sidebar title (mirrors conference/screens.jsx). Each is
// wired into registry.jsx under the exact sidebar title. Connections and Insights
// are bespoke and live in their own files.

const screen = (key) => {
  const mod = MODULES[key];
  function ModuleScreen() {
    return <RecordsScreen mod={mod} api={advertisingApi} />;
  }
  ModuleScreen.displayName = `${mod.singular.replace(/\s+/g, "")}Screen`;
  return ModuleScreen;
};

export const AdCampaignsScreen = screen("campaign");
export const BudgetsScreen = screen("budget");
