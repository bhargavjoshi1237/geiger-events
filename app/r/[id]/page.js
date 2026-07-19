"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Mic,
  PlayCircle,
  Share2,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { conferenceApi } from "@/lib/supabase/conference";
import { toEmbed } from "@/lib/video-embed";

// Public replay page at /r/<id>. Renders an organiser's external recording link
// to anyone with the URL — Geiger never hosts the video, it just fetches the row
// (a scoped anon RLS read that only exposes recordings with config.public = true;
// see zzz_conference_recordings_public.sql) and embeds the link client-side.

function Player({ url }) {
  const embed = toEmbed(url);
  if (embed.type === "none") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-subtle text-text-secondary">
        <VideoOff className="h-8 w-8" />
        <p className="text-sm">This recording has no video yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      {embed.type === "iframe" ? (
        <iframe
          src={embed.src}
          title="Recording"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={embed.src} controls autoPlay={false} className="aspect-video w-full bg-black" />
      )}
    </div>
  );
}

export default function PublicRecordingPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    conferenceApi.get(id).then((row) => {
      if (!alive) return;
      // Only surface recordings explicitly shared as public.
      setRecording(row && row.module === "recording" && row.config?.public ? row : null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const share = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: recording?.name, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("Link copied to clipboard."),
        () => toast.error("Couldn't copy the link."),
      );
    }
  };

  if (!recording) {
    if (loading) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading recording…
        </div>
      );
    }
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
          <VideoOff className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Recording unavailable</h1>
          <p className="max-w-sm text-sm text-text-secondary">
            This replay isn&apos;t shared publicly, or the link is incorrect.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Link href="/home">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const cfg = recording.config || {};
  const meta = [cfg.session, cfg.speaker && `with ${cfg.speaker}`, cfg.recordedAt]
    .filter(Boolean)
    .join(" · ");
  const tags = Array.isArray(cfg.tags) ? cfg.tags : [];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`}
              alt="Logo"
              width={20}
              height={20}
            />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            Geiger Studios
          </span>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={share}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
          <PlayCircle className="h-4 w-4" /> On-demand replay
        </div>

        <Player url={cfg.videoUrl} />

        <div className="mt-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {recording.name}
            </h1>
            {meta ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                {cfg.session ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mic className="h-4 w-4" /> {cfg.session}
                  </span>
                ) : null}
                {cfg.speaker ? <span>with {cfg.speaker}</span> : null}
                {cfg.duration ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {cfg.duration}
                  </span>
                ) : null}
                {cfg.recordedAt ? <span>{cfg.recordedAt}</span> : null}
              </div>
            ) : null}
          </div>

          {cfg.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {cfg.description}
            </p>
          ) : null}

          {tags.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
