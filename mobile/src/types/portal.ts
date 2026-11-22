
export type Member = {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
};

export type PortalDevice = {
  id: string;
  platform: string;
  appVersion: string | null;
  lastSeenAt: string | null;
  current: boolean;
};

export type PushCategoryKey =
  | "tickets"
  | "reminders"
  | "updates"
  | "messages"
  | "community"
  | "meetings";

// GET / PUT /api/portal/push/preferences.
export type PushPreferencesResponse = {
  categories: Record<PushCategoryKey, boolean>;
};

export type RefundInfo = {
  id: string;
  status: string;
  reason: string;
  amount: number;
  createdAt: string | null;
};

export type Order = {
  id: string;
  orderCode: string;
  eventId: string | null;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  address: string;
  city: string;
  timezone: string;
  organizer: string;
  coverUrl: string;
  buyerName: string;
  buyerEmail: string;
  ticket: string;
  quantity: number;
  unitPrice: number;
  total: number;
  offerings: Record<string, unknown>[];
  purchasables: Record<string, unknown>[];
  slot: Record<string, unknown> | null;
  discount: Record<string, unknown> | null;
  donation: Record<string, unknown> | null;
  bundle: Record<string, unknown> | null;
  group: Record<string, unknown> | null;
  earlybird: Record<string, unknown> | null;
  paid: boolean;
  status: string;
  createdAt: string | null;
  refund: RefundInfo | null;
};

export type Ticket = Order & {
  entitlements: Entitlement[];
};

export type Entitlement = {
  allocationId: string;
  itemId: string;
  name: string;
  imageUrl: string;
  issuance: string;
  periodMode: string;
  periodLabel: string;
  entitled: number;
  collected: number;
  remaining: number;
  lastAt: string | null;
  blockedReason: string;
};

export type Membership = {
  id: string;
  planName: string;
  description: string;
  benefits: string[];
  included: IncludedSummary[];
  price: number;
  billingPeriod: string;
  discountPercent: number;
  posterUrl: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
};

export type IncludedSummary = {
  key: string;
  label: string;
  summary: string;
  duration: string;
  extras: string[];
};

export type Plan = {
  id: string;
  projectId: string | null;
  name: string;
  price: number;
  billingPeriod: string;
  discountPercent: number;
  benefits: string[];
  included: IncludedSummary[];
  description: string;
  posterUrl: string;
  held: boolean;
};

export type WatchItem = {
  id: string;
  kind: "recording" | "simulive" | string;
  name: string;
  videoUrl: string;
  thumbnailUrl: string;
  session: string;
  speaker: string;
  duration: string;
  recordedAt: string;
  premiereAt: string;
  description: string;
  tags: string[];
  eventName: string;
  planName: string;
  expiresAt: string | null;
};

export type LiveRoom = {
  id: string;
  kind: "room" | "webinar" | "breakout" | string;
  name: string;
  state: string;
  openNow: boolean;
  startsAt: string | null;
  endsAt: string | null;
  secondsUntilStart: number | null;
  joinUrl: string;
  watchUrl: string;
  description: string;
  parentSessionId: string;
  eventName: string;
  planName: string;
  expiresAt: string | null;
  liveNow: number;
};

export type RoundState = {
  id: string;
  config: {
    timerEndsAt: string;
    broadcasts: Record<string, unknown>[];
  };
};

export type Thread = {
  id: string;
  subject: string;
  status: string;
  eventId: string | null;
  orderId: string | null;
  unread: boolean;
  lastMessageAt: string | null;
  createdAt: string | null;
  preview: string;
};

export type ThreadMessage = {
  id: string;
  sender: string;
  body: string;
  createdAt: string | null;
};

export type ThreadDetail = Thread & {
  messages: ThreadMessage[];
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  channel: string;
  createdAt: string | null;
  unread: boolean;
  // A push type key (order_confirmed, …) or announcement | meeting | board.
  kind: string;
  // An expo-router path, or null when the item opens nothing.
  route: string | null;
};

