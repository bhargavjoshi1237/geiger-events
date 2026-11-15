"use client";

import { useState } from "react";
import { ExternalLink, Globe, Upload } from "lucide-react";
import { Badge, Button, LoadingArea } from "@geiger/ui";
import { EmptyState, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { PageBar, PageBody, PageToolbar, TOOLBAR_TABS, WorkspacePage } from "../shell/page";
import { PagesTab } from "./pages_tab";
import { PeopleTab, portalUrl } from "./people_tab";
import { PublishTab, usePublish } from "./publish_tab";
import { RolesTab } from "./roles_tab";
import { usePortal } from "./use_portal";

const TABS = [
  { label: "Pages", value: "pages" }, { label: "Roles & access", value: "roles" },
  { label: "Sign-in & people", value: "people" }, { label: "Publish", value: "publish" },
];

// The portal builder: pages people outside the team use (reviewers, authors, volunteers), who sees what, invites and publishing.
export function PortalScreen({ eventId, ws }) {
  const portal = usePortal(eventId);
  const [tab, setTab] = useState(null);
  const [pageId, setPageId] = useState(null);
  const { open: openPublish, dialog } = usePublish(portal);

  if (!portal.data || !portal.can.configure) {
    return (
      <WorkspacePage>
        <PageBar icon={Globe} title="Portal" />
        {!portal.data && portal.status !== "error" ? <LoadingArea size={56} label="Loading portal" />
          : !portal.data ? <EmptyState title="Couldn't load the portal" description={portal.error?.message} action={<Button variant="outline" onClick={portal.reload}>Try again</Button>} />
            : <EmptyState icon={Globe} title="Portal" description="Only people who can set up this workspace can change the portal." />}
      </WorkspacePage>
    );
  }

  const settings = portal.portal;
  const ready = Boolean(settings?.peopleObjectId && settings?.emailFieldId);
  const active = tab ?? (ready ? "pages" : "people");
  const changes = portal.data.changes?.length ?? 0;
  const tabs = <SegmentedTabs {...TOOLBAR_TABS} value={active} onChange={setTab} tabs={TABS} />;

  return (
    <WorkspacePage>
      <PageBar icon={Globe} title="Portal"
        badge={settings?.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
        note={`${portal.data.published ? `Live: version ${portal.data.published.number}` : "Not published yet"}${changes ? ` · ${changes} unpublished change${changes === 1 ? "" : "s"}` : ""}`}
        actions={(
          <>
            <Button variant="outline" size="sm" asChild><a href={portalUrl(eventId)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open Portal</a></Button>
            <Button size="sm" onClick={openPublish}><Upload className="h-4 w-4" />Publish{changes ? ` · ${changes}` : ""}</Button>
          </>
        )} />
      {active === "pages" ? <PagesTab eventId={eventId} ws={ws} portal={portal} pageId={pageId} onPageChange={setPageId} tabs={tabs} /> : (
        <>
          <PageToolbar>{tabs}</PageToolbar>
          {active === "roles" ? <PageBody padded><RolesTab eventId={eventId} ws={ws} portal={portal} /></PageBody> : (
            <PageBody>
              <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
                {active === "people" ? <PeopleTab eventId={eventId} ws={ws} portal={portal} /> : <PublishTab portal={portal} />}
              </div>
            </PageBody>
          )}
        </>
      )}
      {dialog}
    </WorkspacePage>
  );
}
