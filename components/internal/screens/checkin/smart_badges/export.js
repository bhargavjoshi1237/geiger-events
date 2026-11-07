// CSV hand-offs for badge vendors. The printer file pairs each chip with the name and QR to print on it;
// the order sheet carries serials and UIDs only, so it can go to a manufacturer with no attendee data.

import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { compareSerial } from "@/lib/smart_badges/uid";
import { holderOf } from "./constants";

const slug = (s) => String(s || "badges").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const sortBadges = (badges) =>
  [...badges].sort((a, b) => compareSerial(a.serial, b.serial) || compareSerial(a.uid, b.uid));

export function exportPrinterCsv(badges, { rosterByKey, batchesById, eventName }) {
  const rows = sortBadges(badges).map((b) => {
    const holder = holderOf(b, rosterByKey) || {};
    const person = holder.key ? rosterByKey.get(holder.key) : null;
    return { b, holder, payload: person?.payload || b.registrationId || b.orderId || "" };
  });
  downloadCsv(
    [
      { header: "serial", value: (r) => r.b.serial },
      { header: "uid", value: (r) => r.b.uid },
      { header: "status", value: (r) => r.b.status },
      { header: "name", value: (r) => r.holder.name || "" },
      { header: "company", value: (r) => r.holder.company || "" },
      { header: "title", value: (r) => r.holder.title || "" },
      { header: "email", value: (r) => r.holder.email || "" },
      { header: "role", value: (r) => r.holder.role || "" },
      { header: "ticket_type", value: (r) => r.holder.tier || "" },
      { header: "ticket_code", value: (r) => r.holder.code || "" },
      { header: "qr_payload", value: (r) => r.payload },
      { header: "batch", value: (r) => batchesById.get(r.b.batchId)?.name || "" },
    ],
    rows,
    `${slug(eventName)}-smart-badges.csv`,
  );
  return rows.length;
}

export function exportOrderSheetCsv(badges, { batchName }) {
  const rows = sortBadges(badges);
  downloadCsv(
    [
      { header: "serial", value: (b) => b.serial },
      { header: "uid", value: (b) => b.uid },
    ],
    rows,
    `${slug(batchName)}-serials.csv`,
  );
  return rows.length;
}
