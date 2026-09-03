"use client";

import React from "react";
import { Download } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { ScreenHeader, SectionCard } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { EChart } from "./echart";
import { EVENT_OPTIONS, RANGE_OPTIONS } from "./demo_data";
import { downloadCsv } from "./theme";

export function ReportHeader({ title, description, event, setEvent, range, setRange, onExport, exportLabel = "Export" }) {
  return (
    <ScreenHeader
      title={title}
      description={description}
      actions={
        <>
          {setEvent ? (
            <FilterDropdown value={event} onValueChange={setEvent} options={EVENT_OPTIONS} height="h-9" />
          ) : null}
          {setRange ? (
            <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
          ) : null}
          {onExport ? (
            <Button
              variant="outline"
              onClick={onExport}
              className="h-9 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              {exportLabel}
            </Button>
          ) : null}
        </>
      }
    />
  );
}

export function ChartCard({ title, description, action, option, height = 320, replayKey }) {
  return (
    <SectionCard title={title} description={description} action={action}>
      <EChart option={option} height={height} replayKey={replayKey} />
    </SectionCard>
  );
}

export function csvExport(filename, rows) {
  return () => downloadCsv(filename, rows);
}
