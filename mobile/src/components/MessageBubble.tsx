import * as Clipboard from "expo-clipboard";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { fmtTimeAgo } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ChatMessage, PollData, ThreadMessage } from "@/types/portal";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "😂"] as const;

type MessageBubbleProps = {
  message: ChatMessage | ThreadMessage;
  isOwn: boolean;
  grouped: boolean;
  meKey?: string;
  quotedMessage?: { authorName: string; text: string } | null;
  reacting?: boolean;
  onReply?: () => void;
  onLongPress?: () => void;
  onPickReaction?: (emoji: string) => void;
  onVote?: (optionId: string) => void;
};

function isChatMessage(m: ChatMessage | ThreadMessage): m is ChatMessage {
  return "text" in m;
}

function textOf(m: ChatMessage | ThreadMessage): string {
  return isChatMessage(m) ? m.text : m.body;
}

function authorOf(m: ChatMessage | ThreadMessage): string {
  return isChatMessage(m) ? m.authorName || "Someone" : "Organiser";
}

function isSystem(m: ChatMessage | ThreadMessage): boolean {
  return isChatMessage(m) && m.senderKind === "system";
}

function narrowPoll(poll: Record<string, unknown> | null): PollData | null {
  if (!poll || typeof poll !== "object") return null;
  const p = poll as Record<string, unknown>;
  const options = Array.isArray(p.options)
    ? p.options
        .map((o) => {
          const row = o && typeof o === "object" ? (o as Record<string, unknown>) : {};
          return {
            id: typeof row.id === "string" ? row.id : "",
            label: typeof row.label === "string" ? row.label : "",
          };
        })
        .filter((o) => o.id)
    : [];
  const votes: Record<string, string[]> = {};
  if (p.votes && typeof p.votes === "object") {
    for (const [k, v] of Object.entries(p.votes as Record<string, unknown>)) {
      if (Array.isArray(v)) votes[k] = v.filter((x): x is string => typeof x === "string");
    }
  }
  return {
    question: typeof p.question === "string" ? p.question : "",
    options,
    votes,
    multi: p.multi === true,
    closed: p.closed === true,
  };
}

function pollVoterCount(poll: PollData): number {
  const set = new Set<string>();
  for (const keys of Object.values(poll.votes)) for (const k of keys) set.add(k);
  return set.size;
}

