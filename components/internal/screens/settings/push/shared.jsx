"use client";

import { CircleAlert, CirclePause, RefreshCw } from "lucide-react";

import { EmptyState, SettingRow } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import { cn } from "@/lib/utils";

// The failed-to-load state, with the server's own reason when it gave one.
export function LoadError({ title, error, onRetry }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle">
      <EmptyState
        icon={CircleAlert}
        title={title}
        description={error?.message || "Check your connection and try again."}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        }
      />
    </div>
  );
}

const TONES = {
  danger: { box: "border-red-500/25 bg-red-500/10", icon: "text-red-600 dark:text-red-400" },
  warning: { box: "border-amber-500/25 bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400" },
};

// A status banner in the Payments style: icon, one-line title, short note.
export function Banner({ tone = "warning", icon: Icon = CircleAlert, title, children, action }) {
  const t = TONES[tone] || TONES.warning;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", t.box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children ? <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{children}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PausedBanner({ children, action }) {
  return (
    <Banner tone="danger" icon={CirclePause} title="Push is paused for this project" action={action}>
      {children}
    </Banner>
  );
}

// The per-project pause, shared by the Push and Scheduler tabs; it turns red while on.
export function PauseSwitch({ paused, disabled, onChange }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5 transition-colors",
        paused ? "border-red-500/25 bg-red-500/10" : "border-border bg-surface-subtle",
      )}
    >
      <SettingRow
        icon={CirclePause}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Pause push for this project
            {paused ? <Badge variant="danger">Paused</Badge> : null}
          </span>
        }
        description={
          paused
            ? "Nothing goes to members' phones. Pushes that come due now are skipped, not held; you can retry them from Delivery."
            : "Stops every push from this project straight away, for example while you fix a mistake. Email isn't affected."
        }
        control={
          <Switch
            checked={paused}
            disabled={disabled}
            onCheckedChange={onChange}
            aria-label="Pause push for this project"
          />
        }
      />
    </div>
  );
}
