"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  ShieldCheck,
  ExternalLink,
  Settings2,
  Loader2,
  Lock,
  Info,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  DataTable,
  StatusPill,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@geiger/ui/sheet";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import {
  getOrgByProject,
  getOrgDomain,
  getOrgEntitlements,
  isProductUnlocked,
} from "@/lib/supabase/domains";
import { DOMAIN_STATUS_MAP } from "./constants";

// Root domain the subdomain sits under (matches geiger-dash env var).
const ROOT_DOMAIN =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ROOT_DOMAIN
    ? process.env.NEXT_PUBLIC_ROOT_DOMAIN
    : "geiger.studio";

const CNAME_TARGET = "custom.events.geiger.events";

function sanitizeSubdomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "")
    .slice(0, 63);
}

// Local shape rules only. There is no availability API yet, so the screen must
// not imply one — it validates the label and leaves the verdict to the save.
function validateSubdomain(value) {
  const sub = sanitizeSubdomain(value);
  if (!sub) return { valid: false, reason: "" };
  if (sub.length < 3) return { valid: false, reason: "Use at least 3 characters." };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub)) {
    return {
      valid: false,
      reason: "Letters, numbers and hyphens only — no leading or trailing hyphen.",
    };
  }
  return { valid: true, reason: "", subdomain: sub };
}

// The DNS name a CNAME goes on: the label(s) in front of the registrable
// domain, or "@" for an apex.
function dnsRecordName(domain) {
  return String(domain || "").split(".").slice(0, -2).join(".") || "@";
}

// --- Screen -------------------------------------------------------------------

