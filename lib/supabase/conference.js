"use client";

import { makeRecordsApi, normalizeRecord } from "./records";

// Data-access for the Conference area — the events.conference_records table, one
// uniform store shared by every module (Speakers, Sponsors, Sponsorship
// Packages, Expo Booths, Venue Sourcing, Housing & Travel, Call for Papers, CEU
// & Certificates, Agenda / Sessions, Recordings), discriminated by `module`.
// All logic lives in the shared records factory; this file just binds the table.

export const conferenceApi = makeRecordsApi("conference_records");

export { normalizeRecord };
