"use client";

import { BadgeCheck, FileText, Globe, Layers3, Settings2, Users, Workflow } from "lucide-react";
import { objectSectionKey, OBJECT_SECTION_PREFIX } from "./workspace_section";
import { TEAM_PAGE_PREFIX, teamPageKey } from "./portal/team_page";
import { teamPagesOf } from "./portal/use_portal";
import { iconFor } from "./ws_ui";

export const isWorkspaceSection = (key) => ["workspace", "workspace-settings", "workspace-portal", "workspace-automations", "workspace-approvals", "workspace-review", "workspace-documents"].includes(key)
  || Boolean(key?.startsWith(OBJECT_SECTION_PREFIX)) || Boolean(key?.startsWith(TEAM_PAGE_PREFIX));

// The event editor shows one Workspace entry; opening it switches the editor into the workspace's own layout.
export function withWorkspaceNav(groups, ws) {
  if (ws.status === "error" && !ws.data) return groups;
  const items = [{
    key: "workspace", label: ws.exists ? "Workspace" : "Set up workspace", icon: Layers3, ownHeader: true,
    desc: "Build the back office this event needs.",
  }];
  const at = groups.findIndex((group) => group.group === "General");
  const next = [...groups];
  next.splice(at >= 0 ? at + 1 : next.length, 0, { group: "Workspace", items });
  return next;
}

// The workspace sidebar: lists, team pages, process, the portal and settings, each with its count or status.
export function workspaceNavGroups(ws, portal, { approvals = 0 } = {}) {
  if (!ws.exists) return { groups: [{ id: "setup", label: "Workspace", items: [{ key: "workspace", label: "Set up workspace", icon: Layers3 }] }], footer: null };
  const counts = ws.data?.counts ?? {};
  const lists = [...ws.objects].sort((a, b) => a.position - b.position).map((object) => ({
    key: objectSectionKey(object.id), label: object.plural, icon: iconFor(object.icon), count: counts[object.id],
  }));
  const team = (portal?.data ? teamPagesOf(portal) : []).map((page) => ({ key: teamPageKey(page.id), label: page.title, icon: iconFor(page.icon || "file") }));
  const settings = portal?.portal;
  const portalStatus = settings?.enabled ? (portal.data?.published ? "live" : "draft") : "off";
  const groups = [
    { id: "lists", label: "Lists", items: lists, add: Boolean(ws.can?.configure) },
    ...(team.length ? [{ id: "team", label: "Team pages", items: team }] : []),
    {
      id: "process", label: "Process", items: [
        { key: "workspace-automations", label: "Automations", icon: Workflow },
        { key: "workspace-approvals", label: "Approvals", icon: BadgeCheck, badge: approvals || null },
        { key: "workspace-review", label: "Review", icon: Users },
        { key: "workspace-documents", label: "Documents", icon: FileText },
      ],
    },
    ...(ws.can?.configure ? [{ id: "share", label: "Outside the team", items: [{ key: "workspace-portal", label: "Portal", icon: Globe, status: portalStatus }] }] : []),
  ];
  return { groups, footer: { key: "workspace-settings", label: "Workspace settings", icon: Settings2 } };
}
