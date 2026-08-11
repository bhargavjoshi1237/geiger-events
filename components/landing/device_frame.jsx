import { cn } from "@/lib/utils";

// Device chrome for the landing previews. The frame is the point: it names the
// surface — a browser, a door tablet, a phone, a staff workstation — before the
// reader parses a single row, so a miniature reads as "a picture of that place"
// instead of another live panel competing with the copy beside it.
// Every variant is bottom-open (rounded top only, no bottom edge) so the screen
// runs off the card and reads as an artifact that continues below.

function Dots() {
  return (
    <div className="flex shrink-0 gap-[5px]">
      <span className="h-2 w-2 rounded-full bg-white/12" />
      <span className="h-2 w-2 rounded-full bg-white/12" />
      <span className="h-2 w-2 rounded-full bg-white/12" />
    </div>
  );
}

// Mac-style window: dots on the left, then either a URL pill (browser) or a
// plain centered title (app window).
function WindowFrame({ label, browser, className, children }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-t-xl border border-b-0 border-white/[0.08] bg-[#232323]",
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-3 px-3">
        <Dots />
        {label ? (
          browser ? (
            <span className="min-w-0 flex-1 truncate rounded-md bg-white/[0.05] px-2 py-1 text-center text-[10px] text-white/35">
              {label}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate pr-8 text-center text-[11px] text-white/35">
              {label}
            </span>
          )
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-white/[0.06]">
        {children}
      </div>
    </div>
  );
}

// Hardware bezels — a wall-mounted door tablet and an attendee's phone.
function BezelFrame({ tablet, className, children }) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col bg-[#0c0c0c] shadow-[0_-1px_0_0_rgba(255,255,255,0.06)_inset]",
        tablet ? "rounded-t-[20px] px-2.5 pt-5" : "rounded-t-[30px] px-2.5 pt-3",
        className,
      )}
    >
      {tablet ? (
        <span className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/15" />
      ) : (
        <span className="absolute left-1/2 top-1.5 h-1 w-11 -translate-x-1/2 rounded-full bg-white/12" />
      )}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden bg-[#151515]",
          tablet ? "rounded-t-[12px]" : "rounded-t-[22px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// variant: "browser" | "window" | "tablet" | "phone"
export default function DeviceFrame({ variant = "window", label, className, children }) {
  if (variant === "phone" || variant === "tablet") {
    return (
      <BezelFrame tablet={variant === "tablet"} className={className}>
        {children}
      </BezelFrame>
    );
  }

  return (
    <WindowFrame label={label} browser={variant === "browser"} className={className}>
      {children}
    </WindowFrame>
  );
}
