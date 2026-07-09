"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { analyticsApi } from "@/lib/supabase/analytics";
import { MODULES } from "./modules";

// Thin per-module screen export over the shared RecordsScreen. Only Scheduled
// Reports is a record set; wired into registry.jsx under that exact title.

export function ScheduledReportsScreen() {
  return <RecordsScreen mod={MODULES.report} api={analyticsApi} />;
}
