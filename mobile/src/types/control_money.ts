// View models for Control's money screens, as ../app/api/control/money/** returns them.

export type RefundRequestStatus = "Requested" | "Approved" | "Denied" | "Refunded";

export type RefundRequest = {
  id: string;
  orderId: string | null;
  orderCode: string;
  eventId: string | null;
  eventName: string;
  currency: string;
  name: string;
  email: string;
  reason: string;
  amount: number;
  status: RefundRequestStatus;
  createdAt: string | null;
};

export type RefundRequestList = { requests: RefundRequest[]; can: { decide: boolean } };

export type LedgerLine = {
  id: string;
  type: "charge" | "refund";
  orderId: string | null;
  orderCode: string;
  name: string;
  email: string;
  ticket: string;
  eventName: string;
  currency: string;
  amount: number;
  method: string;
  at: string | null;
};

export type LedgerPage = { lines: LedgerLine[]; nextBefore: string | null };

export type DisputeStatus = "Needs response" | "Under review" | "Won" | "Lost";

export type Dispute = {
  id: string;
  orderId: string | null;
  orderCode: string;
  eventId: string | null;
  eventName: string;
  currency: string;
  name: string;
  email: string;
  amount: number;
  status: DisputeStatus;
  reason: string;
  note: string;
  evidenceDueAt: string | null;
  createdAt: string | null;
};

export type DisputeList = { disputes: Dispute[]; can: { decide: boolean } };

export type EnquiryKind = "packages" | "sponsors";
export type EnquiryStatus = "new" | "contacted" | "converted" | "declined";

export type Enquiry = {
  id: string;
  kind: EnquiryKind;
  eventId: string | null;
  eventName: string;
  title: string;
  subtitle: string;
  email: string;
  phone: string;
  quantity: number | null;
  message: string;
  answers: { label: string; value: string }[];
  status: EnquiryStatus;
  createdAt: string | null;
};
