"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, MoreHorizontal } from "lucide-react";
import { Button, LucideIcon, Sheet, SheetContent, SheetHeader, SheetTitle } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { resolveLogo } from "@/lib/events/theme";
import { usePortalApp } from "./portal_app";
import { PersonMenu } from "./person_menu";

// Which nav entry the current address belongs to (the first page is home).
function activeSlug(app) {
  const rest = app.pathname?.startsWith(app.base) ? app.pathname.slice(app.base.length).replace(/^\/+/, "") : "";
  if (!rest) return app.session?.home ?? null;
  return rest.split("/")[0];
}

function BrandMark({ className }) {
  const { event, brand } = usePortalApp();
  const logo = brand ? resolveLogo(brand, "bar") : null;
  if (logo?.url) {
    // eslint-disable-next-line @next/next/no-img-element -- the event's own logo
    return <img src={logo.url} alt="" className={cn("h-8 w-auto max-w-[9rem] object-contain", className)} />;
  }
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground", className)}>
      {(event?.name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function NavLink({ item, active, onClick }) {
  const { href } = usePortalApp();
  return (
    <Link href={href(item.slug)} onClick={onClick} aria-current={active ? "page" : undefined}
      className={cn("flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active ? "bg-surface-active font-medium text-foreground" : "text-text-secondary hover:bg-surface-hover hover:text-foreground")}>
      <LucideIcon name={item.icon || "file"} className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function SignInButton({ className }) {
  const { href, pathname, base } = usePortalApp();
  const next = pathname?.startsWith(base) && !pathname.endsWith("/sign-in") ? `?next=${encodeURIComponent(pathname)}` : "";
  return (
    <Button asChild className={className}>
      <Link href={`${href("sign-in")}${next}`}><LogIn className="h-4 w-4" />Sign in</Link>
    </Button>
  );
}

// Desktop sidebar: the event, its pages and who is signed in.
export function PortalNav() {
  const app = usePortalApp();
  const nav = app.session?.nav ?? [];
  const current = activeSlug(app);
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-border bg-surface-subtle lg:flex">
      <Link href={app.href()} className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark />
        <span className="min-w-0 text-sm font-semibold leading-tight text-foreground">{app.event?.name}</span>
      </Link>
      <nav className="grid flex-1 content-start gap-0.5 overflow-y-auto px-2 py-2" aria-label="Pages">
        {nav.map((item) => <NavLink key={item.id} item={item} active={item.slug === current} />)}
      </nav>
      <div className="border-t border-border p-3">
        {app.session?.member ? <PersonMenu variant="sidebar" /> : <SignInButton className="w-full" />}
      </div>
    </aside>
  );
}

// Phone header: the event and the person menu.
export function PortalTopBar() {
  const app = usePortalApp();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
      <Link href={app.href()} className="flex min-w-0 flex-1 items-center gap-2.5">
        <BrandMark className="h-7 w-7" />
        <span className="truncate text-sm font-semibold text-foreground">{app.event?.name}</span>
      </Link>
      {app.session?.member ? <PersonMenu variant="compact" /> : <SignInButton className="h-8 px-3" />}
    </header>
  );
}

// Phone tab bar: the first four pages, then More for the rest.
export function PortalTabs() {
  const app = usePortalApp();
  const [more, setMore] = useState(false);
  const nav = app.session?.nav ?? [];
  const current = activeSlug(app);
  if (nav.length < 2) return null;
  const tabs = nav.length > 5 ? nav.slice(0, 4) : nav;
  const rest = nav.length > 5 ? nav.slice(4) : [];
  const restActive = rest.some((item) => item.slug === current);
  const tab = (active) => cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px]", active ? "font-medium text-foreground" : "text-text-secondary");
  return (
    <>
      <nav aria-label="Pages" className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((item) => (
          <Link key={item.id} href={app.href(item.slug)} className={tab(item.slug === current)} aria-current={item.slug === current ? "page" : undefined}>
            <LucideIcon name={item.icon || "file"} className="h-5 w-5" />
            <span className="max-w-full truncate">{item.title}</span>
          </Link>
        ))}
        {rest.length ? (
          <button type="button" className={tab(restActive)} onClick={() => setMore(true)}>
            <MoreHorizontal className="h-5 w-5" /><span>More</span>
          </button>
        ) : null}
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <SheetHeader className="px-2 pb-2 text-left"><SheetTitle className="text-sm">More pages</SheetTitle></SheetHeader>
          <div className="grid gap-0.5">
            {rest.map((item) => <NavLink key={item.id} item={item} active={item.slug === current} onClick={() => setMore(false)} />)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