export type Channel = {
  id: string;
  eventId: string | null;
  kind: string;
  name: string;
  topic: string;
  postingMode: string;
  status: string;
  unread: number;
  lastMessageAt: string | null;
  lastPreview: string;
  participantCount: number;
  messageCount: number;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  authorKey: string;
  authorName: string;
  senderKind: string;
  text: string;
  reactions: Record<string, unknown>;
  replyTo: string | null;
  type: string;
  poll: Record<string, unknown> | null;
  deleted: boolean;
  createdAt: string | null;
};

export type ChannelDetail = Channel & {
  muted: boolean;
  canPost: boolean;
  messages: ChatMessage[];
};

export type PollData = {
  question: string;
  options: { id: string; label: string }[];
  votes: Record<string, string[]>;
  multi: boolean;
  closed: boolean;
};

export type PortalData = {
  orders: Order[];
  memberships: Membership[];
  entitlements: Record<string, Entitlement[]>;
  tickets: Ticket[];
};

export type AppSection =
  | "memberships"
  | "live"
  | "watch"
  | "orders"
  | "community"
  | "qa"
  | "messages"
  | "notifications"
  | "agenda"
  | "speakers"
  | "sponsors"
  | "map"
  | "networking"
  | "discussions";

export type AppConfig = {
  sections: Record<AppSection, boolean>;
  home: {
    welcome: string;
    liveStrip: boolean;
    recentOrders: boolean;
    shortcuts: AppSection[];
  };
};

export type RolesHint = {
  team: {
    available: boolean;
    invited: boolean;
    organizations: { id: string | null; name: string; projectCount: number }[];
  };
  crew: { eventId: string; eventName: string; eventDate: string | null; roles: string[] }[];
};

export type ControlCapability =
  | "events"
  | "checkIn"
  | "guests"
  | "orders"
  | "analytics"
  | "workspace"
  | "inbox"
  | "edit"
  | "publish"
  | "delete"
  | "refund";

export type ControlProject = {
  id: string;
  name: string;
  organizationName: string | null;
  role: { key: string; name: string } | null;
  // create: project-wide "Edit an event" — an editor scoped to some events can edit them but not add new ones.
  can: Record<ControlCapability, boolean> & { create: boolean };
};

export type ControlProfile = { projects: ControlProject[] };

export type ControlEvent = {
  id: string;
  name: string;
  status: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  city: string | null;
  timezone: string;
  capacity: number;
  sold: number;
  coverUrl: string | null;
  when: "today" | "upcoming" | "unscheduled" | "past";
};

export type ControlEventStatus = "Draft" | "Scheduled" | "On Sale" | "Sold out" | "Ended";
export type ControlEventType = "In-person" | "Online" | "Hybrid";
export type ControlVisibility = "Public" | "Unlisted" | "Private";

export type ControlEventDetail = {
  event: ControlEvent;
  details: {
    type: ControlEventType;
    address: string;
    revenue: number;
    visibility: ControlVisibility;
    organizer: string;
    summary: string;
    isListable: boolean;
    currency: string;
  };
  projectId: string;
  can: Record<ControlCapability, boolean>;
  counts: { guests: number; pending: number; checkedIn: number };
};

// The editable subset PATCH /api/control/events/[id] accepts; every key is optional there.
export type ControlEventPatch = Partial<{
  name: string;
  type: ControlEventType;
  date: string | null;
  time: string | null;
  timezone: string;
  venue: string;
  address: string;
  city: string;
  capacity: number;
  visibility: ControlVisibility;
  organizer: string;
  summary: string;
  isListable: boolean;
  status: ControlEventStatus;
}>;

export type ControlTotals = { orders: number; sold: number; revenue: number };

export type ControlSummary = {
  today: ControlEvent[];
  upcoming: ControlEvent[];
  drafts: number;
  sales: { today: ControlTotals; week: ControlTotals } | null;
  pendingApprovals: number;
  unreadThreads: number | null;
};

export type ControlTicket = {
  id: string;
  name: string;
  price: number;
  qty: number;
  description: string;
  hasType: boolean;
  releases: number;
};

export type ControlGuestStatus = "Confirmed" | "Pending" | "Waitlisted" | "Declined" | "Checked-in" | "Cancelled";

export type ControlGuest = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  status: ControlGuestStatus;
  source: string;
  partySize: number;
  dietary: string;
  accessibility: string;
  checkedIn: boolean;
  createdAt: string | null;
};

