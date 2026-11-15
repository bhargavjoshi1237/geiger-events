"use client";

import { BadgeCheck, FileText, Globe, Layers3, Settings2, Users, Workflow } from "lucide-react";
import { LucideIcon } from "@geiger/ui";
import { objectSectionKey, OBJECT_SECTION_PREFIX } from "./workspace_section";
import { TEAM_PAGE_PREFIX, teamPageKey } from "./portal/team_page";
import { teamPagesOf } from "./portal/use_portal";

// One stable icon component per icon name, so nav items don't remount on every render.
const iconCache = new Map();
function iconFor(name) {
  if (!iconCache.has(name)) {
    const Icon = (props) => <LucideIcon name={name || "database"} {...props} />;
    Icon.displayName = `WorkspaceIcon(${name})`;
    iconCache.set(name, Icon);
  }
  return iconCache.get(name);
}

export const isWorkspaceSection = (key) => ["workspace", "workspace-settings", "workspace-portal", "workspace-automations", "workspace-approvals", "workspace-review", "workspace-documents"].includes(key)
  || Boolean(key?.startsWith(OBJECT_SECTION_PREFIX)) || Boolean(key?.startsWith(TEAM_PAGE_PREFIX));

// Inserts the Workspace group after "General": setup until a workspace exists, then its lists, team pages, the portal and settings.
export function withWorkspaceNav(groups, ws, portal = null) {
  if (ws.status === "error" && !ws.data) return groups;
  const items = !ws.data || !ws.exists
    ? [{ key: "workspace", label: "Set up workspace", icon: Layers3, ownHeader: true, desc: "Build the back office this event needs." }]
    : [
      ...[...ws.objects].sort((a, b) => a.position - b.position).map((object) => ({
        key: objectSectionKey(object.id), label: object.plural, icon: iconFor(object.icon), ownHeader: true,
      })),
      ...(portal?.data ? teamPagesOf(portal) : []).map((page) => ({ key: teamPageKey(page.id), label: page.title, icon: iconFor(page.icon || "file"), ownHeader: true })),
      { key: "workspace-automations", label: "Automations", icon: Workflow, ownHeader: true },
      { key: "workspace-approvals", label: "Approvals", icon: BadgeCheck, ownHeader: true },
      { key: "workspace-review", label: "Review", icon: Users, ownHeader: true },
      { key: "workspace-documents", label: "Documents", icon: FileText, ownHeader: true },
      ...(ws.can?.configure ? [{ key: "workspace-portal", label: "Portal", icon: Globe, ownHeader: true, desc: "Pages for reviewers, authors and other people outside the team." }] : []),
      { key: "workspace-settings", label: "Workspace settings", icon: Settings2, ownHeader: true },
    ];
  const at = groups.findIndex((group) => group.group === "General");
  const next = [...groups];
  next.splice(at >= 0 ? at + 1 : next.length, 0, { group: "Workspace", items });
  return next;
}
