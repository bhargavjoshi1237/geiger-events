"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/lib/supabase/user";
import { useProject } from "@/context/project-context";

// The name a newly created event is credited to — what the public page renders
// as "Hosted by" (event_public_page: hosts[0]). The signed-in user first, then
// the active project's name; never a hard-coded person. Returns "" while the
// session resolves and when neither is known, in which case the public page
// simply omits the host block rather than crediting the wrong name.
export function useDefaultOrganizer() {
  const { project } = useProject();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let alive = true;
    getUser().then((u) => alive && setUserName(u?.name || ""));
    return () => {
      alive = false;
    };
  }, []);

  return userName || project?.name || "";
}