export type ControlAdmitResult = {
  status: "admitted" | "already" | "blocked" | "capacity";
  name: string;
  party: number;
  message: string;
  code: string;
  canOverride?: boolean;
};

export type ControlCheckinStats = {
  admitted: number;
  expected: number;
  recent: { id: string; name: string; code: string; method: string; gate: string; by: string; at: string }[];
};

export type ControlOrderStatus = "Paid" | "Partially refunded" | "Refunded" | "Cancelled";

export type ControlOrder = {
  id: string;
  code: string;
  eventId: string | null;
  eventName: string;
  currency: string;
  name: string;
  email: string;
  ticket: string;
  unitPrice: number;
  quantity: number;
  total: number;
  refunded: number;
  refundable: number;
  status: ControlOrderStatus;
  cancelled: boolean;
  note: string;
  createdAt: string | null;
};

export type ControlOrderPage = { orders: ControlOrder[]; nextBefore: string | null };

export type ControlOrderDetail = {
  order: ControlOrder;
  refunds: { id: string; amount: number; reason: string; reasonCode: string; status: string; createdAt: string | null }[];
  timeline: { id: string; type: string; summary: string; amount: number | null; actor: string; createdAt: string | null }[];
  can: { refund: boolean; checkIn: boolean };
};

export type ControlThread = {
  id: string;
  subject: string;
  status: "open" | "closed";
  name: string;
  email: string;
  eventId: string | null;
  orderId: string | null;
  unread: boolean;
  lastMessageAt: string | null;
  preview: string;
  eventName: string;
};

export type ControlConversation = {
  thread: ControlThread;
  messages: { id: string; sender: "organiser" | "member"; body: string; createdAt: string | null }[];
};

export type ControlAnalytics = {
  totals: ControlTotals & { refunded: number };
  byDay: { date: string; sold: number; revenue: number }[];
  byTicket: { name: string; sold: number; revenue: number }[];
  attendance: { admitted: number; expected: number };
};

export type ControlFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "url"
  | "select"
  | "tabs"
  | "switch"
  | "list"
  | "ref"
  | "date"
  | "time"
  | "datetime"
  | "image"
  | "status"
  | "audience"
  | "access"
  | "readonly";

export type ControlOption = { value: string; label: string };

export type ControlField = {
  key: string;
  label: string;
  type: ControlFieldType;
  scope: "root" | "config";
  options?: ControlOption[];
  placeholder?: string;
  hint?: string;
  refModule?: string;
  min?: number;
  max?: number;
  required?: boolean;
  // Shown only for these ticketing kinds (a coupon's fields, not an affiliate's).
  forKinds?: string[];
};

export type ControlStatusOption = ControlOption & { tone: "success" | "danger" | "info" | "warning" | "neutral" };

export type ControlModule = {
  id: string;
  store: string;
  module: string;
  section: string;
  shape: "record" | "ticketing";
  title: string;
  singular: string;
  icon: string;
  description?: string;
  createLabel?: string;
  statuses?: ControlStatusOption[];
  kinds?: { value: string; label: string }[];
  summary?: string[];
  create?: string[];
  panels: { title: string; description?: string; fields: ControlField[] }[];
};

export type ControlSetting = {
  id: string;
  store: string;
  key: string;
  section: string;
  title: string;
  icon: string;
  description?: string;
  // "list" pages edit an array of items (FAQ, alerts…); "value" pages one stored value; "object" a bag of keys.
  shape?: "object" | "value" | "list";
  itemLabel?: string;
  itemTitle?: string;
  panels: { title: string; description?: string; fields: ControlField[] }[];
};

// A hand-built Control screen listed under a Manage section; route is an app path under /control/.
export type ControlScreenLink = { id: string; section: string; title: string; icon: string; description?: string; route: string };

export type ControlSection = {
  key: string;
  title: string;
  icon: string;
  screens: ControlScreenLink[];
  modules: ControlModule[];
  settings: ControlSetting[];
};

export type ControlCatalog = { sections: ControlSection[] };

export type ControlRecord = {
  id: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string | null;
  status?: string | null;
  coverUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  kind?: string | null;
  active?: boolean;
};
