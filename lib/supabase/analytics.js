"use client";

import { makeRecordsApi } from "./records";

// Data-access for the Analytics area's record-shaped surfaces — the
// events.analytics_records table, discriminated by `module`. Only Scheduled
// Reports is a record set; the rest of Analytics is read-only dashboards.

export const analyticsApi = makeRecordsApi("analytics_records");
