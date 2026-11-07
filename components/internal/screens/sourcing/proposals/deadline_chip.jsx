"use client";

import React from "react";
import { Clock } from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { deadlineInfo } from "@/lib/sourcing/rfp_model";

// Countdown to the response deadline; only urgent while the RFP is actually out for bids.
export function DeadlineChip({ rfp, now }) {
  if (!rfp?.responseDeadline) {
    return <span className="text-xs text-text-tertiary">No deadline</span>;
  }
  const info = deadlineInfo(rfp.responseDeadline, now);
  const live = rfp.status === "sent";
  const label = live
    ? info.label
    : rfp.status === "draft"
      ? info.past
        ? "Deadline passed"
        : `Closes in ${info.label.replace(" left", "").replace("Under ", "under ")}`
      : "Closed";
  return (
    <Badge variant={live ? info.tone : info.past && rfp.status === "draft" ? "danger" : "neutral"}>
      <Clock />
      {label}
    </Badge>
  );
}

export default DeadlineChip;
