"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { ExpandableSearch } from "@geiger/ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Shared building blocks for internal feature screens. They reproduce the
 * visual language established in the Events Overview screen (dark surfaces,
 * #1a1a1a cards on #161616, #2a2a2a borders, muted #a3a3a3 / #737373 text) so
 * every screen in the workspace feels like one product.
 */

// --- Page header -------------------------------------------------------------

// Heading + description styling follows the Geiger suite convention (see
// Geiger Flow): a plain title and description over a bottom divider, no icon
// chip or badge. Extra props (e.g. icon/badge) are intentionally ignored.
export function ScreenHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// --- Editor section header ---------------------------------------------------

// Header for an in-editor section that opts out of the event editor's default
// title block (`ownHeader: true`). Title + description on the left, the
// section's primary action(s) pinned to the far right of the title row — the
// rhythm used by Ticket Types, Location & Time and Map & Directions.
export function EditorSectionHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold capitalize text-white">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

// --- KPI tiles ---------------------------------------------------------------

export function StatGrid({ stats, columns = 4, className }) {
  const colClass =
    {
      2: "sm:grid-cols-2",
      3: "sm:grid-cols-3",
      4: "grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-2 lg:grid-cols-5",
    }[columns] || "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-4", colClass, className)}>
      {stats.map((stat) => (
        <StatTile key={stat.label} {...stat} />
      ))}
    </div>
  );
}

