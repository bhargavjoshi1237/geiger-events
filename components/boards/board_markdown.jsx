"use client";

import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { parseMarkdown } from "@/lib/boards/markdown";

// Renders the safe markdown subset from lib/boards/markdown.js as React elements — never raw HTML.

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    if (n.t === "text") return <React.Fragment key={i}>{n.v}</React.Fragment>;
    if (n.t === "code") {
      return (
        <code key={i} className="rounded bg-surface-strong px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {n.v}
        </code>
      );
    }
    if (n.t === "strong") {
      return (
        <strong key={i} className="font-semibold text-foreground">
          <Inline nodes={n.c} />
        </strong>
      );
    }
    if (n.t === "em") {
      return (
        <em key={i}>
          <Inline nodes={n.c} />
        </em>
      );
    }
    if (n.t === "link") {
      return (
        <a
          key={i}
          href={n.href}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="break-words text-primary underline-offset-2 hover:underline"
        >
          <Inline nodes={n.c} />
        </a>
      );
    }
    return null;
  });
}

function Lines({ lines }) {
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 ? <br /> : null}
      <Inline nodes={line} />
    </React.Fragment>
  ));
}

const HEADING = {
  1: "text-base font-semibold",
  2: "text-[15px] font-semibold",
  3: "text-sm font-semibold",
};

export function BoardMarkdown({ text, className }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={cn("space-y-2 break-words text-sm leading-relaxed text-foreground", className)}>
      {blocks.map((b, i) => {
        if (b.t === "p") {
          return (
            <p key={i}>
              <Lines lines={b.lines} />
            </p>
          );
        }
        if (b.t === "h") {
          return (
            <p key={i} className={cn("text-foreground", HEADING[b.level])}>
              <Inline nodes={b.c} />
            </p>
          );
        }
        if (b.t === "quote") {
          return (
            <blockquote key={i} className="border-l-2 border-border-strong pl-3 text-text-secondary">
              <Lines lines={b.lines} />
            </blockquote>
          );
        }
        if (b.t === "ul" || b.t === "ol") {
          const List = b.t === "ul" ? "ul" : "ol";
          return (
            <List key={i} className={cn("space-y-0.5 pl-5", b.t === "ul" ? "list-disc" : "list-decimal")}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        if (b.t === "code") {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-surface-card p-3 font-mono text-xs text-foreground"
            >
              {b.v}
            </pre>
          );
        }
        return null;
      })}
    </div>
  );
}

export default BoardMarkdown;
