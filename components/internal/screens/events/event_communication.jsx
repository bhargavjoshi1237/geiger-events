"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessagesSquare, ArrowRight } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getEventChannel, ensureEventChat, updateChannel } from "@/lib/supabase/chat";

// Event editor "Communication" section — SETTINGS ONLY. The live chat itself
// lives in the workspace at Community → Event Chat; here the organiser opens the
// chat and configures how attendees participate.
export function EventCommunicationSection({ event, headerItem }) {
  const { setTab } = useWorkspaceUrl();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getEventChannel(event.id).then((ch) => {
      if (!alive) return;
      setChannel(ch);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [event.id]);

  const openChat = async (mode) => {
    setBusy(true);
    const ch = await ensureEventChat(event.id, mode);
    setBusy(false);
    if (!ch) {
      toast.error("Couldn't open the chat.");
      return;
    }
    setChannel(ch);
    toast.success("Event chat opened.");
  };

  const setPostingMode = async (open) => {
    const mode = open ? "open" : "announce";
    setChannel((c) => ({ ...c, postingMode: mode }));
    if (!(await updateChannel(channel.id, { postingMode: mode }))) {
      toast.error("Couldn't update chat settings.");
      setChannel((c) => ({ ...c, postingMode: open ? "announce" : "open" }));
    }
  };

  const toggleArchive = async () => {
    const next = channel.status === "archived" ? "active" : "archived";
    setChannel((c) => ({ ...c, status: next }));
    if (!(await updateChannel(channel.id, { status: next }))) {
      toast.error("Couldn't update the chat.");
      setChannel((c) => ({ ...c, status: next === "archived" ? "active" : "archived" }));
    } else {
      toast.success(next === "archived" ? "Chat archived." : "Chat reopened.");
    }
  };

  const isOpen = channel?.postingMode === "open";
  const archived = channel?.status === "archived";

  return (
    <div className="flex flex-col gap-5">
      <EditorSectionHeader
        title={headerItem?.label || "Communication"}
        description={
          headerItem?.desc ||
          "Configure this event's group chat for ticket buyers. The conversation itself lives in Community → Event Chat."
        }
        action={
          channel ? (
            <Button
              size="sm"
              onClick={() => setTab("Event Chat")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Open chat <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !channel ? (
        <SectionCard
          title="Open the event chat"
          description="Choose how attendees participate — you can change this any time. The chat also opens automatically when the event is published and tickets sell."
        >
          <EmptyState
            icon={MessagesSquare}
            title="No chat yet"
            description="Open a group chat for everyone who buys a ticket to this event."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  disabled={busy}
                  onClick={() => openChat("open")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Open discussion
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => openChat("announce")}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  Announce-only
                </Button>
              </div>
            }
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Chat settings" description="How attendees can participate.">
            <SettingsList>
              <SettingRow
                title="Allow attendees to post"
                description="On: a group discussion everyone can join. Off: announce-only — attendees can react but only you post."
                checked={isOpen}
                onCheckedChange={setPostingMode}
              />
              <SettingRow
                title="Archive chat"
                description="Close the chat to new messages. You can reopen it any time."
                checked={archived}
                onCheckedChange={toggleArchive}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="The conversation"
            description="Read, reply, moderate, run polls, and manage participants."
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                The live chat lives in the workspace so it&apos;s always one click away, across all
                your events.
              </p>
              <Button
                size="sm"
                onClick={() => setTab("Event Chat")}
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Open in Community <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

export default EventCommunicationSection;
