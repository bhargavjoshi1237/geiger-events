import { Suspense } from "react";

import { DesktopApp } from "@/components/desktop/desktop_app";
import { DesktopLoading } from "@/components/desktop/desktop_states";

// The desktop shell's start page: sign in, pick an organization, then open its Events workspace.
export default function DesktopPage() {
  return (
    <Suspense fallback={<DesktopLoading />}>
      <DesktopApp />
    </Suspense>
  );
}
