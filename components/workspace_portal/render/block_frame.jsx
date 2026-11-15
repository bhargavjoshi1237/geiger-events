"use client";

import { Component } from "react";
import { AlertCircle, Lock, RefreshCcw } from "lucide-react";
import { Button, LogoLoading } from "@geiger/ui";
import { cn } from "@/lib/utils";

// The card every data block sits in: an optional title row with actions, then the body. On a canvas it fills its cell.
export function BlockFrame({ title, actions, children, fill = false, bodyClassName, className }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-surface-card", fill && "@4xl/page:h-full", className)}>
      {title || actions ? (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
          {title ? <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2> : <span />}
          {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 min-w-0 flex-1", fill && "@4xl/page:overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

export function BlockLoading({ label = "Loading" }) {
  return <div className="flex justify-center py-10"><LogoLoading size={40} aria-label={label} /></div>;
}

export function BlockMessage({ icon: Icon = AlertCircle, title, text, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon className="h-5 w-5 text-text-tertiary" />
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      {text ? <p className="max-w-sm text-sm text-text-secondary">{text}</p> : null}
      {onRetry ? <Button size="sm" variant="outline" className="mt-1" onClick={onRetry}><RefreshCcw className="h-3.5 w-3.5" />Try again</Button> : null}
    </div>
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
        <section className="rounded-xl border border-border bg-surface-card">
          <BlockMessage title="This section couldn't be shown" text="Reload the page to try again." />
        </section>
      );
    }
    return this.props.children;
  }
}
