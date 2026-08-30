"use client";

import React, { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { Bell, Download, Loader2, MessageSquare } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getUser } from "@/lib/supabase/user";
import { formatDistanceToNow } from "date-fns";
import { SegmentedTabs } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

const NOTIFICATION_TABS = [
  { label: "All", value: "all" },
  { label: "Discussions", value: "discussions" },
  { label: "Mentions", value: "mentions" },
];

function SkeletonRows() {
  return (
    <div className="px-4 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 border-b border-border py-3.5 last:border-b-0">
          <div className="mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded-lg bg-surface-subtle" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-subtle" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-subtle" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsDropdown({ children }) {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingRead, setMarkingRead] = useState({});
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let alive = true;
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      const userData = await getUser();

      if (userData) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .schema("public")
          .from("flow_notifications")
          .select("*")
          .eq("user_id", userData.id)
          .order("time", { ascending: false });

        if (!alive) return;
        if (fetchError) {
          setError("Couldn't load notifications.");
        }
        if (data) {
          setNotifications(data);
        }
      }
      if (alive) setLoading(false);
    };
    fetchNotifications();
    return () => {
      alive = false;
    };
  }, []);

  const markRead = async (notification) => {
    if (notification.read || markingRead[notification.id]) return;
    setMarkingRead((prev) => ({ ...prev, [notification.id]: true }));
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: updateError } = await supabase
        .schema("public")
        .from("flow_notifications")
        .update({ read: true })
        .eq("id", notification.id);
      if (updateError) throw updateError;
    } catch {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: notification.read } : n,
        ),
      );
      setError("Couldn't update the notification.");
    } finally {
      setMarkingRead((prev) => ({ ...prev, [notification.id]: false }));
    }
  };

  const openAttachment = (event, file) => {
    event.stopPropagation();
    if (!file.url || downloading) return;
    setDownloading(file.name);
    try {
      window.open(file.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(null);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "discussions") return n.type === "discussion";
    if (activeTab === "mentions") return n.type === "mention";
    return true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button
            aria-label="Notifications"
            className="w-8 h-8 rounded-full border border-transparent hover:bg-surface-hover flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="mt-1 w-[380px] p-0 bg-background border border-border rounded-2xl overflow-hidden  scrollbar-hide"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">
              Notifications
            </h2>
          </div>

          <SegmentedTabs tabs={NOTIFICATION_TABS} value={activeTab} onChange={setActiveTab} fullWidth />
        </div>

        <div className="max-h-[420px] overflow-y-auto pb-2 custom-scrollbar">
          {loading ? (
            <SkeletonRows />
          ) : error ? (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-200">
              {error}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="You're all caught up."
              className="py-12"
            />
          ) : (
            filteredNotifications.map((notification) => {
              const IconComponent = LucideIcons[notification.icon] || Bell;
              let formattedTime = notification.time;
              try {
                const date = new Date(notification.time);
                if (!isNaN(date.getTime())) {
                  formattedTime = formatDistanceToNow(date, {
                    addSuffix: true,
                  });
                }
              } catch {}

              let extraContent = null;
              try {
                if (typeof notification.extra === "string") {
                  extraContent = JSON.parse(notification.extra);
                } else if (
                  typeof notification.extra === "object" &&
                  notification.extra !== null
                ) {
                  extraContent = notification.extra;
                }
              } catch {}

              const isUnread = !notification.read;
              const bgColor = notification.bg_color || notification.bgColor || "bg-surface-card";
              const iconColor = notification.icon_color || notification.iconColor || "text-text-secondary";

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3.5 transition-colors relative group border-b border-border last:border-b-0",
                    isUnread
                      ? "bg-surface-subtle/50 hover:bg-surface-card"
                      : "hover:bg-surface-subtle",
                  )}
                >
                  {isUnread && (
                    <div className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  )}

                  <div className="pl-3 flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                        bgColor,
                        "border border-foreground/10",
                      )}
                    >
                      <IconComponent
                        className={cn("w-4 h-4", iconColor)}
                        strokeWidth={1.8}
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <h3
                          className={cn(
                            "text-[13px] font-medium truncate",
                            isUnread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {notification.title}
                        </h3>
                        <span className="text-[11px] text-text-tertiary whitespace-nowrap shrink-0">
                          {formattedTime}
                        </span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>

                      {extraContent && (
                        <div className="mt-3">
                          {extraContent.type === "comment" && (
                            <div className="bg-surface-subtle border border-border rounded-lg p-3 text-[12px] text-muted-foreground leading-relaxed">
                              {extraContent.text}
                            </div>
                          )}

                          {extraContent.type === "discussion" && (
                            <div className="bg-surface-subtle border border-border rounded-lg p-3 text-[12px] text-muted-foreground leading-relaxed">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                                  {extraContent.channel}
                                </span>
                                <span className="text-[11px] text-text-secondary">
                                  {extraContent.replies} replies
                                </span>
                              </div>
                              <p className="text-foreground">{extraContent.message}</p>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-[11px] text-text-secondary">
                                  Started by {extraContent.author}
                                </span>
                                <div className="flex -space-x-1">
                                  {extraContent.participants?.map((person) => (
                                    <span
                                      key={person}
                                      className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-hover text-[11px] font-semibold text-foreground"
                                    >
                                      {person}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {extraContent.type === "file" &&
                            extraContent.files?.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-surface-subtle mt-2"
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <div className="w-7 h-7 rounded flex items-center justify-center bg-surface-card text-muted-foreground text-[10px] font-medium">
                                    {f.name.split('.').pop().toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] text-muted-foreground truncate">
                                      {f.name}
                                    </div>
                                    <div className="text-[11px] text-text-secondary">
                                      {f.size}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  onClick={(e) => openAttachment(e, f)}
                                  disabled={!f.url || downloading === f.name}
                                  aria-label={`Download ${f.name}`}
                                  className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
                                >
                                  {downloading === f.name ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            ))}

                          {extraContent.type === "actions" && (
                            <div className="flex items-center gap-2 mt-2.5">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(notification);
                                }}
                                disabled={markingRead[notification.id]}
                                className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-surface-active hover:text-foreground transition-colors"
                              >
                                {extraContent.options?.[0] || "Decline"}
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(notification);
                                }}
                                disabled={markingRead[notification.id]}
                                className="px-3 py-1.5 rounded-lg bg-primary text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                {markingRead[notification.id] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                {extraContent.options?.[1] || "Accept"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3">
                        <span className="text-[11px] uppercase font-semibold tracking-wider text-text-secondary bg-surface-card px-2 py-1 rounded-md border border-border">
                          {notification.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
