"use client";

import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, Loader2 } from "lucide-react";

// Live camera QR scanner. Streams the rear camera into a hidden canvas and runs
// jsQR on sampled frames; calls onDecode(text) once per distinct code (debounced
// ~1.5s). Purely a reader — the parent decides what a decoded value means.
// `paused` freezes decoding (e.g. while a result dialog is open) without tearing
// the camera down.
export function QrScanner({ onDecode, paused = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const lastRef = useRef({ text: "", at: 0 });
  const pausedRef = useRef(paused);
  const onDecodeRef = useRef(onDecode);
  const [status, setStatus] = useState("starting"); // starting | live | denied | error | unsupported

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    let alive = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const scan = () => {
      rafRef.current = requestAnimationFrame(scan);
      if (pausedRef.current || !video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const now = Date.now();
      // Throttle decode work to ~5fps; jsQR on every frame is wasteful.
      if (now - (scan._t || 0) < 200) return;
      scan._t = now;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const result = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
      if (result?.data) {
        const text = result.data.trim();
        const { text: prev, at } = lastRef.current;
        if (text && (text !== prev || now - at > 1500)) {
          lastRef.current = { text, at: now };
          onDecodeRef.current?.(text);
        }
      }
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setStatus("live");
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        if (!alive) return;
        setStatus(e?.name === "NotAllowedError" ? "denied" : "error");
      }
    };

    start();
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {status === "live" ? (
        <>
          {/* Reticle */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 max-w-[70%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {paused ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              Paused
            </div>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
          {status === "starting" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </>
          ) : (
            <>
              <CameraOff className="h-7 w-7" />
              <p className="text-sm">
                {status === "denied"
                  ? "Camera permission denied. Allow it, or use manual entry below."
                  : status === "unsupported"
                    ? "This device can't open the camera. Use manual entry below."
                    : "Couldn't start the camera. Use manual entry below."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default QrScanner;
