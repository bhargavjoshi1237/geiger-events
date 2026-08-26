
export type Member = {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
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