export function CustomDomainsScreen() {
  const { project } = useProject();
  const projectId = project?.id;

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [domain, setDomain] = useState(null); // current subdomain row or null
  const [error, setError] = useState(null);

  const [subdomainValue, setSubdomainValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [dnsSheetId, setDnsSheetId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [draftDomain, setDraftDomain] = useState("");
  const [verifyingId, setVerifyingId] = useState(null);

  // Custom domains have no data layer yet; these are UI-only until one exists.
  const [customDomains, setCustomDomains] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;

    (async () => {
      const orgData = await getOrgByProject(projectId);
      if (!alive) return;
      if (!orgData) {
        setError("Could not load organization data.");
        setLoading(false);
        return;
      }
      setOrg(orgData);

      if (isProductUnlocked(getOrgEntitlements(orgData), "subdomain")) {
        const domainRow = await getOrgDomain(orgData.id);
        if (!alive) return;
        setDomain(domainRow || null);
        if (domainRow) setSubdomainValue(domainRow.subdomain);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [projectId]);

  const entitlements = useMemo(
    () => (org ? getOrgEntitlements(org) : null),
    [org],
  );
  const hasSubdomainAddon = isProductUnlocked(entitlements, "subdomain");
  const hasCustomDomainAddon = isProductUnlocked(entitlements, "domain");

  // Counts only — a KPI row animates its numbers, so the subdomain's address
  // belongs in its own section rather than in a stat tile.
  const stats = useMemo(() => {
    const connected =
      customDomains.filter((d) => d.status === "connected").length +
      (domain ? 1 : 0);
    const pending = customDomains.filter((d) =>
      d.status.startsWith("pending"),
    ).length;
    const failed = customDomains.filter((d) => d.status === "failed").length;
    return [
      {
        label: "Addresses",
        value: String(customDomains.length + (domain ? 1 : 0)),
        footer: domain ? `${domain.subdomain}.${ROOT_DOMAIN}` : "No subdomain yet",
      },
      { label: "Connected", value: String(connected), footer: "Serving traffic" },
      { label: "Pending", value: String(pending), footer: "Awaiting DNS or SSL" },
      { label: "Failed", value: String(failed), footer: "Need attention" },
    ];
  }, [domain, customDomains]);

  const check = validateSubdomain(subdomainValue);
  const previewHost = `${subdomainValue || "yourname"}.${ROOT_DOMAIN}`;

  // --- Subdomain mutations (UI-only until server actions are wired) ---------

  const handleSubdomainSave = async () => {
    if (!check.valid) {
      toast.error(check.reason || "Pick a subdomain first.");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setDomain({
      id: domain?.id || crypto.randomUUID(),
      organizationId: org?.id,
      subdomain: check.subdomain,
      type: "subdomain",
      status: "active",
      verified: true,
    });
    setSaving(false);
    toast.success("Subdomain saved.");
  };

  const handleSubdomainRemove = async () => {
    setRemoving(true);
    await new Promise((r) => setTimeout(r, 500));
    setDomain(null);
    setSubdomainValue("");
    setRemoving(false);
    toast.success("Subdomain removed.");
  };

  // --- Custom domain mutations ---------------------------------------------

  const handleAdd = () => {
    const next = draftDomain.trim().toLowerCase();
    if (!next) {
      toast.error("Enter a domain name.");
      return;
    }
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(next)) {
      toast.error("Enter a valid domain name (e.g. events.example.com).");
      return;
    }
    if (customDomains.some((d) => d.domain === next)) {
      toast.error("This domain is already configured.");
      return;
    }
    setAddOpen(false);
    setDraftDomain("");
    const id = crypto.randomUUID();
    setCustomDomains((prev) => [
      ...prev,
      {
        id,
        domain: next,
        status: "pending_dns",
        verifiedAt: null,
        cnameTarget: CNAME_TARGET,
        sslStatus: null,
      },
    ]);
    setDnsSheetId(id);
    toast.success("Domain added. Add the CNAME record to complete setup.");
  };

  const handleDelete = () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setCustomDomains((prev) => prev.filter((d) => d.id !== target.id));
    if (dnsSheetId === target.id) setDnsSheetId(null);
    toast.success(`Removed ${target.domain}`);
  };

  const handleVerify = (id) => {
    setVerifyingId(id);
    setTimeout(() => {
      setCustomDomains((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "connected",
                verifiedAt: new Date().toISOString(),
                sslStatus: "valid",
              }
            : d,
        ),
      );
      setVerifyingId(null);
      toast.success("Domain verified and connected.");
    }, 2000);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast.success(`${label} copied to clipboard.`);
  };

  const sheetDomain = useMemo(
    () => customDomains.find((d) => d.id === dnsSheetId) || null,
    [customDomains, dnsSheetId],
  );

  const addAction =
    hasSubdomainAddon && hasCustomDomainAddon ? (
      <Button
        onClick={() => setAddOpen(true)}
        className="bg-primary text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> Add domain
      </Button>
    ) : null;

  const header = (
    <ScreenHeader
      title="Custom Domains"
      description="Serve your event pages from your own address instead of the default geiger.events URL."
      actions={addAction}
    />
  );

  if (loading) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading domain settings…
        </div>
      </MainScreenWrapper>
    );
  }

  if (error || !org) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Globe}
            title="Could not load domain settings"
            description={error || "This workspace is not linked to an organization."}
          />
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      {header}

      <StatsBar stats={stats} />

      {/* ── Subdomain ────────────────────────────────────────────────────── */}
      <SectionCard
        title="Subdomain"
        description={`A branded address under ${ROOT_DOMAIN}, live as soon as you claim it.`}
        action={
          domain ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSubdomainRemove}
              disabled={removing}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          ) : null
        }
      >
        {!hasSubdomainAddon ? (
          <Notice icon={Lock}>
            The <span className="text-foreground">Custom subdomain</span> add-on
            isn&apos;t active on this workspace. Add it to your plan to host event
            pages at <span className="text-foreground">yourname.{ROOT_DOMAIN}</span>.
          </Notice>
        ) : domain ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {domain.subdomain}.{ROOT_DOMAIN}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Live · all event pages for this workspace resolve here.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `${domain.subdomain}.${ROOT_DOMAIN}`,
                    "Subdomain address",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://${domain.subdomain}.${ROOT_DOMAIN}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Visit
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Field
              className="min-w-0 flex-1"
              label="Choose a subdomain"
              hint={
                check.reason
                  ? undefined
                  : subdomainValue
                    ? `Your pages will live at ${previewHost}`
                    : "3–63 characters · letters, numbers and hyphens"
              }
            >
              <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-surface-card focus-within:ring-2 focus-within:ring-ring">
                <input
                  value={subdomainValue}
                  onChange={(e) =>
                    setSubdomainValue(sanitizeSubdomain(e.target.value))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSubdomainSave()}
                  placeholder="yourname"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-text-tertiary"
                />
                <span className="flex items-center border-l border-border bg-surface-active px-3 text-sm text-text-secondary">
                  .{ROOT_DOMAIN}
                </span>
              </div>
              {check.reason ? (
                <p className="text-xs text-red-400">{check.reason}</p>
              ) : null}
            </Field>
            <Button
              className="bg-primary text-primary-foreground sm:mt-[26px]"
              onClick={handleSubdomainSave}
              disabled={saving || !check.valid}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Claim
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ── Custom domains ───────────────────────────────────────────────── */}
      <SectionCard
        title="Custom domains"
        description="Domains you own, pointed here with a CNAME record."
        action={
          hasCustomDomainAddon && customDomains.length ? (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add domain
            </Button>
          ) : null
        }
        bodyPadding={!hasCustomDomainAddon}
      >
        {!hasCustomDomainAddon ? (
          <Notice icon={Lock}>
            The <span className="text-foreground">Own domain</span> add-on
            isn&apos;t active on this workspace. Add it to your plan to serve event
            pages from a domain you own, like{" "}
            <span className="text-foreground">events.example.com</span>.
          </Notice>
        ) : (
          <DomainsTable
            domains={customDomains}
            verifyingId={verifyingId}
            onShowDns={setDnsSheetId}
            onVerify={handleVerify}
            onDelete={setDeleteTarget}
            onCopyTarget={(d) => copyToClipboard(d.cnameTarget, "DNS target")}
            onAdd={() => setAddOpen(true)}
          />
        )}
      </SectionCard>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <SectionCard title="How it works" bare>
        <ol className="space-y-3">
          <Step n={1} title="Claim a subdomain">
            Pick a name to get <Mono>yourname.{ROOT_DOMAIN}</Mono>. It works
            immediately — no DNS to configure.
          </Step>
          <Step n={2} title="Or point your own domain here">
            Add the domain above, then create a CNAME record at your DNS provider
            targeting <Mono>{CNAME_TARGET}</Mono>.
          </Step>
          <Step n={3} title="We verify and secure it">
            Once the record resolves we provision an SSL certificate
            automatically. DNS changes can take up to 48 hours to propagate.
          </Step>
        </ol>
      </SectionCard>

      {/* ── Dialogs & drawers ────────────────────────────────────────────── */}

      <Dialog
        key={addOpen ? "add-open" : "add-closed"}
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setDraftDomain("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a custom domain</DialogTitle>
            <DialogDescription>
              Enter the domain your event pages should be served from. A
              subdomain of your site is recommended.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Domain name" hint="e.g. events.yourcompany.com">
              <Input
                value={draftDomain}
                onChange={(e) => setDraftDomain(e.target.value)}
                placeholder="events.example.com"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setDraftDomain("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={handleAdd}
            >
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DnsDrawer
        domain={sheetDomain}
        verifying={verifyingId === sheetDomain?.id}
        onOpenChange={(o) => !o && setDnsSheetId(null)}
        onCopy={copyToClipboard}
        onVerify={handleVerify}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove domain</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove ${deleteTarget.domain}? Event pages served from it fall back to the default geiger.events URL.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={handleDelete}
            >
              Remove domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

// --- Shared bits --------------------------------------------------------------

function Notice({ icon: Icon = Info, children }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <p>{children}</p>
    </div>
  );
}

function Mono({ children }) {
  return <code className="font-mono text-xs text-foreground">{children}</code>;
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-[11px] font-medium text-text-secondary tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{children}</p>
      </div>
    </li>
  );
}

