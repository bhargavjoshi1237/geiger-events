"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Maximize, MonitorX } from "lucide-react";

import { getPublicBoard } from "@/lib/supabase/display_boards";
import { BOARD_H, BOARD_W } from "@/lib/display/constants";
import { BoardPlayer, preloadImages } from "@/lib/display/renderer";

// The live board at /display/<boardId> — the URL an organiser points a lobby
// screen, a door display, or a billboard's browser at.
//
// It runs the same BoardPlayer the builder previews and the export records, so
// the wall and the downloaded video can never disagree. The page reads through
// the anon client (scoped public-read RLS, see
// 20260812060147_display_boards_public.sql), so the screen never needs to sign
// in, and re-polls every 30s so a re-published board updates in place — a
// display left running for three days should never need a human to reload it.

const POLL_MS = 30_000;

export default function PublicDisplayBoardPage() {
  const params = useParams();
  const boardId = Array.isArray(params?.boardId) ? params.boardId[0] : params?.boardId;

  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const [state, setState] = useState({ status: "loading", data: null });
  const [chromeVisible, setChromeVisible] = useState(false);

  // Load once, then poll. The player is updated in place rather than rebuilt so
  // a refresh never interrupts the rotation mid-slide.
  useEffect(() => {
    if (!boardId) return undefined;
    let alive = true;

    const load = async () => {
      const data = await getPublicBoard(boardId);
      if (!alive) return;
      if (!data) {
        setState({ status: "unavailable", data: null });
        return;
      }
      const slides = data.board.config?.slides || [];
      const images = await preloadImages(slides, data.event);
      if (!alive) return;
      setState({ status: "ready", data: { ...data, images } });
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [boardId]);

  // Start the player once the canvas and the first payload are both present.
  useEffect(() => {
    if (state.status !== "ready" || !canvasRef.current) return undefined;
    const { board, event, sessions, images } = state.data;
    const config = board.config || {};

    if (playerRef.current) {
      playerRef.current.update({
        slides: config.slides || [],
        sessions,
        event,
        theme: config.theme,
        speed: Number(config.speed) || 1,
        images,
      });
      return undefined;
    }

    const player = new BoardPlayer(canvasRef.current, {
      slides: config.slides || [],
      event,
      sessions,
      theme: config.theme,
      speed: Number(config.speed) || 1,
      images,
    });
    playerRef.current = player;
    player.start();
    return undefined;
  }, [state]);

  // Stop the loop when the page goes away.
  useEffect(
    () => () => {
      playerRef.current?.stop();
      playerRef.current = null;
    },
    [],
  );

  // A display is a screen nobody touches, so the only chrome is a fullscreen
  // button that fades in on mouse movement and back out after a few seconds.
  useEffect(() => {
    let timer = null;
    const wake = () => {
      setChromeVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setChromeVisible(false), 2500);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const goFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-black text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading board…
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
          <MonitorX className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-zinc-100">Board unavailable</h1>
          <p className="max-w-sm text-sm text-zinc-400">
            This board isn&apos;t published, or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        className="max-h-[100dvh] w-full max-w-[calc(100dvh*16/9)] object-contain"
      />
      <button
        type="button"
        onClick={goFullscreen}
        aria-label="Go fullscreen"
        className={`fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur transition-opacity hover:text-white ${
          chromeVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
}
