"use client";

import { ArrowUpRight, ImageIcon } from "lucide-react";
import { Button, Card } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { fillVariables, usePortalView } from "./portal_context";

// Typography for builder-written HTML (the app has no prose plugin).
export const RICH_TEXT = cn(
  "text-sm leading-relaxed text-foreground [&>*+*]:mt-3",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:text-base [&_h3]:font-semibold [&_p]:text-text-secondary [&_li]:text-text-secondary [&_strong]:text-foreground",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_hr]:border-border",
);

// Builder-written text (cleaned on save) with {{event.name}} and {{person.name}} filled in.
export function TextBlock({ block, fill }) {
  const { session } = usePortalView();
  const html = fillVariables(block.config.html, { event: session?.event, person: session?.person ?? (session?.member ? { name: session.member.name } : null) });
  const text = <div className={cn(RICH_TEXT, block.config.align === "center" && "text-center", block.config.card && "[&_h3]:text-[14.5px] [&_p]:text-[13.5px]")} dangerouslySetInnerHTML={{ __html: html }} />;
  if (!block.config.card) return text;
  return <Card className={cn("gap-0 rounded-2xl bg-surface-subtle px-5 py-[18px] shadow-none", fill && "@4xl/page:h-full")}>{text}</Card>;
}

export function ImageBlock({ block, fill }) {
  const { url, alt, fit, height, link } = block.config;
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-dashed border-border text-text-tertiary", fill && "@4xl/page:h-full")} style={{ minHeight: Math.min(height ?? 240, 160) }}>
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  }
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- organiser-provided https image
    <img src={url} alt={alt ?? ""} loading="lazy" className={cn("w-full rounded-xl", fit === "contain" ? "object-contain" : "object-cover", fill && "@4xl/page:!h-full")}
      style={{ height }} />
  );
  return link ? <a href={link} target="_blank" rel="noopener noreferrer" className="block">{image}</a> : image;
}

export function ButtonsBlock({ block }) {
  const { api } = usePortalView();
  const { items = [], align } = block.config;
  return (
    <div className={cn("flex flex-wrap gap-2", align === "center" && "justify-center")}>
      {items.map((item, index) => {
        const variant = item.style === "outline" ? "outline" : "default";
        if (item.kind === "url") {
          return (
            <Button key={index} variant={variant} className="h-10 rounded-lg px-4" asChild>
              <a href={item.target || "#"} target={item.target?.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
                {item.label}{item.target?.startsWith("mailto:") ? null : <ArrowUpRight className="h-4 w-4" />}
              </a>
            </Button>
          );
        }
        return <Button key={index} variant={variant} className="h-10 rounded-lg px-4" onClick={() => item.target && api.navigate?.(item.target)}>{item.label}</Button>;
      })}
    </div>
  );
}

const SPACE = { sm: "py-2", md: "py-4", lg: "py-8" };

export function DividerBlock({ block }) {
  return <div className={SPACE[block.config.size] ?? SPACE.md}>{block.config.line ? <hr className="border-border" /> : null}</div>;
}
