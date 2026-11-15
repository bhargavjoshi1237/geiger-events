"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, CheckCircle2, FileQuestion, Loader2, Lock, MailCheck, RotateCw } from "lucide-react";
import { Button, Card, EmptyState } from "@geiger/ui";
import { CodeSignIn } from "@/components/workspace_portal/render/code_sign_in";
import { usePortalApp } from "./portal_app";

function FullScreen({ icon, title, text, children }) {
  return <EmptyState className="min-h-[100dvh]" icon={icon} title={title} description={text} action={children} />;
}

export function ClosedScreen({ error, onRetry }) {
  if (error) {
    return (
      <FullScreen icon={RotateCw} title="Couldn't load this portal" text={error.message ?? "Check your connection and try again."}>
        {onRetry ? <Button onClick={onRetry}><RotateCw className="h-4 w-4" />Try again</Button> : null}
      </FullScreen>
    );
  }
  return (
    <FullScreen icon={Lock} title="This portal isn't open" text="The organisers haven't opened it yet. Check back later or contact them.">
      {onRetry ? <Button variant="outline" onClick={onRetry}><RotateCw className="h-4 w-4" />Check again</Button> : null}
    </FullScreen>
  );
}

export function MissingScreen() {
  return <FullScreen icon={CalendarX2} title="Portal not found" text="This link may be wrong, or the event no longer exists." />;
}

// Inside the shell: a centred message with an optional action.
export function Notice({ icon = FileQuestion, title, text, children }) {
  return <EmptyState icon={icon} title={title} description={text} action={children} />;
}

export function NotFound() {
  const { session, href, pathname } = usePortalApp();
  if (!session?.member) {
    return (
      <Notice icon={Lock} title="Sign in to see this page" text="This page may only be open to people the organisers have invited.">
        <Button asChild><Link href={`${href("sign-in")}?next=${encodeURIComponent(pathname ?? "")}`}>Sign in</Link></Button>
      </Notice>
    );
  }
  return (
    <Notice title="Page not found" text="It doesn't exist or isn't open to you.">
      <Button asChild variant="outline"><Link href={href()}>Go to the start</Link></Button>
    </Notice>
  );
}

export function NoAccess() {
  const { session } = usePortalApp();
  const contact = session?.portal?.contact;
  return (
    <Notice icon={Lock} title="Nothing here for you yet"
      text={`You're signed in as ${session?.member?.email ?? "you"}, but the organisers haven't shared any pages with this email.`}>
      {contact ? <Button asChild variant="outline"><a href={`mailto:${contact}`}>Contact the organisers</a></Button> : null}
    </Notice>
  );
}

// Email → code sign-in, then back to where they were going.
export function SignInScreen({ next }) {
  const router = useRouter();
  const { api, event, session, reloadSession, href, base } = usePortalApp();
  const [done, setDone] = useState(false);
  const welcome = session?.portal?.welcome;
  const target = typeof next === "string" && next.startsWith(base) ? next : href();
  const signIn = { request: api.requestCode, verify: api.verifyCode };

  if (session?.member && !done) {
    return (
      <Notice icon={CheckCircle2} title="You're signed in" text={`Signed in as ${session.member.email}.`}>
        <Button asChild><Link href={target}>Continue</Link></Button>
      </Notice>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-sm gap-6 py-6 sm:py-12">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="whitespace-pre-line text-sm text-text-secondary">{welcome || `Use your email to open your space for ${event?.name ?? "this event"}. We'll send you a code — no password needed.`}</p>
      </div>
      <Card className="gap-0 p-5 shadow-none">
        {done ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />Opening your space…</div>
        ) : (
          <CodeSignIn signIn={signIn} onDone={async () => {
            setDone(true);
            await reloadSession();
            router.push(target);
          }} />
        )}
      </Card>
    </div>
  );
}

// A personal invite link. Accepting is a button press (a POST), so email link scanners can't use it up.
export function InviteScreen({ token }) {
  const router = useRouter();
  const { api, event, reloadSession, href } = usePortalApp();
  const [state, setState] = useState({ busy: false, error: null });

  const accept = async () => {
    setState({ busy: true, error: null });
    const { error } = await api.acceptInvite(token);
    if (error) { setState({ busy: false, error }); return; }
    await reloadSession();
    router.push(href());
  };

  if (!token) {
    return <Notice title="This invite link is incomplete" text="Open the link from your email again, or sign in with your email." />;
  }

  return (
    <div className="mx-auto grid w-full max-w-sm gap-6 py-6 sm:py-12">
      <div className="grid gap-2">
        <MailCheck className="h-7 w-7 text-text-secondary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">You&apos;re invited</h1>
        <p className="text-sm text-text-secondary">The organisers of {event?.name ?? "this event"} invited you to their portal.</p>
      </div>
      {state.error ? (
        <Card className="gap-4 p-5 shadow-none">
          <p className="text-sm text-foreground">{state.error.message}</p>
          <p className="text-sm text-text-secondary">You can still sign in with a code sent to your email.</p>
          <Button asChild variant="outline"><Link href={href("sign-in")}>Sign in with email</Link></Button>
        </Card>
      ) : (
        <Button size="lg" onClick={accept} disabled={state.busy}>
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue to {event?.name ?? "the portal"}
        </Button>
      )}
    </div>
  );
}
