import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-[#2a2a2a] bg-[#202020] px-3 py-2 text-sm text-[#ededed] placeholder:text-[#5c5c5c] transition-colors outline-none focus-visible:border-[#474747] focus-visible:ring-2 focus-visible:ring-[#333333] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
