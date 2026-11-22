import test from "node:test";
import assert from "node:assert/strict";

import {
  chargeLine,
  disputeView,
  mergeLedger,
  packageEnquiryView,
  parseDisputePatch,
  parseEnquiryStatus,
  parseRequestStatus,
  pickFilter,
  refundLine,
  refundRequestView,
  sponsorEnquiryView,
} from "./views.js";

const ORDER = "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c";

test("a refund request carries its order code and the event's currency", () => {
  const view = refundRequestView(
    { id: "r1", order_id: ORDER, event_id: "e", buyer_name: "Ada", buyer_email: "ada@x.io", reason: "Ill", amount: "49.5", status: "Requested", created_at: "t" },
    { name: "Finals", currency: "GBP" },
  );
  assert.equal(view.orderCode, "3F2B9C1E");
  assert.equal(view.currency, "gbp");
  assert.equal(view.amount, 49.5);
});

test("a request can be set back, approved or denied by hand, but never marked refunded", () => {
  assert.equal(parseRequestStatus({ status: "Denied" }), "Denied");
  assert.throws(() => parseRequestStatus({ status: "Refunded" }), (e) => e.status === 400);
  assert.throws(() => parseRequestStatus({}), (e) => e.status === 400);
});

test("the ledger merges charges and refunds newest first and pages by the oldest line shown", () => {
  const charges = [
    chargeLine({ id: "o1", total: 20, buyer_name: "A", created_at: "2026-11-08T10:00:00.5+00:00" }),
    chargeLine({ id: "o2", total: 30, created_at: "2026-11-08T08:00:00+00:00" }),
  ];
  const refunds = [refundLine({ id: "f1", order_id: "o1", amount: 5, created_at: "2026-11-08T09:00:00+00:00" }, { buyer_name: "A" })];
  const page = mergeLedger(charges, refunds, 2);
  assert.deepEqual(page.items.map((l) => l.id), ["c-o1", "r-f1"]);
  assert.equal(page.items[1].amount, -5);
  assert.equal(page.nextBefore, "2026-11-08T09:00:00+00:00");
  assert.equal(mergeLedger(charges, refunds, 10).nextBefore, null);
});

test("a dispute patch validates status and date, and keeps other metadata", () => {
  const patch = parseDisputePatch({ status: "Won", evidenceDue: "2026-12-01", note: "Sent receipts" }, { metadata: { stripe: "dp_1" } });
  assert.deepEqual(patch, { status: "Won", evidence_due_at: "2026-12-01T00:00:00Z", metadata: { stripe: "dp_1", note: "Sent receipts" } });
  assert.equal(parseDisputePatch({ evidenceDue: "" }, null).evidence_due_at, null);
  assert.throws(() => parseDisputePatch({ status: "Pending" }, null), (e) => e.status === 400);
  assert.throws(() => parseDisputePatch({ evidenceDue: "01/12/2026" }, null), (e) => e.status === 400);
  assert.throws(() => parseDisputePatch({}, null), (e) => e.status === 400);
  assert.equal(disputeView({ id: "d", metadata: { note: "x" }, amount: "12" }).note, "x");
});

test("enquiries read the same whichever page they came from", () => {
  const pkg = packageEnquiryView({ id: "p", first_name: "Ada", last_name: "L", package_name: "VIP", quantity: 4, status: "new" });
  assert.equal(pkg.title, "Ada L");
  assert.equal(pkg.subtitle, "VIP");
  const sp = sponsorEnquiryView({ id: "s", company: "Acme", contact_name: "Bo", spot_name: "Gold", answers: [{ id: "a", label: "Budget", value: 5000 }, { bad: 1 }] });
  assert.equal(sp.title, "Acme");
  assert.equal(sp.subtitle, "Gold · Bo");
  assert.deepEqual(sp.answers, [{ label: "Budget", value: "5000" }]);
});

test("a sponsor enquiry can't be converted from the app; a package one can", () => {
  assert.equal(parseEnquiryStatus("packages", { status: "converted" }), "converted");
  assert.throws(() => parseEnquiryStatus("sponsors", { status: "converted" }), (e) => e.status === 400);
  assert.throws(() => parseEnquiryStatus("other", { status: "new" }), (e) => e.status === 404);
  assert.equal(pickFilter("charge", ["all", "charge"]), "charge");
  assert.equal(pickFilter("x", ["all"]), null);
});
