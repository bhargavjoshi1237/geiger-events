import React from "react";

import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { eventUrl, shareEventLink, sharePass, shareTicket } from "@/lib/share";
import type { Ticket } from "@/types/portal";

type ShareTicketSheetProps = {
  ticket: Ticket;
  visible: boolean;
  onClose: () => void;
};

// Choice dialog: each option hands off to the device share sheet.
export function ShareTicketSheet({ ticket, visible, onClose }: ShareTicketSheetProps) {
  const { error } = useToast();

  const run = (fn: (t: Ticket) => Promise<boolean>) => async () => {
    onClose();
    const ok = await fn(ticket);
    if (!ok) error("Couldn't open share.");
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Share">
      <ListRow
        leading={<IconTile icon="qr-code" size={34} />}
        title="Share pass"
        subtitle="Entry details, order code and attendee"
        onPress={() => void run(sharePass)()}
        divider
      />
      <ListRow
        leading={<IconTile icon="credit-card" size={34} />}
        title="Share ticket"
        subtitle="Ticket type, quantity and receipt"
        onPress={() => void run(shareTicket)()}
        divider={Boolean(eventUrl(ticket))}
      />
      {eventUrl(ticket) ? (
        <ListRow
          leading={<IconTile icon="link" size={34} />}
          title="Share event link"
          subtitle="Public event page"
          onPress={() => void run(shareEventLink)()}
          divider={false}
        />
      ) : null}
    </Sheet>
  );
}
