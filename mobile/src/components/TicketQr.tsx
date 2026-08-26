import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, radius, spacing, type } from "@/theme/tokens";

type TicketQrProps = {
  orderId: string;
  orderCode: string;
};

export function TicketQr({ orderId, orderCode }: TicketQrProps) {
  const { width } = useWindowDimensions();
  const side = Math.min(280, width - 96);
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <QRCode
          value={orderId}
          size={side}
          color={colors.primaryForeground}
          backgroundColor={colors.primary}
        />
      </View>
      <Text style={styles.code}>{orderCode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  code: {
    ...type.label,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
});
