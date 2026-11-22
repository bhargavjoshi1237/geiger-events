import React from "react";

import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { eventStatusMeta, whenLabel } from "@/lib/control_meta";
import type { ControlEvent } from "@/types/portal";

type Props = {
  event: ControlEvent;
  onPress: () => void;
  divider?: boolean;
};

export function EventRow({ event, onPress, divider = true }: Props) {
  const status = eventStatusMeta(event.status);
  return (
    <ListRow
      leading={<IconTile icon="calendar" size={34} tone={event.when === "today" ? "success" : "neutral"} />}
      title={event.name}
      subtitle={[whenLabel(event), event.venue].filter(Boolean).join(" · ")}
      trailing={<Pill label={status.label} tone={status.tone} variant="outline" />}
      onPress={onPress}
      divider={divider}
    />
  );
}