// --- Domains table ------------------------------------------------------------

function DomainsTable({
  domains,
  verifyingId,
  onShowDns,
  onVerify,
  onDelete,
  onCopyTarget,
  onAdd,
}) {
  const columns = [
    {
      key: "domain",
      header: "Domain",
      render: (d) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{d.domain}</span>
          <span className="truncate font-mono text-[11px] text-text-tertiary">
            CNAME {dnsRecordName(d.domain)} → {d.cnameTarget}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DOMAIN_STATUS_MAP} />,
    },
    {
      key: "ssl",
      header: "SSL",
      render: (d) =>
        d.sslStatus ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <ShieldCheck
              className={cn(
                "h-3.5 w-3.5",
                d.sslStatus === "valid" ? "text-emerald-400" : "text-amber-400",
              )}
            />
            {d.sslStatus === "valid" ? "Active" : "Provisioning"}
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (d) => {
        const verifying = verifyingId === d.id;
        return (
          <div className="flex justify-end">
            <ActionMenu
              label="Domain actions"
              items={[
                { icon: Settings2, label: "DNS record", onSelect: () => onShowDns(d.id) },
                { icon: Copy, label: "Copy target", onSelect: () => onCopyTarget(d) },
                d.status !== "connected"
                  ? {
                      icon: verifying ? Loader2 : RefreshCw,
                      spin: verifying,
                      label: verifying ? "Verifying…" : "Verify now",
                      disabled: verifying,
                      onSelect: () => onVerify(d.id),
                    }
                  : {
                      icon: ExternalLink,
                      label: "Visit",
                      href: `https://${d.domain}`,
                    },
                { separator: true },
                {
                  icon: Trash2,
                  label: "Remove",
                  variant: "destructive",
                  onSelect: () => onDelete(d),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      className="rounded-none border-0"
      columns={columns}
      data={domains}
      getRowKey={(d) => d.id}
      onRowClick={(d) => onShowDns(d.id)}
      empty={
        <EmptyState
          icon={Globe}
          title="No custom domains"
          description="Point a domain you own here to serve event pages from a branded URL."
          action={
            <Button onClick={onAdd} className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" /> Add your first domain
            </Button>
          }
        />
      }
    />
  );
}

// --- DNS drawer ---------------------------------------------------------------

function DnsDrawer({ domain, verifying, onOpenChange, onCopy, onVerify }) {
  if (!domain) return null;

  const rows = [
    { label: "Type", value: "CNAME" },
    { label: "Name", value: dnsRecordName(domain.domain) },
    { label: "Target", value: domain.cnameTarget, copy: "DNS target" },
    { label: "TTL", value: "Automatic" },
  ];

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 gap-2 border-b border-border p-5 pr-12">
          <SheetTitle className="truncate">{domain.domain}</SheetTitle>
          <SheetDescription>
            Add this record at your DNS provider, then verify.
          </SheetDescription>
          <div>
            <StatusPill status={domain.status} map={DOMAIN_STATUS_MAP} />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-5 pt-5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            DNS record
          </p>
          <div className="divide-y divide-border px-5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-sm text-text-secondary">{row.label}</span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-foreground">
                    {row.value}
                  </span>
                  {row.copy ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label={`Copy ${row.label}`}
                      onClick={() => onCopy(row.value, row.copy)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 pb-6 pt-5">
            {domain.status === "connected" ? (
              <Notice icon={ShieldCheck}>
                This domain is live and its SSL certificate is active.
              </Notice>
            ) : (
              <>
                <Button
                  className="w-full bg-primary text-primary-foreground"
                  disabled={verifying}
                  onClick={() => onVerify(domain.id)}
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {verifying ? "Verifying…" : "Verify record"}
                </Button>
                <p className="mt-3 text-xs text-text-tertiary">
                  DNS changes can take up to 48 hours to propagate. You can close
                  this and come back — verification runs again automatically.
                </p>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CustomDomainsScreen;