export function MessageBubble({
  message,
  isOwn,
  grouped,
  meKey,
  quotedMessage,
  reacting,
  onReply,
  onLongPress,
  onPickReaction,
  onVote,
}: MessageBubbleProps) {
  const { success } = useToast();
  const system = isSystem(message);
  const deleted = isChatMessage(message) && message.deleted;
  const poll = isChatMessage(message) ? narrowPoll(message.poll) : null;
  const reactions = isChatMessage(message) ? message.reactions : {};

  if (system) {
    return <Text style={styles.system}>{textOf(message)}</Text>;
  }

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
      return;
    }
    void Clipboard.setStringAsync(textOf(message)).then(() => success("Copied"));
  };

  const reactionEntries = Object.entries(reactions).filter(
    ([, v]) => Array.isArray(v) && v.length > 0,
  );

  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      {!isOwn && !grouped ? <Avatar name={authorOf(message)} size={28} /> : null}
      <View style={[styles.col, isOwn ? styles.colOwn : styles.colOther]}>
        {!grouped ? (
          <Text style={styles.author}>{isOwn ? "You" : authorOf(message)}</Text>
        ) : null}
        <View style={[styles.line, isOwn && styles.lineOwn]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={textOf(message)}
            onLongPress={handleLongPress}
            delayLongPress={350}
          >
            <View
              style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleOther,
                deleted && styles.bubbleDeleted,
              ]}
            >
              {quotedMessage ? (
                <View style={styles.quote}>
                  <Text style={styles.quoteAuthor} numberOfLines={1}>
                    {quotedMessage.authorName}
                  </Text>
                  <Text style={styles.quoteText} numberOfLines={2}>
                    {quotedMessage.text}
                  </Text>
                </View>
              ) : null}
              {poll ? (
                <PollCard poll={poll} meKey={meKey} onVote={onVote} />
              ) : (
                <>
                  <Text
                    style={[
                      styles.text,
                      isOwn && styles.textOwn,
                      deleted && styles.textDeleted,
                    ]}
                  >
                    {deleted ? "Message removed" : textOf(message)}
                  </Text>
                  <Text style={[styles.time, isOwn && styles.timeOwn]}>
                    {fmtTimeAgo(message.createdAt)}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
          {onReply ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reply"
              onPress={onReply}
              hitSlop={8}
              style={styles.reply}
            >
              <Icon name="corner-up-left" size={14} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
        {!deleted && reactionEntries.length ? (
          <View style={styles.reactions}>
            {reactionEntries.map(([emoji, v]) => {
              const keys = v as string[];
              const mine = meKey ? keys.includes(meKey) : false;
              return (
                <View
                  key={emoji}
                  style={[styles.reactionChip, mine && styles.reactionChipMine]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionCount, mine && styles.reactionCountMine]}>
                    {keys.length}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {reacting && onPickReaction ? (
          <View style={styles.picker}>
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => {
                  tapFeedback();
                  onPickReaction(emoji);
                }}
                hitSlop={4}
                style={styles.pickerBtn}
              >
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PollCard({
  poll,
  meKey,
  onVote,
}: {
  poll: PollData;
  meKey?: string;
  onVote?: (optionId: string) => void;
}) {
  const total = pollVoterCount(poll);
  const closed = poll.closed;
  return (
    <View style={styles.poll}>
      <Text style={styles.pollQuestion}>{poll.question}</Text>
      {poll.options.map((o) => {
        const votes = poll.votes[o.id] || [];
        const mine = meKey ? votes.includes(meKey) : false;
        const pct = total ? Math.round((votes.length / total) * 100) : 0;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: closed || !onVote, selected: mine }}
            disabled={closed || !onVote}
            onPress={() => {
              tapFeedback();
              onVote?.(o.id);
            }}
            style={[styles.pollOption, mine && styles.pollOptionMine]}
          >
            <View style={[styles.pollBar, { width: `${pct}%` }]} />
            <Text style={styles.pollLabel} numberOfLines={2}>
              {o.label}
            </Text>
            <Text style={styles.pollVotes}>
              {votes.length} · {pct}%
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.pollMeta}>
        {total} {total === 1 ? "vote" : "votes"}
        {poll.multi ? " · pick multiple" : ""}
        {closed ? " · closed" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  system: {
    ...type.caption,
    fontStyle: "italic",
    color: colors.textTertiary,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  rowOwn: {
    flexDirection: "row-reverse",
  },
  col: {
    maxWidth: "80%",
    gap: 2,
  },
  colOwn: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
  },
  colOther: {
    alignItems: "flex-start",
    alignSelf: "flex-start",
  },
  author: {
    ...type.captionStrong,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.xs,
    marginBottom: 4,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  lineOwn: {
    flexDirection: "row-reverse",
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceActive,
    borderBottomLeftRadius: 6,
  },
  bubbleDeleted: {
    backgroundColor: colors.surfaceSubtle,
  },
  text: {
    ...type.body,
    color: colors.foreground,
  },
  textOwn: {
    color: colors.primaryForeground,
  },
  textDeleted: {
    fontStyle: "italic",
    color: colors.textTertiary,
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
    gap: 1,
  },
  quoteAuthor: {
    ...type.caption,
    color: colors.textSecondary,
  },
  quoteText: {
    ...type.caption,
    color: colors.mutedForeground,
  },
  reply: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  reactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  reactionChipMine: {
    borderColor: `${colors.primary}4D`,
    backgroundColor: `${colors.primary}14`,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    ...type.caption,
    fontSize: 10,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  reactionCountMine: {
    color: colors.foreground,
  },
  picker: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceDialog,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  pickerBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerEmoji: {
    fontSize: 16,
  },
  time: {
    ...type.caption,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  timeOwn: {
    textAlign: "right",
    color: "rgba(22,22,22,0.55)",
  },
  poll: {
    gap: spacing.md,
  },
  pollQuestion: {
    ...type.label,
    color: colors.foreground,
  },
  pollOption: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden",
    borderRadius: radius.md - 2,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.md,
  },
  pollOptionMine: {
    borderWidth: 1,
    borderColor: `${colors.primary}59`,
  },
  pollBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.borderStrong,
  },
  pollLabel: {
    flex: 1,
    ...type.captionStrong,
    fontSize: 13,
    color: colors.foreground,
  },
  pollVotes: {
    ...type.micro,
    fontSize: 12,
    color: colors.mutedForeground,
    fontVariant: ["tabular-nums"],
  },
  pollMeta: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
