import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { useCountdown } from "@/lib/countdown";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { RoundState } from "@/types/portal";

type RoundRailProps = {
  parentSessionId: string;
};

const POLL_MS = 5_000;

const pad = (n: number) => String(n).padStart(2, "0");

export function RoundRail({ parentSessionId }: RoundRailProps) {
  const { token } = useSession();
  const [round, setRound] = useState<RoundState | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ session: RoundState }>(
      `/api/portal/live/round?sessionId=${encodeURIComponent(parentSessionId)}`,
      { token },
    );
    if (res.ok && res.data.session) setRound(res.data.session);
  }, [token, parentSessionId]);

  usePoll(load, POLL_MS, true);

  const parts = useCountdown(round?.config.timerEndsAt || null);

  const remaining =
    parts && !parts.done
      ? parts.days > 0
        ? `${parts.days}d ${parts.hours}h`
        : parts.hours > 0
          ? `${parts.hours}h ${pad(parts.minutes)}m`
          : `${parts.minutes}m ${pad(parts.seconds)}s`
      : null;

  const broadcasts = Array.isArray(round?.config.broadcasts)
    ? (round.config.broadcasts as Record<string, unknown>[])
        .filter((b) => typeof b?.id === "string" && typeof b?.body === "string")
        .map((b) => ({ id: b.id as string, body: b.body as string }))
        .slice(0, 8)
    : [];

  if (!remaining && !broadcasts.length) return null;

  return (
    <View style={styles.rail}>
      {remaining ? (
        <View style={styles.chip}>
          <Feather name="clock" size={13} color={colors.success} />
          <Text style={styles.chipText}>Round ends in {remaining}</Text>
        </View>
      ) : null}
      {broadcasts.length ? (
        <View style={styles.broadcasts}>
          <Text style={styles.broadcastLabel}>From the host</Text>
          {broadcasts.map((b) => (
            <Text key={b.id} style={styles.broadcast}>
              {b.body}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: `${colors.success}14`,
    borderWidth: 1,
    borderColor: `${colors.success}4D`,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    ...type.caption,
    color: colors.foreground,
  },
  broadcasts: {
    gap: spacing.xs,
  },
  broadcastLabel: {
    ...type.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  broadcast: {
    ...type.body,
    color: colors.mutedForeground,
  },
});
