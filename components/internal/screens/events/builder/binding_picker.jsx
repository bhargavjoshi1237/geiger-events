"use client";

import React from "react";
import { Braces } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BINDING_GROUPS, tokenFor } from "@/lib/events/bindings";

export function BindingPicker({ onInsert, align = "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Insert a dynamic value"
          title="Insert a dynamic value"
          className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface-card px-1.5 text-[0.65rem] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Braces className="h-3 w-3" />
          Dynamic
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-[24rem] w-64 overflow-y-auto border-border bg-surface-subtle"
      >
        {BINDING_GROUPS.map((group, gi) => (
          <React.Fragment key={group.key}>
            {gi > 0 ? <DropdownMenuSeparator className="bg-border" /> : null}
            <DropdownMenuLabel className="text-[0.65rem] uppercase tracking-wider text-text-tertiary">
              {group.label}
            </DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem
                key={`${item.token}:${item.label}`}
                onSelect={() => onInsert(tokenFor(item))}
                className="flex-col items-start gap-0.5 focus:bg-surface-hover"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <code className="text-[0.65rem] text-text-tertiary">
                  {tokenFor(item)}
                </code>
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default BindingPicker;
