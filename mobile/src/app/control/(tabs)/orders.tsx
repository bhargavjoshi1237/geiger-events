import React from "react";

import { OrderList } from "@/components/control/OrderList";
import { ScreenTitle } from "@/components/ScreenTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { useControl } from "@/state/control";

export default function ControlOrdersScreen() {
  const { project } = useControl();

  return (
    <Screen scroll>
      <ScreenTitle title="Orders" eyebrow={project?.name} />
      {!project ? (
        <EmptyState icon="briefcase" title="No project yet" message="Once you're on an event team, its orders show up here." />
      ) : !project.can.orders ? (
        <EmptyState icon="lock" title="Your role can't see orders" message="Ask a project admin for access to Orders." />
      ) : (
        <OrderList key={project.id} basePath={`/api/control/projects/${project.id}/orders`} showEvent />
      )}
    </Screen>
  );
}
