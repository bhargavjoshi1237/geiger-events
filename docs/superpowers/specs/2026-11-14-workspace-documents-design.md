# Workspace — Documents (sub-project 6 of 8)

Date: 14 November 2026 · Status: decided by Claude under the user's standing instruction; open to review
Needs: [Process & automation](2026-11-14-workspace-process-design.md)

## Goal

Organisers write reusable **email templates** and design **PDF documents** (acceptance letters, invoices, badges, certificates) from a record's fields, generate them by hand or from automations, and issue **certificates** anyone can verify on a public page.

## Decisions

| Topic | Decision |
|---|---|
| PDF engine | `pdf-lib` + `@pdf-lib/fontkit`, server-side, with a small layout engine (wrapping, alignment, columns). Fonts: Noto Sans and Noto Serif (regular, bold; OFL) bundled under `lib/workspace/documents/fonts`, subset on embed — Latin, Greek, Cyrillic and Vietnamese names render correctly. No headless browser. |
| Template model | A document is a page (A4 / Letter, portrait / landscape, margins, optional background image) holding an ordered list of blocks: heading, text (placeholders), field value, image, QR (verification link or any placeholder), signature (image + name + role), spacer, divider, table of linked records, two-column row. The same `{{placeholder}}` renderer as automations. |
| Preview | The editor asks the server to render the real PDF for a sample record and shows it in an iframe — the preview is the output. |
| Storage | Generated PDFs are uploaded to the private `workspace` bucket and attached to a chosen attachments field on the record (a normal value change, logged). |
| Emails | `kind = 'email'` templates (subject + rich text). The `send_email` step can use a template or inline text. |
| Certificates | A PDF template marked "certificate". Issuing creates a row with a unique code (`ABCD-EFGH-JKLM`, 60 bits), a snapshot of chosen fields, and the PDF. `/e/<eventId>/verify/<code>` shows valid / revoked with the snapshot — no sign-in, `noindex`. Revoking keeps the row and shows "revoked" with the reason. |

## Data model (migration `20261117100000_workspace_documents.sql`)

- `workspace_documents (id, project_id, event_id, kind ('email'|'pdf'), name, object_id, config, revision, created_by, created_at, updated_at, deleted_at)`.
- `workspace_certificates (id, project_id, event_id, document_id, record_id, code unique, holder, data, file_id, issued_by_kind, issued_by, issued_at, revoked_at, revoked_reason)`.
- `events.workspace_certificate_public(p_code)` — security definer, returns only the public fields for the verification page (granted to `anon` through a route that uses the service role anyway; the function keeps the column list in one place).

## Server

```
lib/workspace/documents/
  model.js       block catalog + validation (pure, tested)
  layout.js      text wrapping and block layout → draw ops (pure, tested)
  render.js      draw ops → PDF bytes (pdf-lib), image fetch with size/type limits, QR via `qrcode`
  service.js     CRUD, preview, generate (attach to record), certificates (issue, revoke, verify)
app/api/events/[eventId]/workspace/documents/route.js          list / save / delete
app/api/events/[eventId]/workspace/documents/render/route.js   preview PDF for a record
app/api/events/[eventId]/workspace/documents/generate/route.js generate for records (attach / issue)
app/e/[id]/verify/[code]/page.js                                public verification page
```

Steps added to automations: `generate_document` (render, attach to field; issue certificate when the template is one) — and `send_email` gains "use template".

## UI

- Workspace sidebar: **Documents**. Toolbar tabs *Templates · Certificates* (+ search on the right).
- Template editor (full screen within the section): left — block list with inline settings and an Add block menu; right — live PDF preview with a sample-record picker. Email templates: subject + rich text editor + placeholder picker, preview rendered in the email layout.
- Record sheet: **Documents** menu → "Generate *template*" (choose field) and the record's issued certificates.
- Certificates tab: issued list (code, holder, template, date, status), open, copy verify link, revoke with reason.

## Errors

- Images must be https, ≤ 5 MB, PNG or JPEG; failures render a grey placeholder and report a warning in the preview.
- Missing values render empty, never `{{…}}`.

## Testing

Unit: block validation, layout wrapping/pagination, certificate code format, placeholder use. A smoke script renders every block type to a PDF. Lint; build.

## Decisions made while building (15 Nov 2026)

- `events.workspace_certificate_public(p_event, p_code)` takes the event too, so a code only checks on its own event's page; it's granted to the service role only (the page reads it server-side).
- Certificates store `title` (the document name when issued) alongside `holder` and the snapshot; trashed documents a certificate points at are never purged, and `workspace_purge` keeps any file a certificate references.
- Generation always needs a file field: the PDF is a `workspace_files` row plus a logged record update. The file is named `<document> - <record>.pdf`; **Replace** swaps the file with that name (a one-file field is simply overwritten) and, for certificates, revokes the earlier certificate with "Reissued as <code>". A field that's still full stops the run before anything is rendered, with a message that says so.
- Automations reuse the same file and certificate on a retry (ids derived from the run and step).
- `send_email` → "Include a document link" renders the PDF without issuing a certificate, stores it under `<project>/<event>/emailed/<run>-<step>/` and links it with a 14-day signed URL. Those files aren't tracked by `workspace_files`, so purge doesn't remove them.
- Documents-only placeholders `{{certificate.code}}` and `{{certificate.url}}`; previews fill `XXXX-XXXX-XXXX` and fields show `[Field name]` when no sample record is chosen.
- Image and background fetches go through `lib/workspace/net/safe_fetch.js` (public https only, private-network answers refused, 5 MB, 8 s, up to 3 re-checked redirects).
- `next.config.mjs` adds the font files to the traces of every workspace API route (documents, staff and portal commands, hooks, internal cron), since any of them can run an automation that makes a PDF.

## Out of scope

Arbitrary HTML/CSS layouts, DOCX output, e-signatures, batch ZIP downloads (generation attaches each PDF to its record instead).
