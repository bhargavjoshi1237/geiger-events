"use client";

import React from "react";
import { Bell, Megaphone } from "lucide-react";

import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Card, fmtDateTime } from "./portal_kit";

export function PortalNotifications({ items = [], loading }) {
  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Notifications"
        description="Updates and announcements from the events you're attending."
      />

      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading…</div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className={n.unread ? "border-primary/30 bg-primary/5" : ""}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-muted-foreground">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {n.unread ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-text-tertiary">
                      {fmtDateTime(n.createdAt)}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Updates and announcements from the events you're attending will show up here."
        />
      )}
    </MainScreenWrapper>
  );
}

export default PortalNotifications;
