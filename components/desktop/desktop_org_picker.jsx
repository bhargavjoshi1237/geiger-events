"use client";

import React, { useEffect, useState } from "react";
import { Building2, ChevronRight, CircleAlert, ExternalLink, Loader2, LogOut, RotateCw } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui/logo-loading";
import { LoadingArea } from "@geiger/ui/screen-kit";
import { projectPath, suiteUrl } from "@/lib/desktop/config";
import { openInBrowser } from "@/lib/desktop/browser";
import {
  listEventsProjects,
  listOrganizations,
  pickLaunchProject,
  readLastOrg,
  rememberOrg,
} from "@/lib/desktop/orgs";
import { DesktopShell, ErrorNote, StatePanel } from "./desktop_states";

const LOADING = { status: "loading", orgs: [], error: "" };
const BROWSER_FAILED = "Couldn't open your browser. Please try again.";

const orgName = (org) => org.name || "Untitled organization";

// Every org with its Events projects: last opened first, then orgs with Events, each group newest first.
async function loadOrganizations(supabase, userId) {
  try {
    const { organizations, error } = await listOrganizations(supabase, userId);
    if (error) return { ...LOADING, status: "error", error };
    const lists = await Promise.all(organizations.map((org) => listEventsProjects(supabase, org.id)));
    const failed = lists.find((list) => list.error);
    if (failed) return { ...LOADING, status: "error", error: failed.error };

    const lastOrgId = readLastOrg();
    const orgs = organizations
      .map((org, index) => ({ ...org, projects: lists[index].projects, isLast: String(org.id) === lastOrgId }))
      .sort((a, b) => Number(b.isLast) - Number(a.isLast) || Number(b.projects.length > 0) - Number(a.projects.length > 0));
    return { status: "ready", orgs, error: "" };
  } catch (err) {
    return { ...LOADING, status: "error", error: err?.message || "Something went wrong." };
  }
}

function OrgAvatar({ org }) {
  return (
    <Avatar className="size-10 rounded-lg border border-border bg-surface-card">
      {org.avatar_url ? <AvatarImage src={org.avatar_url} alt="" /> : null}
      <AvatarFallback className="rounded-lg bg-surface-card text-text-secondary">
        <Building2 className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function OrgSummary({ org, children }) {
  return (
    <>
      <OrgAvatar org={org} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{orgName(org)}</span>
          {org.isLast ? <Badge variant="outline">Last opened</Badge> : null}
        </div>
        {children}
      </div>
    </>
  );
}

function OrgRow({ org, onPick }) {
  const count = org.projects.length;
  return (
    <button
      type="button"
      onClick={() => onPick(org)}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <OrgSummary org={org}>
        <p className="text-xs text-text-secondary">
          {count} Events {count === 1 ? "project" : "projects"}
        </p>
      </OrgSummary>
      <ChevronRight className="size-4 shrink-0 text-text-tertiary transition-colors group-hover:text-foreground" />
    </button>
  );
}

// Orgs without Events can't be opened here; the only way forward is adding Events on geiger.studio.
function UnavailableOrgRow({ org, onSetUp }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 opacity-70">
      <OrgSummary org={org}>
        <p className="text-xs text-text-tertiary">Events isn&apos;t set up in this organization</p>
      </OrgSummary>
      <Button type="button" variant="ghost" size="sm" onClick={() => onSetUp(org)}>
        <ExternalLink className="size-4" />
        Set up
      </Button>
    </div>
  );
}

function Launching({ org }) {
  return (
    <div className="flex justify-center py-16">
      <LogoLoading size={48} aria-label={`Opening ${orgName(org)}`} />
    </div>
  );
}

function AccountActions({ email, signingOut, onSignOut }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden max-w-[240px] truncate text-sm text-muted-foreground sm:block">{email}</span>
      <Button type="button" variant="ghost" size="sm" disabled={signingOut} onClick={onSignOut}>
        {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        Sign out
      </Button>
    </div>
  );
}

// `onSignOut` resolves to an error message, or "" once signed out.
export function DesktopOrgPicker({ supabase, user, onSignOut }) {
  const [result, setResult] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [launching, setLaunching] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;
    loadOrganizations(supabase, user.id).then((next) => {
      if (alive) setResult(next);
    });
    return () => {
      alive = false;
    };
  }, [supabase, user.id, attempt]);

  const retry = () => {
    setResult(LOADING);
    setAttempt((n) => n + 1);
  };

  const signOut = async () => {
    setSigningOut(true);
    setActionError("");
    const message = await onSignOut();
    if (message) {
      setSigningOut(false);
      setActionError(message);
    }
  };

  const openSuite = async (path) => {
    setActionError("");
    if (!(await openInBrowser(suiteUrl(path)))) setActionError(BROWSER_FAILED);
  };

  const pick = (org) => {
    const project = pickLaunchProject(org.projects);
    if (!project) return;
    setActionError("");
    rememberOrg(org.id);
    setLaunching(org);
    window.location.assign(projectPath(project.id));
  };

  const renderBody = () => {
    if (result.status === "loading") return <LoadingArea size={48} label="Loading organizations" />;

    if (result.status === "error") {
      return (
        <StatePanel icon={CircleAlert} title="Couldn't load your organizations" description={result.error}>
          <Button type="button" variant="outline" onClick={retry}>
            <RotateCw className="size-4" />
            Retry
          </Button>
        </StatePanel>
      );
    }

    if (!result.orgs.length) {
      return (
        <StatePanel
          icon={Building2}
          title="You're not part of an organization yet"
          description="Create or join one on geiger.studio to start using Events."
        >
          <Button type="button" onClick={() => openSuite("/onboarding")}>
            <ExternalLink className="size-4" />
            Set up on geiger.studio
          </Button>
          <Button type="button" variant="outline" disabled={signingOut} onClick={signOut}>
            Sign out
          </Button>
        </StatePanel>
      );
    }

    if (launching) return <Launching org={launching} />;

    return (
      <ul className="space-y-2">
        {result.orgs.map((org) => (
          <li key={org.id}>
            {org.projects.length ? (
              <OrgRow org={org} onPick={pick} />
            ) : (
              <UnavailableOrgRow org={org} onSetUp={(target) => openSuite(`/org/${target.id}`)} />
            )}
          </li>
        ))}
      </ul>
    );
  };

  // The heading only frames the list; the full-panel states carry their own title.
  const showHeading = result.status === "loading" || (result.status === "ready" && result.orgs.length > 0 && !launching);

  return (
    <DesktopShell
      wide
      actions={<AccountActions email={user.email} signingOut={signingOut} onSignOut={signOut} />}
    >
      <div className="space-y-6">
        {showHeading ? (
          <div className="space-y-1.5">
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Choose an organization</h1>
            <p className="text-sm text-muted-foreground">Events opens in the organization you pick.</p>
          </div>
        ) : null}
        {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}
        {renderBody()}
      </div>
    </DesktopShell>
  );
}
