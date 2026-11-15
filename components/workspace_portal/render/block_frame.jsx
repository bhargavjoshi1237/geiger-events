"use client";

import { Component } from "react";
import { AlertCircle, Lock, RefreshCcw } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, LoadingArea } from "@geiger/ui";
import { cn } from "@/lib/utils";

// The card every data block sits in: an optional title row (with a quiet note and actions), then the body. On a canvas it fills its cell.
export function BlockFrame({ title, note, actions, children, fill = false, bodyClassName, className }) {
  return (
    <Card className={cn("min-w-0 gap-0 overflow-hidden rounded-2xl border-border bg-surface-subtle py-0 shadow-none", fill && "@4xl/page:h-full", className)}>
      {title || actions ? (
        <CardHeader className="flex min-h-[54px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-2.5 pl-5 pr-3 [.border-b]:pb-2.5">
          {title ? (
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <CardTitle className="min-w-0 truncate text-[14.5px] leading-normal text-foreground">{title}</CardTitle>
              {note ? <CardDescription className="text-xs text-text-secondary">{note}</CardDescription> : null}
            </span>
          ) : <span />}
          {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("min-h-0 min-w-0 flex-1 px-0", fill && "@4xl/page:overflow-auto", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function BlockLoading({ label = "Loading" }) {
  return <LoadingArea size={40} label={label} className="py-10" />;
}

export function BlockMessage({ icon = AlertCircle, title, text, onRetry }) {
  return (
    <EmptyState className="py-10" icon={icon} title={title} description={text}
      action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}><RefreshCcw className="h-3.5 w-3.5" />Try again</Button> : null} />
  );
}

export function BlockError({ error, onRetry }) {
  if (error?.code === "forbidden" || error?.code === "not_found") {
    return <BlockMessage icon={Lock} title="Not available" text={error.message} />;
  }
  return <BlockMessage title="This didn't load" text={error?.message ?? "Something went wrong."} onRetry={onRetry} />;
}

export function Restricted() {
  return <BlockMessage icon={Lock} title="Not available to you" text="You don't have access to what this section shows." />;
}

export function EmptyRows({ text }) {
  return <p className="px-4 py-10 text-center text-sm text-text-secondary">{text || "Nothing here yet."}</p>;
}

// Keeps one broken block from taking the whole page down.
export class BlockBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[workspace portal] block failed", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Card className="gap-0 rounded-2xl bg-surface-subtle py-0 shadow-none">
          <BlockMessage title="This section couldn't be shown" text="Reload the page to try again." />
        </Card>
      );
    }
    return this.props.children;
  }
}