export function StatTile({ label, value, delta, trend, hint, icon: Icon }) {
  const trendClass =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-red-400"
        : "text-text-secondary";

  return (
    <Card className="rounded-xl border-border bg-surface-subtle py-0 text-foreground capitalize">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            {label}
          </span>
          {Icon ? <Icon className="h-4 w-4 text-text-tertiary" /> : null}
        </div>
        <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:gap-2">
          <span className="text-2xl font-bold leading-none text-white tabular-nums">
            {value}
          </span>
          {delta ? (
            <span className={cn("text-xs font-medium sm:mb-0.5", trendClass)}>
              {delta}
            </span>
          ) : null}
        </div>
        {hint ? (
          <span className="mt-1.5 block text-[11px] text-text-tertiary">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Rolling odometer number -------------------------------------------------

const ROLL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// A single odometer digit: a vertical 0–9 strip that slides to the target.
// Starts at 0 and rolls up once `active` flips true (on mount).
function RollingDigit({ digit, active, delay }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-baseline">
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[900ms] ease-out"
        style={{
          transform: `translateY(-${(active ? digit : 0) * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {ROLL_DIGITS.map((n) => (
          <span key={n} className="flex h-[1em] items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

// Renders a formatted value (e.g. "$24,860") with each digit animated as a
// rolling odometer; prefixes/separators like "$" and "," stay static.
export function RollingNumber({ value, className }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const chars = String(value).split("");
  let digitIndex = 0;

  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      {chars.map((char, i) => {
        if (/\d/.test(char)) {
          const delay = digitIndex * 70;
          digitIndex += 1;
          return (
            <RollingDigit key={i} digit={Number(char)} active={active} delay={delay} />
          );
        }
        return <span key={i}>{char}</span>;
      })}
    </span>
  );
}

// --- Stats bar (unified KPI row) ---------------------------------------------

const STATS_BAR_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function StatsBar({ stats, columns = 4, className }) {
  const cols = STATS_BAR_COLS[columns] || STATS_BAR_COLS[4];

  return (
    <Card
      className={cn(  
        "gap-0 overflow-hidden rounded-xl border-border bg-surface-subtle py-0 text-foreground",
        className,
      )}
    >
      <CardContent className="p-0">
        <div className={cn("grid", cols)}>
          {stats.map((stat, i) => {
            const up = stat.trend === "up";
            const TrendIcon = up ? ArrowUpRight : ArrowDownRight;
            return (
              <div
                key={stat.label}
                className={cn(
                  "p-4",
                  i % 2 !== 0 && "border-l border-border",
                  i >= 2 && "border-t border-border",
                  "md:border-t-0 md:border-l md:border-border",
                  i === 0 && "md:border-l-0",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  {stat.label}
                </span>
                <div className="mt-1 flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:gap-2">
                  <RollingNumber
                    value={stat.value}
                    className="text-2xl font-bold leading-none text-white"
                  />
                  {stat.delta ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium sm:mb-0.5",
                        up ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {stat.delta}
                    </span>
                  ) : null}
                </div>
                {stat.footer ? (
                  <span className="mt-1 block text-[11px] text-text-tertiary capitalize">
                    {stat.footer}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Section card ------------------------------------------------------------

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  bodyPadding = true,
  bare = false,
}) {
  // Box-less variant: title + description over a divider, no border/background.
  if (bare) {
    return (
      <section className={cn("text-foreground", className)}>
        {title || action ? (
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="min-w-0">
              {title ? (
                <h3 className="text-base font-semibold capitalize text-foreground">
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
        <div className={cn(bodyPadding ? "pt-4" : "", contentClassName)}>
          {children}
        </div>
      </section>
    );
  }
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-xl border-border bg-surface-subtle py-0 text-foreground",
        className,
      )}
    >
      {title || action ? (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-base font-semibold capitalize text-foreground">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <CardContent className={cn(bodyPadding ? "p-5" : "p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

// --- Toolbar (search + filters + actions) ------------------------------------

// Toolbar search — the suite's collapsible search: a bare icon that expands into
// a field on click, so the toolbar row keeps its space until the user searches.
// `expanded` pins it open for screens where the search box *is* the primary
// input (a discovery form), where hiding it behind an icon would be wrong.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  expanded = false,
  className,
  "aria-label": ariaLabel,
}) {
  return (
    <ExpandableSearch
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      label={ariaLabel || placeholder}
      open={expanded ? true : undefined}
      autoFocus={!expanded}
      expandedWidth={expanded ? "100%" : "16rem"}
      // Collapsed, it always hangs off the trailing edge of its row — including
      // the stacked mobile toolbar, where there is no justify-between to do it.
      className={cn(expanded ? "w-full" : "ml-auto", className)}
      // Suppress the browser's native search clear icon; the component ships
      // its own.
      inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
    />
  );
}

export function Toolbar({ children, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

// --- Status pill -------------------------------------------------------------

export function StatusPill({ status, map, className }) {
  const meta = map?.[status];
  return (
    <Badge variant={meta?.variant || "neutral"} className={className}>
      {meta?.dot !== false ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            meta?.dotClass || "bg-current",
          )}
        />
      ) : null}
      {meta?.label || status}
    </Badge>
  );
}

// --- Empty state -------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col h-full items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground capitalize">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-secondary capitalize">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

// --- Data table --------------------------------------------------------------

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Generic table for list screens.
 * columns: [{ key, header, align, className, headClassName, render(row) }]
 */
export function DataTable({
  columns,
  data,
  getRowKey,
  onRowClick,
  empty,
  className,
}) {
  if (!data?.length && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-subtle",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn("px-4", ALIGN_CLASS[col.align], col.headClassName)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={getRowKey ? getRowKey(row, i) : i}
              className={cn(
                "border-border",
                onRowClick && "cursor-pointer",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("px-4 py-4", ALIGN_CLASS[col.align], col.className)}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- Settings rows -----------------------------------------------------------

export function SettingsList({ children, className }) {
  return (
    <div className={cn("divide-y divide-border", className)}>{children}</div>
  );
}

/**
 * A labelled settings row. Pass `control` for a custom control (select, button,
 * etc.) or `checked`/`onCheckedChange` to render a Switch automatically.
 */
export function SettingRow({
  title,
  description,
  icon: Icon,
  control,
  checked,
  onCheckedChange,
  className,
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs text-text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        {control !== undefined ? (
          control
        ) : (
          <Switch checked={checked} onCheckedChange={onCheckedChange} />
        )}
      </div>
    </div>
  );
}

// --- Form field helpers (for dialogs) ----------------------------------------

// The outline variant sits on `bg-background`, which reads as empty next to a
// `bg-surface-card` input — give the steppers their own resting surface and ma
// stronger border so they're legible at rest, not only on hover.
const STEPPER_BUTTON =
  "border-border-strong bg-surface-card text-foreground hover:bg-surface-active";

// A numeric field can opt into −/+ stepper buttons pinned to the right of its
// control: pass `stepper` with `value`/`onValueChange` (plus optional
// step/min/max). The value is handed back as a string so it drops straight into
// a controlled <Input type="number" />.
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
  stepper = false,
  value,
  onValueChange,
  step = 1,
  min,
  max,
}) {
  const current = Number(value) || 0;
  const atMin = min !== undefined && current <= Number(min);
  const atMax = max !== undefined && current >= Number(max);

  const shift = (dir) => {
    let next = current + dir * (Number(step) || 1);
    if (min !== undefined) next = Math.max(Number(min), next);
    if (max !== undefined) next = Math.min(Number(max), next);
    // Keep float noise (0.1 + 0.2) out of the value.
    next = Math.round(next * 1e6) / 1e6;
    onValueChange?.(String(next));
  };

  return (
    <div className={cn("space-y-1.5 flex flex-col gap-0.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-muted-foreground"
        >
          {label}
        </label>
      ) : null}
      {stepper ? (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">{children}</div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={STEPPER_BUTTON}
            aria-label={`Decrease ${label || "value"}`}
            disabled={atMin}
            onClick={() => shift(-1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={STEPPER_BUTTON}
            aria-label={`Increase ${label || "value"}`}
            disabled={atMax}
            onClick={() => shift(1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        children
      )}
      {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

// Inline-editable title that sizes to its text. A hidden mirror span sets the
// track width (the `size` attribute measures in default-font characters, which
// leaves a huge gap before any trailing badge at heading sizes).
export function InlineTitleInput({
  value,
  onChange,
  className,
  placeholder = "Untitled",
  ...props
}) {
  return (
    <span className="inline-grid max-w-full">
      <span
        aria-hidden="true"
        className={cn(
          "invisible col-start-1 row-start-1 overflow-hidden whitespace-pre pr-[2px]",
          className,
        )}
      >
        {value || placeholder}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          "col-start-1 row-start-1 w-full min-w-0 rounded-sm bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
        {...props}
      />
    </span>
  );
}
