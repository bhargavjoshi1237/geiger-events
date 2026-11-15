"use client";

import { Plus } from "lucide-react";
import { Button, LogoLoading } from "@geiger/ui";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { useState } from "react";
import { useWorkspace } from "./state/use_workspace";
import { ObjectScreen } from "./object/object_screen";
import { ObjectSheet } from "./edit/object_sheet";
import { SettingsScreen } from "./settings/settings_screen";
import { SetupScreen } from "./setup/setup_screen";
import { PortalScreen } from "./portal/portal_screen";
import { TEAM_PAGE_PREFIX, TeamPage } from "./portal/team_page";
import { AutomationsScreen } from "./process/automations_screen";
import { ApprovalsScreen } from "./process/approvals_screen";
import { ReviewScreen } from "./process/review_screen";
import { DocumentsScreen } from "./documents/documents_screen";

export const OBJECT_SECTION_PREFIX = "ws-";
export const objectSectionKey = (objectId) => `${OBJECT_SECTION_PREFIX}${objectId}`;

// Event editor entry for the Workspace group: setup, one list, or settings, depending on the section key.
export function WorkspaceSection({ event, sectionKey, onNavigate }) {
  const ws = useWorkspace(event?.id);
  const [creating, setCreating] = useState(false);
  const open = (objectId) => onNavigate?.(objectSectionKey(objectId));

  if (!ws.data && ws.status !== "error") {
    return <div className="flex justify-center py-20"><LogoLoading size={56} aria-label="Loading workspace" /></div>;
  }
  if (!ws.data) {
    return <EmptyState title="Couldn't load the workspace" description={ws.error?.message} action={<Button variant="outline" onClick={ws.reload}>Try again</Button>} />;
  }
  if (!ws.exists) return <SetupScreen eventId={event.id} ws={ws} onCreated={() => setCreating(true)} />;

  const objectId = sectionKey?.startsWith(OBJECT_SECTION_PREFIX) ? sectionKey.slice(OBJECT_SECTION_PREFIX.length) : null;
  const object = objectId ? ws.objects.find((item) => item.id === objectId) : null;

  if (object) return <ObjectScreen key={object.id} eventId={event.id} ws={ws} object={object} />;
  if (sectionKey === "workspace-settings") return <SettingsScreen eventId={event.id} ws={ws} onOpenObject={open} />;
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
  if (first && objectId) return <ObjectScreen key={first.id} eventId={event.id} ws={ws} object={first} />;
  return (
    <>
      {ws.objects.length ? <SettingsScreen eventId={event.id} ws={ws} onOpenObject={open} /> : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState title="Create your first list" description="A list holds one kind of thing — papers, reviewers, booths, shifts."
            action={ws.can.configure ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New list</Button> : null} />
        </div>
      )}
      <ObjectSheet open={creating} onOpenChange={setCreating} data={ws.data} object={null} run={ws.run} onCreated={(created) => open(created.id)} />
    </>
  );
}
