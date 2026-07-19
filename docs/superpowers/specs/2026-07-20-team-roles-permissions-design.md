# Team & Members + Roles & Permissions — Design

Two Settings screens for the Geiger Events workspace, built to the `crafting.md`
/ `MODULE_CONVENTIONS.md` / `SUPABASE_CONVENTIONS.md` bar. They are **separate but
intertwined**: one manages *people*, the other manages *capabilities*.

## Concept

| | **Team & Members** | **Roles & Permissions** |
|---|---|---|
| Purpose | the *who* — people, their role, groups, status | the *what* — roles and the permissions each grants |
| Primary action | Invite people | Create role |
| Reads | real org members (overlay rows synced from `public.organization_users` ⋈ `public.users`) | `WORKSPACE_PERMISSIONS` catalog + the project's roles |
| Writes | role/status/group assignment, invites, activity | role definitions + permission toggles |

**Two-way link (the intertwining):**
- The role pill on a member row is a picker populated *from* the roles defined in
  Roles & Permissions.
- Each role shows a "N members" chip that deep-links into Team, pre-filtered to
  that role.
- Toggling a role's permission changes what every assigned member sees (the
  sidebar already gates on `roleHasPermission`).

Neither screen duplicates the other: Team shows a **read-only** "what this role
grants" summary in the member drawer; Roles only counts members and links out.

## Data model — `events` schema, project-scoped

Members are **read** from the real org tables; everything app-specific is an
overlay keyed by `(project_id, user_id)`. All standard conventions: `metadata`
bag, `updated_at` trigger, soft delete, RLS via `events.can_access_project`.

- **`events.roles`** — `id, project_id, name, description, color, permissions text[],
  is_system bool, sort, metadata, created_by, timestamps, deleted_at`. Five system
  roles (Owner/Admin/Manager/Member/Viewer) seeded per project, `is_system=true`,
  permission toggles locked in the UI.
- **`events.project_members`** — assignment overlay: `id, project_id, user_id (soft
  ref, nullable for invited), role_id→events.roles, status (active|invited|suspended),
  email, name, avatar_url, group_ids uuid[], invited_by, invited_at, joined_at,
  last_active_at, metadata, timestamps, deleted_at`. Partial-unique on
  `(project_id, user_id)` and `(project_id, lower(email))`.
- **`events.member_groups`** — sub-teams: `id, project_id, name, description, color,
  metadata, created_by, timestamps, deleted_at`. Membership via `group_ids uuid[]`
  on `project_members` (GIN-indexed) — no join table.
- **`events.member_activity`** — append-only audit: `id, project_id, actor_user_id,
  actor_name, target_member_id, target_name, action, detail jsonb, created_at`.

**Org sync (defensive):** `events.sync_project_team(p_project_id, p_default_role)`
— SECURITY DEFINER plpgsql, wrapped in `exception when others then null` so a
shared-schema column mismatch degrades to a no-op instead of failing. It resolves
the project's org and inserts a `project_members` row (default role) for each org
member lacking one. The screen's real source is `events.project_members`; sync is
best-effort enrichment, so the module works even if the org read is unavailable.

**Seat limit** read from project metadata (default 25); ties to Usage/Billing later.

**SQL layout:** `supabase/sqls/team.sql` creates schema + tables + indexes +
triggers + demo-open RLS (self-contained, like `conference.sql`); the member-scoped
RLS swap (drop demo, add `can_access_project` policy) is appended to
`zz_project_access.sql` alongside the other entities.

## Data layer

- `lib/supabase/roles.js` — `normalizeRole`/`toRow`, `listRoles(projectId)`,
  `getRole`, `createRole`, `updateRole`, `softDeleteRole`, `ensureSystemRoles(projectId, createdBy)`.
- `lib/supabase/team.js` — members + groups + activity: `listMembers`, `updateMember`,
  `inviteMember`, `softDeleteMember`, `syncTeam(projectId, defaultRoleId)` (RPC),
  `listGroups`/`createGroup`/`updateGroup`/`softDeleteGroup`, `listActivity`/`logActivity`.
  Pure (null/[]/false, console.error, no toast).

## Screen — Team & Members (`settings/team_members.jsx`)

`MainScreenWrapper` → `ScreenHeader` ("Invite people") → `StatsBar`
[Active members · Pending invites · Seats used X/limit · Groups] → tabs
(per-area features stay tabs, no new registry entries):

- **Members** — Toolbar (search name/email · filter role · status · group) →
  `DataTable`: Member (avatar+name+email) · Role (inline pill picker) · Groups
  (chips) · Status (`StatusPill`) · Last active · Joined · row actions. Row → drawer.
- **Invitations** — pending invites (email, role, invited by, sent) · resend/revoke.
- **Groups** — cards (name, color, member count) · create-group dialog.
- **Activity** — timeline of `member_activity`.
- **Member drawer** (`Sheet`) — identity, role picker, group chips, status,
  read-only permission summary derived from the role, danger zone.
- **Invite dialog** — multi-email + role + optional group + message → optimistic
  `invited` row + activity entry.
- Seats full → Invite disabled. Three list states throughout.

## Screen — Roles & Permissions (`settings/roles_permissions.jsx`)

Two-pane master–detail in `MainScreenWrapper`, selection in `?record=<roleId>`:

- `ScreenHeader` ("Create role") → `StatsBar` [Total roles · Custom roles · Members
  assigned · Permissions available].
- **Left rail** — role list: color dot, name, system/custom badge, member count.
- **Right pane** — role header (editable name/description for custom, member chip →
  Team, duplicate/delete), then a **permission matrix** grouped by the existing
  `WORKSPACE_PERMISSIONS` groups (Workspace views / Team control / Administration),
  a `Switch` per permission + select-all-in-group. System roles render read-only
  ("Duplicate to edit"). Toggles persist optimistically.
- **Create-role dialog** — name, description, color, "start from" (clone perms).

**Default permission sets:** Owner = all (locked); Admin = all except owner-only;
Manager = all `view.*` + `team.invite`/`assign_roles`; Member = operational
`view.*`; Viewer = `view.overview` + read views. Full matrix in `constants.js`.

## RBAC integration

`rbac.js` keeps `WORKSPACE_PERMISSIONS` + the pure helpers. Roles & Permissions
manages `events.roles` as the source of truth. Wiring the *current user's* effective
role into the sidebar is deferred (no in-app auth to resolve it reliably); today's
permissive default (`roleHasPermission` returns true with no roles) stays. This is
called out so the follow-up is explicit, not a silent gap.

## Files

`supabase/sqls/team.sql` · append to `supabase/sqls/zz_project_access.sql` ·
`lib/supabase/roles.js` · `lib/supabase/team.js` ·
`components/internal/screens/settings/{constants.js, team_members.jsx, roles_permissions.jsx}` ·
`registry.jsx` (two keys). Built from the shared kit + shadcn, semantic tokens only.
