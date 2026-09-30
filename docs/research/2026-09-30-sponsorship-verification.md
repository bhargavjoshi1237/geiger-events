# Sponsorship release verification

The current change includes sponsorship editor/prospectus/display, shared form
fields, login and project routing, and a Singapore event seed. Review found
private deal fields in public metadata, an empty marquee crash, malformed
answer crashes, and a deleted sponsor locking the fill dialog. These were
corrected before committing the existing work.

The private configuration is `events.event_sponsorship`. Anonymous users have
no table privileges. Authenticated reads require the owning event's project
access. Writes use an authenticated, project-checked RPC that locks the event,
saves full configuration, and refreshes public metadata atomically. A trigger
whitelists the public projection for every metadata write. Client load failures
block saving incomplete configuration and offer a retry.

The forward migration also restricts `event_merge_meta` to authenticated callers
with the owning project's access, closing its older anonymous mutation path.
Public enquiries must reference the same project as a shareable event with an
enabled prospectus/form. Member triage also checks that parent relationship.

Apply `20260929120000_sponsor_enquiries.sql`, then
`20260930150932_private_sponsorship_fills.sql` before releasing the editor.
Use the project's usual migration workflow. No production migration or seed
was executed during this verification.

Checks:

- `node --test`: 150 passed, including new malformed-answer, empty-marquee and
  reserved-slot regressions.
- ESLint on changed JavaScript: zero errors; 11 existing image warnings in
  `page_blocks.jsx`.
- `npm run build`: passed after the corrections with Next.js 16.3.1.
- `scripts/verify-sponsorship-db.mjs`: isolated PostgreSQL checks for backfill,
  anonymous privacy, member save, snapshot refresh, guarded metadata writes,
  generic RPC authorization, enquiry parent scope, cross-project denial,
  invalid input, and cascading cleanup.

The DB check uses [PGlite](https://pglite.dev/docs/) installed outside the
application. It is not an application dependency and never uses Supabase
credentials. To reproduce in PowerShell:

```powershell
$verificationRuntime = Join-Path $env:TEMP 'geiger-events-sponsorship-db-check'
npm install --prefix $verificationRuntime --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.1
$env:PGLITE_MODULE = Join-Path $verificationRuntime 'node_modules/@electric-sql/pglite/dist/index.js'
node scripts/verify-sponsorship-db.mjs
```

The fixture supplies the repository's roles, event visibility policy and a
project-access predicate. It verifies this migration's SQL and permissions,
not deployed Supabase state, the suite's entire RBAC system, email delivery or
browser behaviour against a live database.
