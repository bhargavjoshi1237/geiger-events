"use client";

import React from "react";
import { Loader2 } from "lucide-react";

// Shared gate states for the project-scoped workspace. Used by the /project
// resolver and the /project/[projectId] shell.

export function LoadingArea() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-text-secondary">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}
