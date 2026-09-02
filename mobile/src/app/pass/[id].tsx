import * as Brightness from "expo-brightness";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/icons";
import { TicketQr } from "@/components/TicketQr";
import { EmptyState } from "@/components/ui/EmptyState";
import { Perforation } from "@/components/ui/Perforation";
import { fmtShortDay, money, pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

const SHEET_GAP = spacing.sm;
const SHEET_RADIUS = radius.xxxl + 8;
// Height taken by the bar, heading, code and the torn-off stub sitting around the QR.
const QR_RESERVED_HEIGHT = 476;
// The sheet pads its content, so full-bleed bands pull back out by the same amount.
const SHEET_PAD = spacing.xl;
const QR_MIN = 190;
const QR_MAX = 300;

// The pass is deliberately white and brightened: scanners need contrast and light.
export default function PassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useSession();
  const { data } = usePortalData();
  const [brightened, setBrightened] = useState(false);

  useEffect(() => {
    let restore: number | null = null;
    let cancelled = false;
    (async () => {
      try {
        restore = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
        if (!cancelled) setBrightened(true);
      } catch {
        // Brightness control is unavailable on some devices — the pass still scans.
      }
    })();
    return () => {
      cancelled = true;
      if (restore !== null) void Brightness.setBrightnessAsync(restore);
    };
  }, []);

  if (status === "guest") return <Redirect href="/(auth)/sign-in" />;

  const ticket = data?.tickets?.find((t) => t.id === id);
  // The pass never scrolls, so the QR has to shrink to whatever height is left.
  const qrSize = Math.max(
    QR_MIN,
    Math.min(QR_MAX, width - 96, height - insets.top - insets.bottom - QR_RESERVED_HEIGHT),
  );

  const sheetInset = {
    marginTop: insets.top + SHEET_GAP,
    marginBottom: insets.bottom + SHEET_GAP,
  };

  if (!ticket) {
    return (
      <View style={styles.backdrop}>
        <StatusBar style="light" />
        <View style={[styles.sheet, sheetInset, styles.sheetCentered]}>
          <EmptyState
            icon="credit-card"
            title="Pass unavailable"
            message="This ticket isn't on your account anymore."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const when = [ticket.eventDate ? fmtShortDay(ticket.eventDate) : null, ticket.eventTime]
    .filter(Boolean)
    .join(" · ");
  const gate = [ticket.ticket || "Admission", ticket.quantity > 1 ? `× ${ticket.quantity}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={styles.backdrop}>
      <StatusBar style="light" />

      <View style={[styles.sheet, sheetInset]}>
        <View style={styles.topBar}>
          <RoundButton icon="x" label="Close pass" onPress={() => router.back()} />
        </View>

        <View style={styles.head}>
          <View style={styles.kickerRow}>
            {brightened ? <Icon name="sun" size={13} color={colors.paperSecondary} /> : null}
            <Text style={styles.kicker}>Present at entrance</Text>
          </View>
          <Text style={styles.eventName} numberOfLines={2}>
            {ticket.eventName}
          </Text>
          <Text style={styles.gate} numberOfLines={1}>
            {[gate, ticket.venue].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={styles.qrWrap}>
          <TicketQr orderId={ticket.id} size={qrSize} padded={false} />
        </View>
        <Text style={styles.code}>{ticket.orderCode}</Text>

        <View style={styles.stubWrap}>
          <Perforation
            dashColor={colors.paperDash}
            notchColor={colors.background}
            notchSize={22}
          />
          <View style={styles.stub}>
            <View style={styles.admitRow}>
              <Text style={styles.admit}>Admit one</Text>
              <View style={styles.passCount}>
                <Icon name="users" size={13} color={colors.paperMuted} />
                <Text style={styles.passCountText}>
                  {ticket.quantity} {pluralize(ticket.quantity, "pass", "passes")}
                </Text>
              </View>
            </View>
            <DetailLine label="Attendee" value={ticket.buyerName || ticket.buyerEmail} />
            {when ? <DetailLine label="Doors" value={when} /> : null}
            <DetailLine label="Paid" value={ticket.paid ? money(ticket.total) : "Free"} />
            <DetailLine label="Issued by" value={ticket.organizer || "Organiser"} />
          </View>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.paperForeground} />
    </Pressable>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // The pass reads as a card on the dark canvas rather than a full-bleed white screen.
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: SHEET_RADIUS,
    marginHorizontal: SHEET_GAP,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  sheetCentered: {
    justifyContent: "center",
  },
  // Sits clear of the card's corner curve rather than riding the top edge.
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.md,
  },
  round: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.paperSubtle,
  },
  pressed: {
    opacity: 0.6,
  },
  head: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kicker: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.paperSecondary,
  },
  eventName: {
    ...type.title,
    textAlign: "center",
    color: colors.paperForeground,
    marginTop: spacing.sm + 2,
  },
  gate: {
    ...type.body,
    fontSize: 14,
    color: colors.paperMuted,
    marginTop: 6,
  },
  qrWrap: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  code: {
    ...type.monoLarge,
    textAlign: "center",
    color: colors.paperForeground,
    marginTop: spacing.lg + 2,
    marginBottom: spacing.lg + 2,
  },
  // The tear line and stub run edge to edge, so the notches bite into the card's sides.
  stubWrap: {
    marginTop: "auto",
    marginHorizontal: -SHEET_PAD,
  },
  // Same card stock as the body — only the tear line separates them, as on a real ticket.
  stub: {
    gap: spacing.md,
    paddingHorizontal: SHEET_PAD,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.xxl,
  },
  admitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  admit: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.paperForeground,
  },
  passCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  passCountText: {
    ...type.captionStrong,
    color: colors.paperMuted,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailLabel: {
    ...type.body,
    fontSize: 14,
    color: colors.paperSecondary,
  },
  detailValue: {
    ...type.label,
    flexShrink: 1,
    textAlign: "right",
    color: colors.paperForeground,
  },
});
