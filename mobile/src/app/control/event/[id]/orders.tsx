import { useLocalSearchParams } from "expo-router";
import React from "react";

import { OrderList } from "@/components/control/OrderList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui/Screen";
import { useControlQuery } from "@/lib/use_control_query";
import type { ControlEventDetail } from "@/types/portal";

export default function ControlEventOrdersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });

  return (
    <Screen scroll header={<ScreenHeader title="Orders" subtitle={data?.event.name} />}>
      <OrderList basePath={`/api/control/events/${id}/orders`} />
    </Screen>
  );
}
