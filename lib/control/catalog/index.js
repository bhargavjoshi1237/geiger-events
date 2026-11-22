import { ADVERTISING_MODULES } from "./advertising.js";
import { ANALYTICS_MODULES } from "./analytics.js";
import { CHECKIN_SETTINGS } from "./checkin_settings.js";
import { COMMUNITY_MODULES } from "./community.js";
import { CONFERENCE_MODULES } from "./conference.js";
import { EVENT_LIST_SETTINGS } from "./event_lists.js";
import { EVENT_SETTINGS as EVENT_OBJECT_SETTINGS } from "./event_settings.js";
import { CHECKIN_OPS_SCREENS } from "./screens/checkin_ops.js";
import { COMMUNITY_MODERATION_SCREENS } from "./screens/community_moderation.js";
import { EVENTS_VENUES_SCREENS } from "./screens/events_venues.js";
import { FINAL_SCREENS } from "./screens/final.js";
import { GUESTS_REGISTRATIONS_SCREENS } from "./screens/guests_registrations.js";
import { INVENTORY_SCREENS } from "./screens/inventory.js";
import { ORDERS_MONEY_SCREENS } from "./screens/orders_money.js";
import { TEAM_SETTINGS_SCREENS } from "./screens/team_settings.js";
import { SECTION_BY_KEY, SECTIONS } from "./sections.js";
import { STORES } from "./stores.js";
import { TICKETING_MODULES } from "./ticketing.js";
import { TICKETING_SETTINGS } from "./ticketing_settings.js";

// Every module and settings page Control can manage generically, keyed by catalog id ("conference.speaker", "checkin.kiosk").

export const MODULES = [...TICKETING_MODULES, ...CONFERENCE_MODULES, ...COMMUNITY_MODULES, ...ANALYTICS_MODULES, ...ADVERTISING_MODULES];
export const SETTINGS = [...TICKETING_SETTINGS, ...CHECKIN_SETTINGS];
// The event editor's sections: list and single-value ones first (FAQ, description…), then object-shaped ones.
export const EVENT_SETTINGS = [...EVENT_LIST_SETTINGS, ...EVENT_OBJECT_SETTINGS];

// Hand-built Control screens for areas that aren't generic records or settings.
export const SCREENS = [
  ...EVENTS_VENUES_SCREENS,
  ...GUESTS_REGISTRATIONS_SCREENS,
  ...ORDERS_MONEY_SCREENS,
  ...INVENTORY_SCREENS,
  ...CHECKIN_OPS_SCREENS,
  ...COMMUNITY_MODERATION_SCREENS,
  ...TEAM_SETTINGS_SCREENS,
  ...FINAL_SCREENS,
];

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));
export const SETTING_BY_ID = new Map(SETTINGS.map((s) => [s.id, s]));
export const EVENT_SETTING_BY_ID = new Map(EVENT_SETTINGS.map((s) => [s.id, s]));

export function findEventSetting(id) {
  return EVENT_SETTING_BY_ID.get(id) || null;
}

export function findModule(id) {
  return MODULE_BY_ID.get(id) || null;
}

export function findSetting(id) {
  return SETTING_BY_ID.get(id) || null;
}

export function sectionOf(descriptor) {
  return SECTION_BY_KEY.get(descriptor.section) || null;
}

// Sections with anything to manage, in sidebar order, each listing its screens, modules and settings in catalog order.
export function catalogSections(allowedKeys) {
  return SECTIONS.filter((section) => allowedKeys.has(section.key))
    .map((section) => ({
      ...section,
      screens: SCREENS.filter((s) => s.section === section.key),
      modules: MODULES.filter((m) => m.section === section.key),
      settings: SETTINGS.filter((s) => s.section === section.key),
    }))
    .filter((section) => section.screens.length || section.modules.length || section.settings.length);
}

export { SECTIONS, STORES };
