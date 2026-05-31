"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SegmentedTabs({
  tabs,
  value,
  onChange,
  className,
  buttonClassName,
  fullWidth = false,
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1",
        fullWidth ? "w-full" : "w-full sm:w-auto",
        className,
      )}
    >
      {tabs.map((tab) => {
        const item = typeof tab === "string" ? { label: tab, value: tab } : tab;
        const isActive = value === item.value;
        const Icon = item.icon;

        return (
          <Button
            key={item.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex h-8 min-w-max flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all sm:flex-none",
              isActive
                ? "bg-[#2a2a2a] text-white shadow-sm"
                : "text-[#737373] hover:bg-[#202020] hover:text-[#e7e7e7]",
              buttonClassName,
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
