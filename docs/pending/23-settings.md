# 23 — Settings

| | |
|---|---|
| **Nav items** | 8 — Team & Members, Roles & Permissions, Navigation, Notifications, API & Webhooks, Usage, Custom Domains, Add-ons |
| **Registered** | 6/8 — **API & Webhooks** and **Usage** are `ComingSoon` |
| **Tier** | **A** for team/roles/domains/nav/addons · **B** for Notifications · **C** for the two missing |
| **Blocked by** | [00 H6 webhooks](00-cross-cutting.md), [00 H7 audit log](00-cross-cutting.md), [00 H2 send stack](00-cross-cutting.md) |
| **Key files** | `settings/team_members.jsx` (1507), `roles_permissions.jsx` (1226), `custom_domains.jsx` (852), `notifications.jsx`, `navigation_settings.jsx`, `addons_settings.jsx`, `@geiger/rbac`, `lib/email/catalog.js`, `addons/` |

---

## 1. What this means in industry

Workspace administration for a multi-user product:

- **Team** — invite, roles, groups, SSO/SAML, session management, deactivation.
- **Permissions** — a real authorization model **enforced server-side**, not just
  hidden UI; scoped per event/venue where needed.
- **Audit log** — who did what, when, with before/after. Required for any
  organization above a handful of people, and for the data-rights promises in
  [07 Data Requests](07-guests.md).
- **API & webhooks** — API keys with scopes, event subscriptions with retry and
  a delivery log; the integration surface every B2B buyer asks about.
- **Usage & billing** — plan limits, consumption, overage, invoices.
- **Domains** — custom domain with automated DNS verification and TLS.
- **Notifications** — which transactional messages the workspace sends, per channel.

## 2. What exists today (verified)

Strong — this is one of the better-built areas:
- **Team & Members** (1507 lines) — people, groups, invites, activity
- **Roles & Permissions** (1226 lines) — a role matrix over `WORKSPACE_PERMISSIONS`, now on
  the shared **`@geiger/rbac`** package (format + permit/deny + an RLS compiler)
- **Custom Domains** (852) — real CNAME-based domain connection with verification
- **Navigation** — per-user sidebar curation, a `@geiger/ui` capability with a dependency resolver
- **Add-ons** — per-project enablement and placement over the static addon catalog

Gaps:
- **Enforcement is still UI-only.** RBAC hides and disables controls; `FALLBACK_ALLOW=true`
  means the default is permissive. A determined user with the API surface can act outside
  their role. `MODULE_CONVENTIONS.md` states this plainly ("advisory UI-gating only — it
  does not secure data"), which is honest, but it is the largest security-shaped gap in the app
- **No audit log** ([00 H7](00-cross-cutting.md)) — nothing records who changed a price,
  refunded an order, or altered a role
- **API & Webhooks** is `ComingSoon` — no keys, no subscriptions, no delivery log
- **Usage** is `ComingSoon` — no limits, metering, or plan awareness
- **Notifications** is a toggle grid over a 61-entry catalog where **3 entries can actually
  send**. The screen labels unwired types "Planned", which is the right call — but it means
  most toggles currently control nothing

## 3. Pending deliverables

### P0 — Make permissions real
- [ ] Compile the `@geiger/rbac` policies into **RLS** (the package already has an RLS compiler) so the database enforces what the UI implies
- [ ] Flip `FALLBACK_ALLOW` to deny-by-default once coverage is complete, behind a migration window
- [ ] Enforce on every API route (`app/api/*`), not just screens — several routes today check a session but not a permission

### P0 — Audit log
- [ ] `events.audit_log` written from the data layer's shared `update*` / `softDelete*` helpers, so coverage is structural rather than per-screen
- [ ] Surface it as a filterable feed here **and** as an Activity tab on entity drawers ([09 Orders](09-orders.md) already has an order event log — generalise that, don't duplicate it)

### P1
- [ ] **API & Webhooks**: scoped API keys, `webhook_endpoints` + `webhook_deliveries` with signing, retry and replay ([00 H6](00-cross-cutting.md)). Emit from fulfilment, refund, check-in — the same points [16 Workflows](16-workflows.md) needs, so build the emitter once
- [ ] **Usage**: metering (events, attendees, emails, storage) against plan limits, with a clear overage story
- [ ] Wire the remaining notification types as their send sites land ([00 H2](00-cross-cutting.md))

### P2
- [ ] SSO/SAML and SCIM provisioning
- [ ] Session management (active sessions, revoke)
- [ ] Per-event/per-venue scoped roles

## 4. UX & component placement

### Team & Members
| Issue | Change |
|---|---|
| **Four `FilterDropdown`s plus search** in the toolbar (`team_members.jsx:918-942`) on what is usually a list of 5–50 people | Collapse to one `Filters` popover ([00 U5](00-cross-cutting.md)); for small teams, filters should be secondary to a plain, scannable list |
| Pending invites are mixed into the member list | Split them: a **pending-invites strip above the table** with resend/revoke. Invites are a queue with actions, members are a directory |
| No bulk role change | Add selection + bulk role assignment — the main reason anyone opens this screen after setup |

### Roles & Permissions
| Issue | Change |
|---|---|
| A large permission matrix is hard to reason about | Keep the matrix, but add a **"compare roles" mode** (two roles side by side, differences highlighted) and a per-role summary sentence at the top |
| No way to answer "what can this person do" | Add **"Test as user"** — pick a member, see the resolved permission set. Role systems are debugged by example, not by reading a grid |
| The advisory-only nature is invisible | Until P0 lands, show a persistent notice: *"Permissions currently control the interface only; they are not enforced by the database."* Silence here is a security-shaped promise the product doesn't keep |

### Notifications
| Issue | Change |
|---|---|
| 61 toggles in one long list | Keep the existing grouping, but **collapse groups by default** and lead each with a count (`Registrations & RSVPs — 2 of 9 active`) |
| "Planned" types look identical to live ones at a glance | Make the distinction structural: put planned types in a **separate collapsed "Not yet sending" section** per group, rather than a badge in a list of otherwise-working toggles |
| No preview | Add a preview of each email as it will arrive — the toggle is meaningless without knowing what it sends |

### Custom Domains
- Already good. Add a **verification progress checklist** (DNS added → propagated → TLS issued → live) rather than a single status, since DNS is slow and users need to know which step they're waiting on

### Add-ons
- Cards are right for this. Add **"what this adds"** explicitly per add-on (nav entries, screens, permissions) so enabling isn't a surprise, and show placement as a live sidebar preview

### API & Webhooks (when built)
- Two tabs: **Keys** (create, scope, last used, revoke — show the secret exactly once) and **Endpoints** (URL, subscribed events, health)
- The **delivery log is the main surface**: recent deliveries with status, response code, latency, and a Replay action. Webhook debugging is 90% of webhook support

### Usage (when built)
- Lead with the current period's consumption against limits as progress bars; put the invoice history below. Don't bury the one number people came for

## 5. Schema / API work
- [ ] `events.audit_log` (actor_id, action, entity_type, entity_id, before jsonb, after jsonb, project_id, created_at) + index on `(project_id, created_at)`
- [ ] `events.api_keys` (hashed, scopes, last_used_at), `events.webhook_endpoints`, `events.webhook_deliveries`
- [ ] `events.usage_counters` (project_id, period, metric, value)
- [ ] RLS policies generated from `@geiger/rbac` — and per the `rls-no-self-reference` rule, any policy needing a lookup on its own table must go through a `SECURITY DEFINER` helper
