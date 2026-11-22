// Shared values for Control's check-in operations; they match lib/supabase/checkin_capacity.js and the smart-badge RPCs.

export const REENTRY_RULES_LIST = ["inherit", "once", "multi"];

// smart_badge_set_status accepts these; "active" only reactivates a lost or revoked badge.
export const BADGE_TARGETS = ["active", "lost", "revoked"];
export const BADGE_STATUSES = ["active", "unassigned", "lost", "revoked", "replaced"];
