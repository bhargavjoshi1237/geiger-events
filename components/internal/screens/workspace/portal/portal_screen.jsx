"use client";

import { useState } from "react";
import { ExternalLink, Globe, Upload } from "lucide-react";
import { Badge, Button, LogoLoading } from "@geiger/ui";
import { EditorSectionHeader, EmptyState, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
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

  if (!portal.data && portal.status !== "error") {
    return <div className="flex justify-center py-20"><LogoLoading size={56} aria-label="Loading portal" /></div>;
  }
  if (!portal.data) {
    return <EmptyState title="Couldn't load the portal" description={portal.error?.message} action={<Button variant="outline" onClick={portal.reload}>Try again</Button>} />;
  }
  if (!portal.can.configure) {
    return <EmptyState icon={Globe} title="Portal" description="Only people who can set up this workspace can change the portal." />;
  }

  const settings = portal.portal;
  const ready = Boolean(settings?.peopleObjectId && settings?.emailFieldId);
  const active = tab ?? (ready ? "pages" : "people");
  const changes = portal.data.changes?.length ?? 0;
  const tabs = <SegmentedTabs value={active} onChange={setTab} tabs={TABS} />;

  return (
    <div className="space-y-4">
      <EditorSectionHeader
        title={(
          <span className="inline-flex items-center gap-2 normal-case">
            <Globe className="h-5 w-5 text-text-secondary" />Portal
            {settings?.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
          </span>
        )}
        description={`${portal.data.published ? `Live: version ${portal.data.published.number}` : "Not published yet"}${changes ? ` · ${changes} unpublished change${changes === 1 ? "" : "s"}` : ""}`}
        action={(
          <>
            <Button variant="outline" asChild><a href={portalUrl(eventId)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open portal</a></Button>
            <Button onClick={openPublish}><Upload className="h-4 w-4" />Publish{changes ? ` · ${changes}` : ""}</Button>
          </>
        )} />
      {active === "pages" ? <PagesTab eventId={eventId} ws={ws} portal={portal} pageId={pageId} onPageChange={setPageId} tabs={tabs} /> : <Toolbar>{tabs}</Toolbar>}
      {active === "roles" ? <RolesTab eventId={eventId} ws={ws} portal={portal} /> : null}
      {active === "people" ? <PeopleTab eventId={eventId} ws={ws} portal={portal} /> : null}
      {active === "publish" ? <PublishTab portal={portal} /> : null}
      {dialog}
    </div>
  );
}
