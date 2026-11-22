// Bespoke Control screens for community moderation; each entry links a Manage section to an app route.
export const COMMUNITY_MODERATION_SCREENS = [
  {
    id: "community.event_chat",
    section: "community",
    title: "Event chat",
    icon: "message-circle",
    description: "Read and post in each event's group chat, delete messages, mute or remove attendees.",
    route: "/control/community/chats",
  },
  {
    id: "community.qa_threads",
    section: "community",
    title: "Q&A threads",
    icon: "message-circle-question-mark",
    description: "Start Q&A threads, answer questions, and open, close or archive them.",
    route: "/control/community/qa",
  },
  {
    id: "community.boards",
    section: "community",
    title: "Discussion boards",
    icon: "messages-square",
    description: "Approve, hide, pin and lock topics, reply as the organiser, and act on reports.",
    route: "/control/community/boards",
  },
  {
    id: "community.meetings",
    section: "community",
    title: "Meeting scheduler",
    icon: "calendar-check",
    description: "See booked meetings and requests; mark them done, no-show or cancelled.",
    route: "/control/community/meetings",
  },
];
