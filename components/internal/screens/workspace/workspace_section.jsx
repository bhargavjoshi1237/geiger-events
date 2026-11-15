"use client";

import { Layers3, Plus } from "lucide-react";
import { Button } from "@geiger/ui";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { ObjectScreen } from "./object/object_screen";
import { SettingsScreen } from "./settings/settings_screen";
import { SetupScreen } from "./setup/setup_screen";
import { PortalScreen } from "./portal/portal_screen";
import { TEAM_PAGE_PREFIX, TeamPage } from "./portal/team_page";
import { AutomationsScreen } from "./process/automations_screen";
import { ApprovalsScreen } from "./process/approvals_screen";
import { ReviewScreen } from "./process/review_screen";
import { DocumentsScreen } from "./documents/documents_screen";
import { PageBar, PageBody, WorkspacePage } from "./shell/page";

export const OBJECT_SECTION_PREFIX = "ws-";
export const objectSectionKey = (objectId) => `${OBJECT_SECTION_PREFIX}${objectId}`;

// The screen for one workspace section key: setup, a list, a process screen, the portal, a team page or settings.
export function WorkspaceSection({ event, ws, sectionKey, onNavigate, onCreateList }) {
  const open = (objectId) => onNavigate?.(objectSectionKey(objectId));

  if (!ws.data) {
    return (
      <WorkspacePage>
        <PageBar icon={Layers3} title="Workspace" crumb={null} />
        <EmptyState title="Couldn't load the workspace" description={ws.error?.message} action={<Button variant="outline" onClick={ws.reload}>Try again</Button>} />
      </WorkspacePage>
    );
  }
  if (!ws.exists) return <SetupScreen eventId={event.id} ws={ws} />;

  const objectId = sectionKey?.startsWith(OBJECT_SECTION_PREFIX) ? sectionKey.slice(OBJECT_SECTION_PREFIX.length) : null;
  const object = objectId ? ws.objects.find((item) => item.id === objectId) : null;

  if (object) return <ObjectScreen key={object.id} eventId={event.id} ws={ws} object={object} />;
  if (sectionKey === "workspace-settings") return <SettingsScreen eventId={event.id} ws={ws} onOpenObject={open} onCreateList={onCreateList} />;
  if (sectionKey === "workspace-portal") return <PortalScreen eventId={event.id} ws={ws} />;
  if (sectionKey === "workspace-automations") return <AutomationsScreen eventId={event.id} ws={ws} />;
  if (sectionKey === "workspace-approvals") return <ApprovalsScreen eventId={event.id} ws={ws} />;
  if (sectionKey === "workspace-review") return <ReviewScreen eventId={event.id} ws={ws} />;
  if (sectionKey === "workspace-documents") return <DocumentsScreen eventId={event.id} ws={ws} />;
  if (sectionKey?.startsWith(TEAM_PAGE_PREFIX)) {
    const pageId = sectionKey.slice(TEAM_PAGE_PREFIX.length);
    return <TeamPage key={pageId} eventId={event.id} ws={ws} pageId={pageId} onNavigate={onNavigate} />;
  }

  const first = [...ws.objects].sort((a, b) => a.position - b.position)[0];
  if (first) return <ObjectScreen key={first.id} eventId={event.id} ws={ws} object={first} />;
  return (
    <WorkspacePage>
      <PageBar icon={Layers3} title="Lists" />
      <PageBody className="flex items-center justify-center">
        <EmptyState title="Create your first list" description="A list holds one kind of thing — vendors, volunteers, papers, shifts."
          action={ws.can.configure ? <Button onClick={onCreateList}><Plus className="h-4 w-4" />New list</Button> : null} />
      </PageBody>
    </WorkspacePage>
  );
}
