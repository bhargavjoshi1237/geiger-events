export const PORTAL_LIMITS = Object.freeze({
  roles: 30, pages: 60, blocks: 40, rows: 40, columns: 3, buttons: 4, stats: 4, cardFields: 6, tableColumns: 30,
  exposedFilters: 4, pageSize: 50, formFields: 80, formSections: 12, text: 20_000, measures: 4,
});

// Roles every portal has: anyone at all, and anyone matched to a record in the people list.
export const BUILTIN_ROLES = Object.freeze({ public: "public", signedIn: "signed_in" });
export const ACCESS_MODES = Object.freeze(["none", "where", "all"]);
export const FIELD_LEVELS = Object.freeze(["hidden", "read", "edit"]);
export const LEVEL_RANK = Object.freeze({ hidden: 0, read: 1, edit: 2 });

// Values a rule can use that are filled in per viewer: their people-list record, account, email, today's date and,
// on a record page, the record being shown.
export const TOKENS = Object.freeze({ me: "@me", myEmail: "@my_email", today: "@today", record: "@record" });
export const NIL_UUID = "00000000-0000-4000-8000-000000000000";

export const BLOCK_ID = /^b_[a-z0-9]{4,24}$/;
export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const LAYOUTS = Object.freeze(["blocks", "canvas"]);
export const COLUMN_WIDTHS = Object.freeze([[12], [6, 6], [4, 8], [8, 4], [4, 4, 4], [3, 9], [9, 3]]);
export const GRID = Object.freeze({ columns: 12, rowHeight: 24, maxRows: 400 });

// Plain-language versions of the portal database refusals (SQLSTATE 22023).
export const PORTAL_DB_MESSAGES = Object.freeze({
  "Portal needs people": "Choose the people list and its email field before turning the portal on.",
  "Portal email must be unique": "Make the email field unique first, so one email can only ever be one person.",
  "Role key taken": "Another role already uses that name.",
  "Role limit reached": "A portal can have up to 30 roles.",
  "Role changed": "Someone else changed this role. Reload and try again.",
  "Built-in role": "Built-in roles can't be deleted.",
  "Unknown role": "That role no longer exists.",
  "Page address taken": "Another page already uses that address.",
  "Record page exists": "That list already has a record page.",
  "Page limit reached": "A portal can have up to 60 pages.",
  "Unknown page": "That page no longer exists.",
  "Unknown version": "That version no longer exists.",
});
