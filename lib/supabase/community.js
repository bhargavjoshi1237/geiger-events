"use client";

import { makeRecordsApi } from "./records";

// Data-access for the Community area — the events.community_records table, one
// uniform store shared by every module (Polls, Surveys, Announcements),
// discriminated by `module`. All logic lives in the shared records factory.

export const communityApi = makeRecordsApi("community_records");
