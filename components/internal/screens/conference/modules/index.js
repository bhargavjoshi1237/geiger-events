// The Conference modules, expressed declaratively — one file per module. The
// shared records kit (records_kit.jsx) renders the list (columns/stats/filters/
// create) and the adaptive detail (rich = section nav + fields/render; light =
// field panels). Every module is backed by events.conference_records,
// discriminated by `key`.
//
// Bespoke screens (Agenda Builder, Floor Plan & Booths, Mobile Event App) live
// in their own files. Assign Agenda is a module here that reuses the "session"
// records; Floor Plan reuses the "booth" records.
//
// Column/stat/filter/field factories are shared (records/builders.jsx); the
// helpers specific to this area (media section, schedule label, presence sum)
// live in ./shared.

import { SPEAKER_MODULE } from "./speaker";
import { SPONSOR_MODULE } from "./sponsor";
import { PACKAGE_MODULE } from "./package";
import { BOOTH_MODULE } from "./booth";
import { VENUE_LEAD_MODULE } from "./venue_lead";
import { HOUSING_MODULE } from "./housing";
import { PAPER_MODULE } from "./paper";
import { CERTIFICATE_MODULE } from "./certificate";
import { SESSION_MODULE } from "./session";
import { RECORDING_MODULE } from "./recording";
import { BACKSTAGE_MODULE } from "./backstage";
import { ROOM_MODULE } from "./room";
import { WEBINAR_MODULE } from "./webinar";
import { BREAKOUT_MODULE } from "./breakout";
import { SPONSOR_ROOM_MODULE } from "./sponsor_room";
import { PORTAL_INVITE_MODULE } from "./portal_invite";
import { SIMULIVE_MODULE } from "./simulive";
import { CAPTION_MODULE } from "./caption";
import { AGENDA_ASSIGNMENT_MODULE } from "./agenda_assignment";

// Insertion order is the order the modules appear across the Conference area.
export const MODULES = {
  speaker: SPEAKER_MODULE,
  sponsor: SPONSOR_MODULE,
  package: PACKAGE_MODULE,
  booth: BOOTH_MODULE,
  venue_lead: VENUE_LEAD_MODULE,
  housing: HOUSING_MODULE,
  paper: PAPER_MODULE,
  certificate: CERTIFICATE_MODULE,
  session: SESSION_MODULE,
  recording: RECORDING_MODULE,
  backstage: BACKSTAGE_MODULE,
  room: ROOM_MODULE,
  webinar: WEBINAR_MODULE,
  breakout: BREAKOUT_MODULE,
  sponsor_room: SPONSOR_ROOM_MODULE,
  portal_invite: PORTAL_INVITE_MODULE,
  simulive: SIMULIVE_MODULE,
  caption: CAPTION_MODULE,
  agenda_assignment: AGENDA_ASSIGNMENT_MODULE,
};

export const MODULE_LIST = Object.values(MODULES);
