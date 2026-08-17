"use client";

// The public page's gallery: the original grid strip, plus a scroll-snap
// carousel with the settings organizers pick beside the images in Content &
// media. Entries are images or YouTube links; a video shows its poster frame
// with a play badge and plays embedded in the lightbox. Both layouts open a
// full-size lightbox on click.
//
// No carousel library — @geiger/ui has none and this needs to run inside the
// builder's preview iframe, so it's CSS scroll-snap driven by scrollTo(). The
// browser owns the momentum, touch swipe and reduced-motion behaviour; this
// component only decides which slide to land on.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";

import { galleryItem, fitClass } from "@/lib/events/gallery";
import { cn } from "@/lib/utils";

// Slides across, stepped down for narrow viewports so a 4-up carousel never
// renders four stamp-sized photos on a phone.
function columnsFor(width, slidesPerView) {
  if (width < 640) return 1;
  if (width < 1024) return Math.min(2, slidesPerView);
  return slidesPerView;
}

function useColumns(slidesPerView) {
  // Starts at the configured value so the server render and the first client
  // render agree; the effect corrects it before paint.
  const [cols, setCols] = useState(slidesPerView);
  useEffect(() => {
    const read = () => setCols(columnsFor(window.innerWidth, slidesPerView));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [slidesPerView]);
  return Math.max(1, Math.min(cols, slidesPerView));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return reduced;
}

// --- Lightbox ----------------------------------------------------------------

function Lightbox({ items, index, onIndex, onClose }) {
  const count = items.length;
  const item = items[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % count);
      if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while the overlay owns the viewport.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, count, onIndex, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Item ${index + 1} of ${count}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {count > 1 ? (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onIndex((index - 1 + count) % count);
          }}
          className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {item.kind === "video" && item.format === "youtube" ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black"
        >
          <iframe
            key={item.embedUrl}
            src={item.embedUrl}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      ) : item.kind === "video" ? (
        <video
          key={item.url}
          src={item.url}
          controls
          autoPlay={item.autoplay}
          muted={item.muted}
          loop={item.loop}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg bg-black"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      )}
      {count > 1 ? (
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onIndex((index + 1) % count);
          }}
          className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

// --- Tile --------------------------------------------------------------------

// One entry in either layout. A YouTube video shows its poster frame under a
// play badge; a direct video file has no fetchable poster, so its own first
// frame stands in instead. Either way the real embed/playback only loads once
// the lightbox opens, so a gallery of videos costs nothing until played.
function MediaTile({ item, index, total, onOpen, className, style }) {
  const isVideo = item.kind === "video";
  const fitClasses = cn(
    "aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03]",
    fitClass(item.fit),
  );
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={
        isVideo
          ? `Play video ${index + 1} of ${total}`
          : `Open image ${index + 1} of ${total}`
      }
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface-card",
        className,
      )}
    >
      {item.kind === "video" && item.format === "file" ? (
        <video
          src={item.url}
          muted
          preload="metadata"
          className={cn(fitClasses, "bg-black")}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" className={fitClasses} />
      )}
      {isVideo ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </span>
      ) : null}
    </button>
  );
}

// --- Carousel ----------------------------------------------------------------

function Carousel({ items, settings, onOpen }) {
  const { slidesPerView, autoplay, autoplaySeconds, loop, arrows, dots } = settings;
  const cols = useColumns(slidesPerView);
  const reducedMotion = usePrefersReducedMotion();
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Scroll positions, not images: with 3 across and 6 images there are 4 places
  // to stop, so the track never scrolls into empty space at the end.
  const maxIndex = Math.max(0, items.length - cols);

  const scrollTo = useCallback(
    (next) => {
      const track = trackRef.current;
      const slide = track?.children?.[next];
      if (!track || !slide) return;
      setIndex(next);
      track.scrollTo({
        left: slide.offsetLeft - track.offsetLeft,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  const go = useCallback(
    (dir) => {
      const next = index + dir;
      if (next > maxIndex) return scrollTo(loop ? 0 : maxIndex);
      if (next < 0) return scrollTo(loop ? maxIndex : 0);
      return scrollTo(next);
    },
    [index, maxIndex, loop, scrollTo],
  );

  // A swipe or trackpad scroll moves the track without going through go(), so
  // read the landed slide back out and keep the dots honest.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const slides = Array.from(track.children);
        let nearest = 0;
        let best = Infinity;
        slides.forEach((slide, i) => {
          const d = Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft);
          if (d < best) {
            best = d;
            nearest = i;
          }
        });
        setIndex(Math.min(nearest, maxIndex));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [maxIndex]);

  // A resize can leave the index past the new last stop.
  useEffect(() => {
    if (index > maxIndex) scrollTo(maxIndex);
  }, [index, maxIndex, scrollTo]);

  // Autoplay. Off for anyone who asked their system for reduced motion, and
  // paused while a visitor is hovering, focused inside, or on another tab.
  useEffect(() => {
    if (!autoplay || reducedMotion || paused || maxIndex === 0) return undefined;
    const id = setInterval(
      () => go(1),
      Math.max(1, autoplaySeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [autoplay, reducedMotion, paused, maxIndex, autoplaySeconds, go]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const atStart = index <= 0;
  const atEnd = index >= maxIndex;
  const showArrows = arrows && maxIndex > 0;
  const showDots = dots && maxIndex > 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        // `snap-x` + per-slide `snap-start` keeps a dragged track landing on a
        // slide edge; the scrollbar is hidden because the dots and arrows are
        // the affordance. No `scroll-smooth` class — scrollTo() passes the
        // behaviour explicitly, and the CSS property would smooth the jumps we
        // deliberately make instant for reduced-motion visitors.
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <MediaTile
            key={`${item.url}-${i}`}
            item={item}
            index={i}
            total={items.length}
            onOpen={onOpen}
            className="shrink-0 snap-start"
            style={{ width: `calc((100% - ${(cols - 1) * 0.75}rem) / ${cols})` }}
          />
        ))}
      </div>

      {showArrows ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!loop && atStart}
            aria-label="Previous images"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-card/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-surface-active disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={!loop && atEnd}
            aria-label="Next images"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-card/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-surface-active disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      {showDots ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-border hover:bg-border-strong",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// --- Entry point -------------------------------------------------------------

// `items` are the raw gallery strings off the event — image URLs and YouTube
// links, classified here so every layout below reads one shape.
export function PhotoGallery({ items, settings }) {
  const [lightbox, setLightbox] = useState(null);
  const media = useMemo(
    () => (Array.isArray(items) ? items : []).map(galleryItem),
    [items],
  );
  if (!media.length) return null;

  return (
    <>
      {settings.layout === "carousel" ? (
        <Carousel items={media} settings={settings} onOpen={setLightbox} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item, i) => (
            <MediaTile
              key={`${item.url}-${i}`}
              item={item}
              index={i}
              total={media.length}
              onOpen={setLightbox}
            />
          ))}
        </div>
      )}
      {lightbox !== null ? (
        <Lightbox
          items={media}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  );
}

export default PhotoGallery;
