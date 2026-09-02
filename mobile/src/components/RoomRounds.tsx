import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { useCountdown } from "@/lib/countdown";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { RoundState } from "@/types/portal";

type RoomRoundsProps = {
  parentSessionId: string | null;
  liveNow: number;
};

const POLL_MS = 5_000;
const pad = (n: number) => String(n).padStart(2, "0");

// The round clock and host broadcasts a breakout room runs on, shown as the room's two stat tiles.
export function RoomRounds({ parentSessionId, liveNow }: RoomRoundsProps) {
  const { token } = useSession();
  const [round, setRound] = useState<RoundState | null>(null);

  const load = useCallback(async () => {
    if (!token || !parentSessionId) return;
    const res = await api<{ session: RoundState }>(
      `/api/portal/live/round?sessionId=${encodeURIComponent(parentSessionId)}`,
      { token },
    );
    if (res.ok && res.data.session) setRound(res.data.session);
  }, [token, parentSessionId]);

  usePoll(load, POLL_MS, Boolean(parentSessionId));

  const parts = useCountdown(round?.config.timerEndsAt || null);

  const clock =
    parts && !parts.done
      ? parts.days > 0
        ? `${parts.days}d ${pad(parts.hours)}h`
        : parts.hours > 0
          ? `${parts.hours}:${pad(parts.minutes)}:${pad(parts.seconds)}`
          : `${pad(parts.minutes)}:${pad(parts.seconds)}`
      : null;

  const broadcasts = Array.isArray(round?.config.broadcasts)
    ? (round.config.broadcasts as Record<string, unknown>[])
        .filter((b) => typeof b?.id === "string" && typeof b?.body === "string")
        .map((b) => ({ id: b.id as string, body: b.body as string }))
        .slice(0, 8)
    : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.statRow}>
        {clock ? (
          <Stat icon="clock" label="Round clock" value={clock} tone="success" />
        ) : null}
        <Stat icon="users" label="In this room" value={String(liveNow)} />
      </View>

      {broadcasts.length ? (
        <View style={styles.host}>
          <View style={styles.hostHead}>
            <Icon name="volume-2" size={13} color={colors.textTertiary} />
            <Text style={styles.hostLabel}>From the host</Text>
          </View>
          {broadcasts.map((b) => (
            <Text key={b.id} style={styles.hostLine}>
              {b.body}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Icon name={icon} size={13} color={colors.textTertiary} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, tone === "success" && styles.statValueLive]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md - 2,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  statValue: {
    ...type.mono,
    fontSize: 26,
    lineHeight: 30,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
    marginTop: spacing.sm,
  },
  statValueLive: {
    color: colors.success,
  },
  host: {
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    padding: 14,
  },
  hostHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  hostLabel: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  hostLine: {
    ...type.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.foreground,
  },
});
