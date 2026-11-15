"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LogoLoading } from "@geiger/ui";
import { RotateCw } from "lucide-react";
import { FileViewer } from "@/components/workspace_portal/render/pdf_viewer";
import { PageView } from "@/components/workspace_portal/render/page_view";
import { PortalViewProvider } from "@/components/workspace_portal/render/portal_context";
import { RecordView } from "@/components/workspace_portal/render/record_view";
import { usePortalApp } from "./portal_app";
import { InviteScreen, NoAccess, Notice, NotFound, SignInScreen } from "./screens";

// The adapter the shared renderer uses on the live portal.
function usePortalAdapter() {
  const router = useRouter();
  const { api, href, reloadSession } = usePortalApp();
  return useMemo(() => ({
    blockData: api.blockData, command: api.command, lookup: api.lookup, signUpload: api.signUpload, signFile: api.signFile,
    saveDraft: api.saveDraft, clearDraft: api.clearDraft,
    openRecord: ({ list, number }) => { if (list && number) router.push(href(`r/${list}/${number}`)); },
    navigate: (slug) => router.push(href(slug)),
    signIn: { request: api.requestCode, verify: api.verifyCode },
    onSignedIn: () => reloadSession(),
  }), [api, href, router, reloadSession]);
}

// Loads a page by address or a record page by list and number; reloads when who is signed in changes, keeping the
// current page on screen meanwhile (so a form that signs someone in keeps its "sent" message).
function usePortalPage(target) {
  const { api, session } = usePortalApp();
  const key = JSON.stringify({ ...target, who: session?.member?.email ?? null });
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const request = JSON.parse(key);
    if (!request.kind) return undefined;
    const controller = new AbortController();
    const load = request.kind === "record" ? api.recordPage(request.list, request.number, controller.signal) : api.page(request.slug, controller.signal);
    load.then(({ data, error }) => { if (!controller.signal.aborted) setState({ key, data, error }); }).catch(() => {});
    return () => controller.abort();
  }, [api, key, retry]);

  const fresh = state.key === key;
  return { data: state.data, error: fresh ? state.error : null, loading: state.key === null, retry: () => setRetry((n) => n + 1) };
}

function Loading() {
  return <div className="flex justify-center py-24"><LogoLoading size={56} aria-label="Loading page" /></div>;
}

function LoadFailed({ error, onRetry }) {
  if (error.code === "not_found") return <NotFound />;
  return (
    <Notice icon={RotateCw} title="This page didn't load" text={error.message}>
      <Button variant="outline" onClick={onRetry}><RotateCw className="h-4 w-4" />Try again</Button>
    </Notice>
  );
}

function PortalPage({ target }) {
  const { eventId, event, session, href } = usePortalApp();
  const router = useRouter();
  const adapter = usePortalAdapter();
  const { data, error, loading, retry } = usePortalPage(target);

  if (loading) return <Loading />;
  if (error) return <LoadFailed error={error} onRetry={retry} />;
  const isRecord = target.kind === "record";
  return (
    <PortalViewProvider api={adapter} mode="portal" eventId={eventId} timeZone={session?.event?.timeZone ?? event?.timeZone}
      page={data.page} lists={data.lists} record={data.record ?? null} comments={data.comments ?? []} activity={data.activity ?? []} session={session}>
      <FileViewer api={adapter}>
        {isRecord ? (
          <RecordView backLabel="Back" onBack={() => (window.history.length > 1 ? router.back() : router.push(href()))} />
        ) : (
          <div className="grid gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.page.title}</h1>
            <PageView />
          </div>
        )}
      </FileViewer>
    </PortalViewProvider>
  );
}

// Picks what an address under /e/<id>/workspace shows.
export function PortalRoute({ slug = [], token = null, next = null }) {
  const { session } = usePortalApp();
  const [first, second, third] = slug;

  if (first === "sign-in") return <SignInScreen next={next} />;
  if (first === "invite") return <InviteScreen token={token} />;
  if (first === "r") {
    const number = Number(third);
    if (!second || !Number.isInteger(number) || number < 1) return <NotFound />;
    return <PortalPage key={`r/${second}/${number}`} target={{ kind: "record", list: second, number }} />;
  }
  if (slug.length > 1) return <NotFound />;
  const pageSlug = first ?? session?.home;
  if (!pageSlug) return session?.member ? <NoAccess /> : <SignInScreen next={null} />;
  return <PortalPage key={pageSlug} target={{ kind: "page", slug: pageSlug }} />;
}
