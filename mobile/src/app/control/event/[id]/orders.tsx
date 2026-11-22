import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { OrderList } from "@/components/control/OrderList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Readout, type ReadoutFigure } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { moneyIn } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { radius, spacing } from "@/theme/tokens";
import type { ControlEventDetail } from "@/types/portal";

const count = (n: number) => n.toLocaleString("en-US");

export default function ControlEventOrdersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });

  let readout: React.ReactNode = null;
  // Same gate as the event hub: revenue only shows to roles that can see orders or analytics.
  if (data && (data.can.orders || data.can.analytics)) {
    const { sold, capacity } = data.event;
    const items: ReadoutFigure[] = [
      { label: "Tickets sold", value: count(sold), hint: capacity > 0 ? `of ${count(capacity)}` : undefined },
      capacity > 0
        ? { label: "Left", value: count(Math.max(0, capacity - sold)), tone: sold >= capacity ? "warning" : "neutral" }
        : { label: "Capacity", value: "No limit" },
    ];
    readout = (
      <Animated.View entering={FadeInDown.springify()}>
        <Readout
          lead={{ label: "Revenue", value: moneyIn(data.details.revenue, data.details.currency), hint: `${count(sold)} ${pluralize(sold, "ticket", "tickets")}` }}
          items={items}
        />
      </Animated.View>
    );
  } else if (!data && !error) {
    readout = <Skeleton height={150} radius={radius.lg} />;
  }

  return (
    <Screen scroll header={<ScreenHeader title="Orders" subtitle={data?.event.name} />}>
      {readout ? <View style={styles.readout}>{readout}</View> : null}
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <OrderList basePath={`/api/control/events/${id}/orders`} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readout: {
    marginBottom: spacing.xl,
  },
});
