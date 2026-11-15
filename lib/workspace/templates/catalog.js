import awards from "./builtin/awards.js";
import exhibitors from "./builtin/exhibitors.js";
import hackathon from "./builtin/hackathon.js";
import researchConference from "./builtin/research_conference.js";
import volunteers from "./builtin/volunteers.js";

// The built-in templates, in gallery order.
export const BUILTIN_TEMPLATES = Object.freeze([researchConference, hackathon, exhibitors, volunteers, awards]);
export const builtinTemplate = (key) => BUILTIN_TEMPLATES.find((template) => template.key === key) ?? null;
