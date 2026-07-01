"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

// The workspace moved to project-scoped routes (/project/<id>/<tab>). This old
// entry point now just forwards to the resolver, which opens the last-used
// project (or prompts to create one). Kept so existing /home links keep working.
export default function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/project");
  }, [router]);
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background" />
  );
}
