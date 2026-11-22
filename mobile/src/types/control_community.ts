import type { ChatMessage } from "@/types/portal";

// View models for Control's Community moderation screens (../app/api/control/community/*).

export type CommunityChannelKind = "event" | "qa";

export type CommunityChannel = {
  id: string;
  eventId: string | null;
  kind: CommunityChannelKind;
  name: string;
  topic: string;
  postingMode: "open" | "announce";
  status: "active" | "archived";
  createdAt: string | null;
  eventName: string;
  lastPreview: string;
  lastMessageAt: string | null;
  participantCount: number;
  messageCount: number;
};

export type CommunityChannelDetail = { channel: CommunityChannel; messages: ChatMessage[] };

export type CommunityParticipant = { id: string; memberId: string | null; muted: boolean; joinedAt: string | null };

export type BoardTopicStatus = "published" | "pending" | "hidden";

export type CommunityBoard = {
  id: string;
  eventId: string | null;
  name: string;
  description: string;
  format: "discussion" | "qa" | string;
  requireApproval: boolean;
  archived: boolean;
  topicCount: number;
  postCount: number;
  lastActivityAt: string | null;
};

export type CommunityTopic = {
  id: string;
  boardId: string;
  authorKind: string;
  authorMemberId: string | null;
  authorName: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  status: BoardTopicStatus;
  replyCount: number;
  acceptedPostId: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
};

export type CommunityPost = {
  id: string;
  topicId: string;
  parentPostId: string | null;
  authorKind: string;
  authorName: string;
  body: string;
  status: BoardTopicStatus;
  createdAt: string | null;
  topic: CommunityTopic | null;
};

export type CommunityReport = {
  id: string;
  topicId: string;
  postId: string | null;
  reporterName: string;
  reason: string;
  details: string;
  status: "open" | "actioned" | "dismissed" | string;
  createdAt: string | null;
  topic: CommunityTopic | null;
  post: CommunityPost | null;
};

export type CommunityBoards = { boards: CommunityBoard[]; topics: CommunityTopic[] };

export type CommunityTopicDetail = { topic: CommunityTopic; board: CommunityBoard | null; posts: CommunityPost[] };

export type CommunityModeration = { topics: CommunityTopic[]; posts: CommunityPost[]; reports: CommunityReport[] };

export type MeetingStatus = "scheduled" | "completed" | "no_show" | "cancelled";

export type CommunityMeeting = {
  id: string;
  people: string[];
  startsAt: string | null;
  endsAt: string | null;
  locationName: string;
  status: MeetingStatus;
  notes: string;
  cancelReason: string;
  cancelledBy: string | null;
};

export type CommunityMeetingRequest = {
  id: string;
  from: string;
  to: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired" | string;
  proposedSlots: number;
  expiresAt: string | null;
  createdAt: string | null;
};

export type CommunityMeetings = { meetings: CommunityMeeting[]; requests: CommunityMeetingRequest[] };
