"use client";

import { useEffect } from "react";
import { ArrowLeft, Eye } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { defaultPageDesign } from "../page_design";
import { EventPublicPageContent } from "./page_content";

export function EventPublicPage({ event, onClose, design }) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.history.pushState({ geigerPreview: true }, "");
    const onPop = () => onClose?.();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  if (!event) return null;

  const mode = (design || defaultPageDesign()).mode;

  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history.state &&
      window.history.state.geigerPreview
    ) {
      window.history.back();
    } else {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> Public page preview
          {mode !== "standard" ? (
            <span className="capitalize text-text-tertiary">· {mode}</span>
          ) : null}
        </span>
      </div>
      <EventPublicPageContent event={event} design={design} />
    </div>
  );
}
