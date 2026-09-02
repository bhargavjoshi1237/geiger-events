import React from "react";
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, radius, spacing } from "@/theme/tokens";

type TicketQrProps = {
  orderId: string;
  size: number;
  padded?: boolean;
};

// Always drawn dark-on-white — scanners need the contrast regardless of the surrounding surface.
export function TicketQr({ orderId, size, padded = true }: TicketQrProps) {
  return (
    <View style={[styles.frame, padded && styles.padded]}>
      <QRCode
        value={orderId}
        size={size}
        color={colors.paperForeground}
        backgroundColor={colors.paper}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
  },
  padded: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
