"use client";

import { makeRecordsApi } from "./records";

// Data-access for the Settings area — the events.settings_records table, one
// uniform store shared by every module (Team & Members, Roles & Permissions,
// API & Webhooks, Custom Domains), discriminated by `module`. All logic lives in
// the shared records factory. (Usage is a read-only dashboard, not a record set.)

export const settingsApi = makeRecordsApi("settings_records");
