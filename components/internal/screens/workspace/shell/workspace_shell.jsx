"use client";

import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronsUpDown, Plus } from "lucide-react";
import {
  Avatar, AvatarFallback, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  LoadingArea, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/internal/screens/events/sample_data";
import { useWorkspace } from "../state/use_workspace";
import { useApprovalCount } from "../process/use_process";
import { usePortal } from "../portal/use_portal";
import { ObjectSheet } from "../edit/object_sheet";
import { workspaceNavGroups } from "../nav";
import { objectSectionKey, WorkspaceSection } from "../workspace_section";

const initials = (text) => String(text || "?").replace(/[—–-].*$/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const eventMeta = (event) => [formatDate(event?.date), event?.venue].filter(Boolean).join(" · ");
const STATUS = { live: ["Live", "bg-emerald-400"], draft: ["Draft", "bg-amber-400"], off: ["Off", "bg-text-tertiary"] };
// Centres the 20px badge on the 36px rows; it must use the library's own peer variant, or its top-1.5 (sized for 32px rows) wins.
const BADGE_TOP = "peer-data-[size=default]/menu-button:top-2";

// One workspace screen in the sidebar, styled like the app sidebar's own items.
function NavItem({ item, active, onSelect }) {
  const Icon = item.icon;
  const status = item.status ? STATUS[item.status] : null;
  const badge = item.badge ?? (item.count !== undefined && item.count !== null ? item.count.toLocaleString() : null);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton type="button" isActive={active} onClick={() => onSelect(item.key)}
        className={cn("h-9 text-sm transition-all", active ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground")}>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-sidebar-foreground/70")} /> : null}
        <span>{item.label}</span>
      </SidebarMenuButton>
      {status ? (
        <SidebarMenuBadge className={cn(BADGE_TOP, "gap-1.5 text-[11px] font-normal text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", status[1])} />{status[0]}</SidebarMenuBadge>
      ) : badge ? (
        <SidebarMenuBadge className={cn(BADGE_TOP, "tabular-nums", item.badge ? "rounded-full bg-foreground px-1.5 text-[11px] text-background" : "text-xs font-normal text-text-tertiary")}>{badge}</SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

function EventTile({ name }) {
  return (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg border border-border bg-sidebar-accent text-[11px] font-semibold text-muted-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

// The event this workspace belongs to; with other events to hand it doubles as a switcher.
function EventSwitcher({ event, events, onSwitch }) {
  const others = (events ?? []).filter((item) => item.id !== event?.id);
  const body = (
    <>
      <EventTile name={event?.name} />
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-[13px] font-semibold text-foreground">{event?.name}</span>
        <span className="truncate text-xs text-text-secondary">{eventMeta(event) || "No date set"}</span>
      </span>
    </>
  );
  if (!others.length || !onSwitch) return <SidebarMenu><SidebarMenuItem><div className="flex h-12 items-center gap-2 px-2">{body}</div></SidebarMenuItem></SidebarMenu>;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              {body}<ChevronsUpDown className="ml-auto text-text-tertiary" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-medium text-text-secondary">Switch event</DropdownMenuLabel>
            {[event, ...others].map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => item.id !== event?.id && onSwitch(item.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  <span className="block truncate text-xs text-text-secondary">{eventMeta(item) || "No date set"}</span>
                </span>
                {item.id === event?.id ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Phones and tablets: back to the editor plus a menu of every workspace screen.
function MobileBar({ groups, footer, current, onSelect, onExit }) {
  const all = [...groups.flatMap((group) => group.items), ...(footer ? [footer] : [])];
  const here = all.find((item) => item.key === current);
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 px-4 lg:hidden">
      <Button variant="ghost" size="sm" className="-ml-2 text-text-secondary" onClick={onExit}><ArrowLeft className="h-4 w-4" />Editor</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-auto max-w-[60%]"><span className="truncate">{here?.label ?? "Workspace"}</span><ChevronDown className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
          {groups.map((group, index) => (
            <div key={group.id}>
              {index ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs font-medium text-text-secondary">{group.label}</DropdownMenuLabel>
              {group.items.map((item) => {
                const Icon = item.icon;
                return <DropdownMenuItem key={item.key} onSelect={() => onSelect(item.key)}>{Icon ? <Icon className="h-4 w-4" /> : null}{item.label}</DropdownMenuItem>;
              })}
            </div>
          ))}
          {footer ? (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onSelect(footer.key)}><footer.icon className="h-4 w-4" />{footer.label}</DropdownMenuItem></>) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// The workspace's own layout inside the event editor: its sidebar on the left, the chosen screen filling the rest edge to edge.
export function WorkspaceShell({ event, events, section, onNavigate, onExit, onSwitchEvent }) {
  const ws = useWorkspace(event?.id);
  const portal = usePortal(event?.id, { enabled: ws.exists });
  const approvals = useApprovalCount(event?.id, { enabled: ws.exists });
  const [creating, setCreating] = useState(false);
  const { groups, footer } = workspaceNavGroups(ws, portal, { approvals });
  const firstList = groups.find((group) => group.id === "lists")?.items[0]?.key;
  const current = section === "workspace" && ws.exists && firstList ? firstList : section;

  return (
    // Pinned to the dashboard's scrolling main (position: relative), so it fills it exactly whatever that main's padding is.
    <div className="absolute inset-0 flex min-h-0 overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarHeader className="gap-1.5 border-b border-sidebar-border">
          <Button variant="ghost" size="xs" className="self-start text-text-secondary hover:text-foreground" onClick={onExit}>
            <ArrowLeft />Event editor
          </Button>
          <EventSwitcher event={event} events={events} onSwitch={onSwitchEvent} />
        </SidebarHeader>
        {/* Groups sit flush (no content gap, slim vertical padding) so a label reads as the head of its items, not a free-floating break. */}
        <SidebarContent className="gap-0 py-1">
          {ws.data ? groups.map((group) => (
            <SidebarGroup key={group.id} className="py-1.5">
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              {group.add ? (
                <SidebarGroupAction title="New list" onClick={() => setCreating(true)}><Plus /><span className="sr-only">New list</span></SidebarGroupAction>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.length ? group.items.map((item) => <NavItem key={item.key} item={item} active={item.key === current} onSelect={onNavigate} />)
                    : <p className="px-2 py-1 text-xs text-text-tertiary">No lists yet.</p>}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )) : null}
        </SidebarContent>
        {footer && ws.data ? (
          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu><NavItem item={footer} active={footer.key === current} onSelect={onNavigate} /></SidebarMenu>
          </SidebarFooter>
        ) : null}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {ws.data ? <MobileBar groups={groups} footer={footer} current={current} onSelect={onNavigate} onExit={onExit} /> : null}
        {ws.data || ws.status === "error" ? (
          <WorkspaceSection event={event} ws={ws} sectionKey={current} onNavigate={onNavigate} onCreateList={() => setCreating(true)} />
        ) : <LoadingArea size={72} label="Loading workspace" />}
      </main>

      {ws.data ? (
        <ObjectSheet open={creating} onOpenChange={setCreating} data={ws.data} object={null} run={ws.run} onCreated={(created) => onNavigate(objectSectionKey(created.id))} />
      ) : null}
    </div>
  );
}
