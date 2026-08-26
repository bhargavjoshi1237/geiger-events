"use client";

import React, { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";
import { SidebarOption } from "../sidebar_option";
import { MobileSidebarHeader } from "./mobile_sidebar_header";
import { projectNav, settingsNav } from "./sidebar_data";
import { Button } from "@/components/ui/button";

export function ProjectSidebar({ activeTab = "Overview", onTabChange = () => {} }) {
  const { toggleSidebar, state } = useSidebar();
  const [expandedItems, setExpandedItems] = useState({});

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
      <SidebarContent className="space-y-2 relative flex-1 overflow-hidden bg-sidebar">
        <div className="absolute inset-0 w-full h-full bg-sidebar translate-x-0">
          <div className="h-full overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectNav.map((item) => (
                    <SidebarOption
                      key={item.title}
                      title={item.title}
                      icon={item.icon}
                      isActive={activeTab === item.title}
                      subItems={item.hasSubmenu ? settingsNav : item.subItems || null}
                      isExpanded={
                        expandedItems[item.title] !== undefined
                          ? expandedItems[item.title]
                          : !!(item.hasSubmenu
                              ? settingsNav
                              : item.subItems
                            )?.find((s) => s.title === activeTab)
                      }
                      onToggle={() => toggleExpand(item.title)}
                      activeSubTab={activeTab}
                      onClick={(tabTitle) => {
                        if (tabTitle && typeof tabTitle === "string") {
                          onTabChange(tabTitle);
                        } else if (item.hasSubmenu || item.subItems) {
                          toggleExpand(item.title);
                        } else {
                          setExpandedItems({});
                          onTabChange(item.title);
                        }
                      }}
                      badge={item.badge}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto z-10 bg-sidebar">
        <Button
          type="button"
          aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
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
