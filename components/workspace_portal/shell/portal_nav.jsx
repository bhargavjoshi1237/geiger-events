"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import {
  Avatar, AvatarFallback, Button, Logo, LucideIcon, Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { resolveLogo } from "@/lib/events/theme";
import { eventInitials, eventMeta, eventShortName } from "@/components/workspace_portal/render/event_info";
import { usePortalApp } from "./portal_app";
import { PersonMenu } from "./person_menu";

// Which nav entry the current address belongs to (the first page is home).
function activeSlug(app) {
  const rest = app.pathname?.startsWith(app.base) ? app.pathname.slice(app.base.length).replace(/^\/+/, "") : "";
  if (!rest) return app.session?.home ?? null;
  return rest.split("/")[0];
}

// The event's logo, or an avatar tile with its initials in the event colour.
function BrandMark() {
  const { event, brand } = usePortalApp();
  const logo = brand ? resolveLogo(brand, "bar") : null;
  if (logo?.url) {
    // eslint-disable-next-line @next/next/no-img-element -- the event's own logo
    return <img src={logo.url} alt="" className="h-8 w-auto max-w-[9rem] object-contain" />;
  }
  return (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg bg-primary text-xs font-bold tracking-tight text-primary-foreground">{eventInitials(event?.name)}</AvatarFallback>
    </Avatar>
  );
}

function EventTitle() {
  const { event } = usePortalApp();
  const meta = eventMeta(event);
  return (
    <span className="grid min-w-0 flex-1 text-left leading-tight">
      <span className="truncate text-sm font-semibold text-foreground">{eventShortName(event?.name)}</span>
      {meta ? <span className="truncate text-xs text-text-secondary">{meta}</span> : null}
    </span>
  );
}

function SignInButton({ className }) {
  const { href, pathname, base } = usePortalApp();
  const next = pathname?.startsWith(base) && !pathname.endsWith("/sign-in") ? `?next=${encodeURIComponent(pathname)}` : "";
  return (
    <Button asChild className={className}>
      <Link href={`${href("sign-in")}${next}`}><LogIn className="h-4 w-4" />Sign in</Link>
    </Button>
  );
}

// The suite sidebar: the event, its pages and who is signed in. On phones it opens as a sheet from the header.
export function PortalNav() {
  const app = usePortalApp();
  const { setOpenMobile } = useSidebar();
  const nav = app.session?.nav ?? [];
  const current = activeSlug(app);
  const close = () => setOpenMobile(false);
  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-2 pb-2 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={app.href()} onClick={close}><BrandMark /><EventTitle /></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = item.slug === current;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} className={cn("h-9", active ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground")}>
                      <Link href={app.href(item.slug)} onClick={close} aria-current={active ? "page" : undefined}>
                        <LucideIcon name={item.icon || "file"} className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/70")} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {app.session?.member ? <PersonMenu variant="sidebar" /> : <SignInButton className="w-full" />}
      </SidebarFooter>
    </Sidebar>
  );
}

// Shown on phones, and on wider screens once the sidebar is hidden: the sidebar trigger, the event and the person.
export function PortalTopBar() {
  const app = usePortalApp();
  const { state } = useSidebar();
  return (
    <header className={cn("sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur",
      state === "expanded" && "md:hidden")}>
      <SidebarTrigger className="text-muted-foreground" />
      <Link href={app.href()} className="flex min-w-0 flex-1 items-center gap-2.5">
        <BrandMark />
        <EventTitle />
      </Link>
      {app.session?.member ? <PersonMenu variant="compact" /> : <SignInButton className="h-8 px-3" />}
    </header>
  );
}

// The event's full name, and who runs the portal.
export function PortalFooter() {
  const { event } = usePortalApp();
  return (
    <footer className="border-t border-border px-[clamp(16px,4vw,48px)] py-5">
      <div className="mx-auto flex max-w-[1072px] flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
        <span>{event?.name}</span>
        <span className="inline-flex items-center gap-1.5">Powered by<Logo size={14} className="opacity-80" />Geiger Events</span>
      </div>
    </footer>
  );
}
