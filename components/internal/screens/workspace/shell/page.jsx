"use client";

import { useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { Toolbar } from "@geiger/ui";
import { cn } from "@/lib/utils";

const WIDE = "(min-width: 1024px)";
const subscribeWide = (listener) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

// True on screens wide enough to dock a side panel next to the content (lg and up).
export function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
}

// A full-height workspace screen: header bar, optional toolbar rows, then the body.
export function WorkspacePage({ children, className }) {
  return <div className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col", className)}>{children}</div>;
}

// The 56px header bar: "Workspace ›" breadcrumb, the screen's icon and name, a quiet note and the actions.
export function PageBar({ icon: Icon, title, note, badge, actions, crumb = "Workspace" }) {
  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-2.5 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {crumb ? (
          <>
            <span className="hidden shrink-0 text-[13px] text-text-secondary sm:inline">{crumb}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-text-tertiary sm:block" />
          </>
        ) : null}
        <h1 className="inline-flex min-w-0 shrink-0 items-center gap-2 text-[15px] font-semibold text-foreground">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          <span className="truncate">{title}</span>
        </h1>
        {badge}
        {note ? <span className="hidden min-w-0 truncate text-[13px] text-text-secondary md:inline">{note}</span> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// The row under the header: the suite Toolbar, so pass two lanes — tabs on the left, filters and search on the right.
export function PageToolbar({ children, className }) {
  return (
    <div className={cn("shrink-0 border-b border-border/70 px-4 py-2.5 sm:px-6", className)}>
      <Toolbar>{children}</Toolbar>
    </div>
  );
}

// The scrolling area under the bars. `padded` gives document-like screens their margins.
export function PageBody({ children, className, padded = false }) {
  return (
    <div className={cn("scrollbar-subtle min-h-0 flex-1 overflow-auto", padded && "px-4 py-5 sm:px-6", className)}>
      {children}
    </div>
  );
}

export const Spacer = () => <span className="flex-1" aria-hidden />;
