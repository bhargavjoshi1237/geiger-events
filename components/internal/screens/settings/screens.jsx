"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { settingsApi } from "@/lib/supabase/workspace_settings";
import { MODULES } from "./modules";

// Thin per-module screen exports over the shared RecordsScreen, one per Settings
// sidebar title. Wired into registry.jsx under the exact titles.

const screen = (key) => {
  const mod = MODULES[key];
  function ModuleScreen() {
    return <RecordsScreen mod={mod} api={settingsApi} />;
  }
  ModuleScreen.displayName = `${mod.singular.replace(/\s+/g, "")}Screen`;
  return ModuleScreen;
};

export const TeamMembersScreen = screen("member");
export const RolesPermissionsScreen = screen("role");
export const ApiWebhooksScreen = screen("apikey");
export const CustomDomainsScreen = screen("domain");
