// View models from /api/control/inventory/* (Inventory and Membership members in Control).

export type StockStatus = "In stock" | "Low stock" | "Out of stock";

export type InventoryItem = {
  id: string;
  parentId: string | null;
  sku: string;
  name: string;
  variantLabel: string;
  category: string;
  description: string;
  imageUrl: string;
  unitCost: number;
  unitPrice: number;
  currency: string;
  reorderPoint: number;
  onHand: number;
  active: boolean;
  createdAt: string | null;
  label: string;
  status: StockStatus;
};

export type InventoryItemGroup = InventoryItem & { variants: InventoryItem[] };

export type MovementKind = "receive" | "adjust" | "issue" | "return" | "waste" | "transfer";

export type InventoryMovement = {
  id: string;
  itemId: string | null;
  eventId: string | null;
  allocationId: string | null;
  kind: MovementKind;
  qty: number;
  reason: string;
  note: string;
  reference: string;
  createdAt: string | null;
  itemLabel?: string;
};

export type MovementKindOption = { value: MovementKind; label: string; direction: "in" | "out" | "either" };

export type AllocationStatus = "Planned" | "Reserved" | "Issued" | "Closed";

export type InventoryAllocation = {
  id: string;
  itemId: string | null;
  eventId: string | null;
  plannedQty: number;
  issuedQty: number;
  outstanding: number;
  status: AllocationStatus;
  issuance: string;
  ticketIds: string[];
  qtyPerAttendee: number;
  notes: string;
  createdAt: string | null;
  itemLabel?: string;
  eventName?: string;
  onHand?: number;
};

export type AllocationEvent = { id: string; name: string; date: string | null; tickets: { id: string; name: string }[] };

export type DeskRole = {
  id: string;
  name: string;
  accessCode: string;
  active: boolean;
  canIssue: boolean;
  canReturn: boolean;
  canOverride: boolean;
  allocationCount: number;
  createdAt: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  leadTimeDays: number;
  notes: string;
  createdAt: string | null;
};

export type PurchaseOrderStatus = "Draft" | "Ordered" | "Partial" | "Received" | "Cancelled";

export type PurchaseOrder = {
  id: string;
  ref: string;
  supplierId: string | null;
  supplierName?: string;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  currency: string;
  total: number;
  lines: { itemId: string; name: string; qty: number; unitCost: number; receivedQty: number }[];
  outstanding: number;
  notes: string;
  createdAt: string | null;
};

export type MemberStatus = "Active" | "Expired" | "Cancelled";

export type Member = {
  id: string;
  name: string;
  email: string;
  membershipId: string | null;
  planName: string;
  status: MemberStatus;
  startedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

export type MembershipPlan = { id: string; name: string; active: boolean };
