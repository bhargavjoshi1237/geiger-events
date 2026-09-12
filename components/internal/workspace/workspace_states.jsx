"use client";

import React from "react";

// Shared gate states for the project-scoped workspace. Used by the /project
// resolver and the /project/[projectId] shell.

// Re-exported from the suite kit so every product's workspace gate shows the
// same animated mark. Kept as a named re-export rather than switching the ~14
// call sites to import from @geiger/ui directly, because the local path is the
// documented one for addon screens.
export { LoadingArea } from "@geiger/ui";
