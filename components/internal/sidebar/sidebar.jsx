"use client";

import React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronDown, Search, MoreVertical, PanelLeft, Bell, HelpCircle, X } from "lucide-react";
import { SidebarOption } from "./sidebar_option";
import { NotificationsDropdown } from "../topbar/dialogue/notifications_dropdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavLoading, useVisibleNav } from "@/lib/hooks/use-visible-nav";

// Persist the sidebar's scroll offset across mounts. The shell now lives in the
// project layout, so a tab change no longer remounts it — but a reload (or a
// project switch) still does, and a long nav list should come back where the
// user left it. We stash the last offset in a module-scoped variable and restore
// it before paint.
const SIDEBAR_SCROLL_ID = "workspace-sidebar-scroll";
let savedSidebarScroll = 0;

// Held in place of the nav until it can be trusted. The list is the project's
// addons, narrowed by this user's grants and then by their own curation — all
// three are a round trip away, and the server-rendered markup paints first, so
// rendering the real list early means showing sections that vanish a moment
// later. Fixed widths (never random) so the server and client markup agree.
const SKELETON_WIDTHS = [
  "w-24", "w-16", "w-28", "w-20", "w-32", "w-16",
  "w-24", "w-20", "w-28", "w-16", "w-24", "w-20",
];

function SidebarNavSkeleton() {
  return SKELETON_WIDTHS.map((width, i) => (
    <SidebarMenuItem
      key={i}
      aria-hidden="true"
      className="flex h-9 items-center gap-3 rounded-md px-2 group-data-[collapsible=icon]:justify-center"
    >
      <Skeleton className="h-4 w-4 shrink-0 rounded bg-sidebar-foreground/10" />
      <Skeleton
        className={cn(
          "h-2.5 rounded bg-sidebar-foreground/10 group-data-[collapsible=icon]:hidden",
          width,
        )}
      />
    </SidebarMenuItem>
  ));
}

function MobileSidebarHeader() {
  const { isMobile, toggleSidebar } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <SidebarHeader className="p-0 border-b border-sidebar-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0">
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`}
              alt=""
              className="w-5 h-5"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement.innerHTML =
                  '<div class="w-2 h-2 bg-foreground rounded-full"></div>';
              }}
            />
          </div>
          <span className="text-foreground font-semibold text-sm">Events</span>
        </div>
      </div>
    </SidebarHeader>
  );
}

// Authorization is no longer passed in. It used to arrive as `roleId`/`roles`
// props that nothing ever supplied, so the filter defaulted to "allow
// everything"; useVisibleNav() now reads the signed-in user's real grants from
// RbacProvider instead.
export function AppSidebar({ activeTab = "Overview", onTabChange = () => {} }) {
  const { toggleSidebar } = useSidebar();
  const [expandedItems, setExpandedItems] = React.useState({});

  // Restore the saved scroll offset before paint (no flicker) whenever the
  // sidebar (re)mounts after a tab switch, and keep it in sync as the user
  // scrolls. SidebarContent forwards props to its scroll div, so we address it
  // by id rather than a ref.
  React.useLayoutEffect(() => {
    const el = document.getElementById(SIDEBAR_SCROLL_ID);
    if (el) el.scrollTop = savedSidebarScroll;
  }, []);
  const handleSidebarScroll = (e) => {
    savedSidebarScroll = e.currentTarget.scrollTop;
  };

  // Enabled addons + grant filtering, shared with the topbar's search palette so
  // both surfaces list exactly the same destinations.
  const visibleNav = useVisibleNav();
  const navLoading = useNavLoading();

  const toggleExpand = (title) => {
    setExpandedItems((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar border-r border-sidebar-border text-sidebar-foreground"
    >
      <MobileSidebarHeader />
      <SidebarContent
        id={SIDEBAR_SCROLL_ID}
        onScroll={handleSidebarScroll}
        className="py-1 space-y-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navLoading && <SidebarNavSkeleton />}
              {!navLoading && visibleNav.map((item) => (
                <SidebarOption
                  key={item.title}
                  title={item.title}
                  icon={item.icon}
                  isActive={activeTab === item.title}
                  badge={item.badge}
                  subItems={item.subItems || null}
                  isExpanded={
                    expandedItems[item.title] !== undefined
                      ? expandedItems[item.title]
                      : !!item.subItems?.some((sub) => sub.title === activeTab)
                  }
                  onToggle={() => toggleExpand(item.title)}
                  activeSubTab={activeTab}
                  onClick={(subTitle) =>
                    onTabChange(
                      typeof subTitle === "string" ? subTitle : item.title,
                    )
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto">
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-sidebar-accent transition-all text-sidebar-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center"
        >
          <PanelLeft className="w-5 h-5 shrink-0" />
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
