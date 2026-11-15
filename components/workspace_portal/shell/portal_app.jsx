"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LoadingScreen, SidebarInset, SidebarProvider } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { resolveTheme, themeChromeStyle, themeForMode } from "@/lib/events/theme";
import { portalApi } from "@/lib/workspace/portal/client";
import { PortalFooter, PortalNav, PortalTopBar } from "./portal_nav";
import { ClosedScreen, MissingScreen } from "./screens";

const PortalAppContext = createContext(null);
export const usePortalApp = () => useContext(PortalAppContext);

// The event-branded portal: who is signed in, the pages they can open, navigation and the brand theme around every page.
export function PortalApp({ eventId, event, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const api = useMemo(() => portalApi(eventId), [eventId]);
  const [state, setState] = useState({ status: "loading", session: null, error: null });
  const { resolvedTheme, setTheme } = useTheme();
  const mode = resolvedTheme === "light" ? "light" : "dark";

  const base = `/e/${eventId}/workspace`;
  const href = useCallback((path = "") => `${base}${path ? `/${String(path).replace(/^\/+/, "")}` : ""}`, [base]);
  const navigate = useCallback((path) => router.push(href(path)), [router, href]);

  const reloadSession = useCallback(async () => {
    const { data, error } = await api.session();
    if (error) {
      setState({ status: error.code === "portal_closed" ? "closed" : error.code === "not_found" ? "missing" : "error", session: null, error });
      return null;
    }
    setState({ status: "ready", session: data, error: null });
    return data;
  }, [api]);

  useEffect(() => {
    let alive = true;
    api.session().then(({ data, error }) => {
      if (!alive) return;
      if (error) setState({ status: error.code === "portal_closed" ? "closed" : error.code === "not_found" ? "missing" : "error", session: null, error });
      else setState({ status: "ready", session: data, error: null });
    });
    return () => { alive = false; };
  }, [api]);

  const signOut = useCallback(async () => {
    await api.signOut();
    await reloadSession();
    router.push(href());
  }, [api, reloadSession, router, href]);

  // The event's own page design brands the portal; the visitor's light/dark choice swaps the neutrals.
  const design = event?.design;
  const themed = Boolean(design && design.mode !== "standard");
  const brand = useMemo(() => {
    if (!themed) return null;
    const theme = resolveTheme(design);
    return mode === theme.base ? theme : themeForMode(theme, mode);
  }, [themed, design, mode]);
  const style = brand ? themeChromeStyle(brand) : undefined;

  // The event as the chrome shows it: the server-rendered name, and the date and place once the session says them.
  const shown = useMemo(() => (event ? { ...event, ...(state.session?.event ?? {}), name: event.name } : null), [event, state.session]);
  const value = useMemo(() => ({
    eventId, event: shown, api, session: state.session, status: state.status, base, href, navigate, reloadSession, signOut, pathname,
    mode, toggleMode: () => setTheme(mode === "light" ? "dark" : "light"), brand,
  }), [eventId, shown, api, state, base, href, navigate, reloadSession, signOut, pathname, mode, setTheme, brand]);

  let content;
  if (state.status === "loading") {
    content = <LoadingScreen label="Loading" />;
  } else if (state.status === "closed") content = <ClosedScreen onRetry={reloadSession} />;
  else if (state.status === "missing" || !event) content = <MissingScreen />;
  else if (state.status === "error") content = <ClosedScreen error={state.error} onRetry={reloadSession} />;
  else {
    content = (
      <SidebarProvider className="h-[100dvh] overflow-hidden">
        <PortalNav />
        <SidebarInset className="min-w-0 overflow-y-auto">
          <PortalTopBar />
          <div className="mx-auto w-full min-w-0 max-w-[1168px] flex-1 px-[clamp(16px,4vw,48px)] pb-[72px] pt-[clamp(20px,4vw,44px)]">{children}</div>
          <PortalFooter />
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <PortalAppContext.Provider value={value}>
      <div style={style} className={cn("min-h-[100dvh] bg-background text-foreground", themed && "ev-themed")}>{content}</div>
    </PortalAppContext.Provider>
  );
}
