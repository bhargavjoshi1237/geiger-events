"use client";
/* eslint-disable @next/next/no-img-element -- portal renders remote Supabase cover URLs; next/image adds no value here */

import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock,
  Loader2,
  Mic,
  PlayCircle,
  Search,
  VideoOff,
} from "lucide-react";

import { EmptyState, ScreenHeader, SearchInput } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { toEmbed } from "@/lib/video-embed";
import { usePresenceHeartbeat } from "@/lib/hooks/use-presence-heartbeat";
import { fmtDate } from "./portal_kit";

// The member's on-demand library — every recording their memberships unlock,
// with the plan that granted it and when that access ends. Geiger never hosts
// the video; the organiser's external link is embedded client-side, same as the
// public /r/<id> replay page.

function Player({ url, itemId }) {
  // Watching a replay is presence too — it feeds the organiser's measured viewer
  // and watch-time numbers, the same way an open live room does.
  usePresenceHeartbeat(itemId);
  const embed = toEmbed(url);
  if (embed.type === "none") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle text-text-secondary">
        <VideoOff className="h-8 w-8" />
        <p className="text-sm">This recording has no video yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      {embed.type === "iframe" ? (
        <iframe
          src={embed.src}
          title="Recording"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={embed.src} controls className="aspect-video w-full bg-black" />
      )}
    </div>
  );
}

function accessLabel(item) {
  return item.expiresAt ? `Access until ${fmtDate(item.expiresAt)}` : "Permanent access";
}

function WatchCard({ item, onOpen }) {
  const meta = [item.session, item.speaker && `with ${item.speaker}`, item.eventName]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-card text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-subtle">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-strong to-surface-card">
            <PlayCircle className="h-8 w-8 text-text-tertiary" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <PlayCircle className="h-10 w-10 text-white" />
        </span>
        {item.duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {item.duration}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 p-3.5">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        {meta ? <p className="truncate text-xs text-text-secondary">{meta}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-text-tertiary">
          {item.planName ? (
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="h-3 w-3" /> {item.planName}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {accessLabel(item)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function PortalWatch({ items = [], loading = false }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.name} ${i.session} ${i.speaker} ${i.eventName}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Watch"
        description="Recordings and replays your memberships unlock — watch any time until your access ends."
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your library…
        </div>
      ) : items.length ? (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search recordings, sessions, speakers…"
          />
          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <WatchCard key={item.id} item={item} onOpen={setOpen} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No matches"
              description="Try a different search."
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={PlayCircle}
          title="Nothing to watch yet"
          description="When a membership you hold includes recordings, they'll show up here."
        />
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle className="pr-6">{open?.name}</DialogTitle>
            <DialogDescription>
              {[open?.session, open?.speaker && `with ${open.speaker}`, open && accessLabel(open)]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>
          {open ? <Player url={open.videoUrl} itemId={open.id} /> : null}
          {open?.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {open.description}
            </p>
          ) : null}
          {open?.tags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {open.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default PortalWatch;
