"use client";

import React from "react";

import { RecordsScreen } from "@/components/internal/shared/records/records_kit";
import { analyticsApi } from "@/lib/supabase/analytics";
import { MODULES } from "./modules";

// Thin per-module screen export over the shared RecordsScreen. Only Scheduled
// Reports is a record set; the remaining Analytics items are ECharts dashboards
// over frontend demo data (see demo_data.js) until the supabase views land.

export { SalesScreen as SalesDashboardScreen } from "./sales";
export { AttendanceScreen as AttendanceDashboardScreen } from "./sales";
export { CrossEventScreen as CrossEventDashboardScreen } from "./sales";
export { RealtimeScreen as RealtimeDashboardScreen } from "./sales";
export { TrafficScreen as TrafficDashboardScreen } from "./acquisition";
export { FunnelScreen as FunnelDashboardScreen } from "./acquisition";
export { EmailScreen as EmailDashboardScreen } from "./acquisition";
export { EngagementScreen as EngagementDashboardScreen } from "./acquisition";
export { SponsorScreen as SponsorDashboardScreen } from "./value";
export { ForecastScreen as ForecastDashboardScreen } from "./value";
export { SurveysScreen as SurveysDashboardScreen } from "./value";
export { DemographicsScreen as DemographicsDashboardScreen } from "./value";

export function ScheduledReportsScreen() {
  return <RecordsScreen mod={MODULES.report} api={analyticsApi} />;
}
