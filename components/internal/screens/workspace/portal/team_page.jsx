"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelsTopLeft, Pencil } from "lucide-react";
import { Button, LoadingArea } from "@geiger/ui";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { iconFor } from "../ws_ui";
import { PageBar, PageBody, WorkspacePage } from "../shell/page";
import { FileViewer } from "@/components/workspace_portal/render/pdf_viewer";
import { PageView } from "@/components/workspace_portal/render/page_view";
import { PortalViewProvider } from "@/components/workspace_portal/render/portal_context";
import { RecordSheet } from "../record/record_sheet";
import { createTeamAdapter } from "./adapters";
import { usePortal } from "./use_portal";

export const TEAM_PAGE_PREFIX = "wp-";
export const teamPageKey = (pageId) => `${TEAM_PAGE_PREFIX}${pageId}`;

// A portal page shared with the team, shown inside the dashboard with full access. Records open in the staff sheet.
export function TeamPage({ eventId, ws, pageId, onNavigate }) {
  const portal = usePortal(eventId);
  const page = portal.pages.find((item) => item.id === pageId);
  const [view, setView] = useState({ key: null, data: null, error: null });
  const [sheet, setSheet] = useState({ open: false, objectId: null, recordId: null });
  const [bump, setBump] = useState(0);
  const key = `${pageId}:${page?.revision ?? 0}`;

  useEffect(() => {
    if (!pageId) return undefined;
    const controller = new AbortController();
    portal.api.view({ what: "page", pageId, as: { mode: "team", draft: true } }, controller.signal)
      .then(({ data, error }) => { if (!controller.signal.aborted) setView({ key, data, error }); }).catch(() => {});
    return () => controller.abort();
  }, [portal.api, pageId, key]);

  const adapter = useMemo(() => createTeamAdapter({
    eventId, page: view.data?.page, definition: ws.data,
    onOpenRecord: (record) => {
      const objectId = record.objectId ?? ws.objects.find((object) => object.key === record.list)?.id;
      if (objectId && record.id) setSheet({ open: true, objectId, recordId: record.id });
    },
    onNavigate: (slug) => {
      const target = portal.pages.find((item) => item.kind === "page" && item.slug === slug && item.audience?.team);
      if (target) onNavigate?.(teamPageKey(target.id));
    },
  }), [eventId, view.data?.page, ws.data, ws.objects, portal.pages, onNavigate, setSheet]);

  const bar = (
    <PageBar icon={iconFor(page?.icon || "file")} title={page?.title ?? "Team page"} note="A portal page shared with the team"
      actions={page && portal.can.configure ? <Button variant="outline" size="sm" onClick={() => onNavigate?.("workspace-portal")}><Pencil className="h-3.5 w-3.5" />Edit page</Button> : null} />
  );
  if (!portal.data || (view.key !== key && !view.data)) {
    return <WorkspacePage>{bar}<LoadingArea size={56} label="Loading page" /></WorkspacePage>;
  }
  if (!page || (view.error && view.key === key)) {
    return <WorkspacePage>{bar}<EmptyState icon={PanelsTopLeft} title="Page not found" description={view.error?.message ?? "It may have been removed or is no longer a team page."} /></WorkspacePage>;
  }

  return (
    <WorkspacePage>
      {bar}
      <PageBody padded>
        <PortalViewProvider api={adapter} mode="team" eventId={eventId} timeZone={view.data.session?.event?.timeZone} page={view.data.page} lists={view.data.lists}
          session={view.data.session} revision={bump}>
          <FileViewer api={adapter}><PageView /></FileViewer>
        </PortalViewProvider>
      </PageBody>
      <RecordSheet open={sheet.open} onOpenChange={(open) => setSheet((current) => ({ ...current, open }))} eventId={eventId} data={ws.data}
        objectId={sheet.objectId} recordId={sheet.recordId} timeZone={ws.data?.event?.timeZone ?? "UTC"} can={ws.can} run={ws.run}
        onSaved={() => setBump((n) => n + 1)} onOpenRecord={(id, objectId) => setSheet({ open: true, recordId: id, objectId: objectId ?? sheet.objectId })} />
    </WorkspacePage>
  );
}
