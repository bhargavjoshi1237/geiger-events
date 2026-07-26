"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getEvent } from "@/lib/supabase/events";
import { AccessGate } from "@/components/checkin_routes/access_gate";
import { IssueDesk } from "@/components/checkin_routes/issue_desk";

// The item-issuing route. Staff unlock it with an 'issue' access code — its own
// code space, so a scanning or kiosk code can't open it (and vice versa). Codes
// are managed under Inventory → Issuing Staff.
export default function IssuePage() {
  const params = useParams();
  const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId;
  const [event, setEvent] = useState(null);

  useEffect(() => {
    let alive = true;
    getEvent(eventId).then((row) => alive && setEvent(row));
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <AccessGate
      eventId={eventId}
      title="Item issuing"
      subtitle="Enter the issuing access code to start handing out items."
      require="canIssue"
      codeType="issue"
    >
      {({ code, role, exit }) => (
        <IssueDesk eventId={eventId} code={code} role={role} exit={exit} event={event} />
      )}
    </AccessGate>
  );
}
