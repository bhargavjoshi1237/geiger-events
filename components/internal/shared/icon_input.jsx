"use client";

import React from "react";

import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";

// Text field with a leading icon and/or a trailing adornment. The padding that
// keeps them clear of the text comes from the [data-lead]/[data-trail] rules in
// globals.css — @geiger/ui's Input pins padding-x with !important, so a pl-*
// utility here would be silently dropped and the icon would sit on the text.
const ADORNMENT = "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center text-muted-foreground";
const EDGE = { left: "var(--input-box-padding-x, 0.75rem)" };
const EDGE_RIGHT = { right: "var(--input-box-padding-x, 0.75rem)" };

export function IconInput({ icon: Icon, trailing, className, wrapperClassName, ...props }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      {Icon ? (
        <span className={ADORNMENT} style={EDGE}>
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <Input
        data-lead={Icon ? "" : undefined}
        data-trail={trailing ? "" : undefined}
        className={className}
        {...props}
      />
      {trailing ? (
        <span className={cn(ADORNMENT, "pointer-events-auto")} style={EDGE_RIGHT}>
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

export default IconInput;
