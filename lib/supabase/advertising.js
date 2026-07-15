"use client";

import { makeRecordsApi, normalizeRecord } from "./records";

// Data-access for the Advertising area — the events.advertising_records table,
// one uniform store shared by every module (Connections, Ad Campaigns, Budgets),
// discriminated by `module`. It is the wrapper over the ad platforms (Google
// AdSense, Facebook Marketplace, Google Ads, Meta Ads): connection rows hold the
// per-platform account fields a live OAuth sync would later fill. All logic lives
// in the shared records factory; this file just binds the table.

export const advertisingApi = makeRecordsApi("advertising_records");

export { normalizeRecord };
