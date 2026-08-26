"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/lib/supabase/user";
import { useProject } from "@/context/project-context";

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
