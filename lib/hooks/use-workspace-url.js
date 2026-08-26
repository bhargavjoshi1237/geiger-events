"use client";

import { createContext, useCallback, useContext } from "react";
import {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
} from "next/navigation";
import { tabToSlug, slugToTab } from "@/lib/workspace/tabs";

export const DEFAULT_TAB = "Overview";
export const DEFAULT_SECTION = "overview";

export const WorkspaceUrlContext = createContext(null);

export function useWorkspaceUrl() {
  const override = useContext(WorkspaceUrlContext);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params?.projectId || null;
  const rest = params?.rest;
  const tabSlug = Array.isArray(rest) ? rest[0] : rest || null;
  const tab = (tabSlug && slugToTab(tabSlug)) || DEFAULT_TAB;

  const eventId = searchParams.get("event") || null;
  const section = searchParams.get("section") || DEFAULT_SECTION;
  const workflowId = searchParams.get("workflow") || null;
  const venueId = searchParams.get("venue") || null;
  const recordId = searchParams.get("record") || null;

  const buildUrl = useCallback(
    (next) => {
      const pid = next.project !== undefined ? next.project : projectId;
      const nextTab = next.tab !== undefined ? next.tab : tab;
      const slug =
        nextTab && nextTab !== DEFAULT_TAB ? tabToSlug(nextTab) : "";
      let path = `/project/${pid}`;
      if (slug) path += `/${slug}`;

      const qp = new URLSearchParams();
      const ev = next.event !== undefined ? next.event : eventId;
      const sec = next.section !== undefined ? next.section : section;
      const wf = next.workflow !== undefined ? next.workflow : workflowId;
      const vn = next.venue !== undefined ? next.venue : venueId;
      const rc = next.record !== undefined ? next.record : recordId;
      if (ev) qp.set("event", ev);
      if (vn) qp.set("venue", vn);
      if (rc) qp.set("record", rc);
      if (sec && sec !== DEFAULT_SECTION) qp.set("section", sec);
      if (wf) qp.set("workflow", wf);

      const qs = qp.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [projectId, tab, eventId, section, workflowId, venueId, recordId, pathname],
  );

  const apply = useCallback(
    (next, { replace = false } = {}) => {
      const url = buildUrl(next);
      const movesPath =
        next.project !== undefined || next.tab !== undefined || !projectId;
      if (movesPath) {
        router.push(url, { scroll: false });
        return;
      }
      const at = url.indexOf("?");
      const href = `${window.location.pathname}${at === -1 ? "" : url.slice(at)}`;
      if (replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    },
    [router, buildUrl, projectId],
  );

  const setProject = useCallback(
    (id) =>
      apply({
        project: id,
        event: null,
        section: null,
        workflow: null,
        venue: null,
        record: null,
      }),
    [apply],
  );
  const setTab = useCallback(
    (next) =>
      apply({
        tab: next,
        event: null,
        section: null,
        workflow: null,
        venue: null,
        record: null,
      }),
    [apply],
  );
  const openEvent = useCallback(
    (id) => apply({ event: id, section: null }),
    [apply],
  );
  const openEventInTab = useCallback(
    (id, nextTab) => apply({ tab: nextTab, event: id, section: null }),
    [apply],
  );
  const closeEvent = useCallback(
    () => apply({ event: null, section: null }),
    [apply],
  );
  const setSection = useCallback(
    (next) => apply({ section: next }, { replace: true }),
    [apply],
  );

  const openWorkflow = useCallback((id) => apply({ workflow: id }), [apply]);
  const closeWorkflow = useCallback(() => apply({ workflow: null }), [apply]);
  const openWorkflowInTab = useCallback(
    (id, nextTab) => apply({ tab: nextTab, workflow: id }),
    [apply],
  );

  const openVenue = useCallback(
    (id) => apply({ venue: id, section: null }),
    [apply],
  );
  const closeVenue = useCallback(
    () => apply({ venue: null, section: null }),
    [apply],
  );

  const openRecord = useCallback(
    (id) => apply({ record: id, section: null }),
    [apply],
  );
  const closeRecord = useCallback(
    () => apply({ record: null, section: null }),
    [apply],
  );

  if (override) return override;

  return {
    projectId,
    tab,
    eventId,
    section,
    workflowId,
    venueId,
    recordId,
    setProject,
    setTab,
    openEvent,
    openEventInTab,
    closeEvent,
    setSection,
    openWorkflow,
    closeWorkflow,
    openWorkflowInTab,
    openVenue,
    closeVenue,
    openRecord,
    closeRecord,
  };
}
