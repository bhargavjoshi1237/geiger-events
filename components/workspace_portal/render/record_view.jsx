"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@geiger/ui";
import { PageView } from "./page_view";
import { usePortalView } from "./portal_context";

// A record page: a way back, which list and record this is, then the list's record page blocks.
export function RecordView({ onBack, backLabel = "Back" }) {
  const { record, lists } = usePortalView();
  const list = record ? lists[record.objectId] : null;
  return (
    <div className="grid gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}><ArrowLeft className="h-4 w-4" />{backLabel}</Button>
        ) : null}
        {list ? (
          <p className="min-w-0 truncate text-sm text-text-secondary">
            {list.plural}<span className="px-1.5 text-text-tertiary">/</span><span className="text-foreground">{list.numberPrefix}-{record.number}</span>
          </p>
        ) : null}
      </div>
      <PageView />
    </div>
  );
}
