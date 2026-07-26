"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Copy,
  ShieldCheck,
  ExternalLink,
  Settings2,
  Loader2,
  Sparkles,
  Lock,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  SettingsList,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import {
  getOrgByProject,
  getOrgDomain,
  getOrgEntitlements,
  isProductUnlocked,
} from "@/lib/supabase/domains";

// Root domain the subdomain sits under (matches geiger-dash env var).
const ROOT_DOMAIN =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ROOT_DOMAIN
    ? process.env.NEXT_PUBLIC_ROOT_DOMAIN
    : "geiger.studio";

const CNAME_TARGET = "custom.events.geiger.events";

// --- Screen -------------------------------------------------------------------

export function CustomDomainsScreen() {
  const { project } = useProject();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [domain, setDomain] = useState(null); // current subdomain row or null
  const [error, setError] = useState(null);

  // ── Subdomain form state ────────────────────────────────────────────────────
  const [subdomainValue, setSubdomainValue] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState("idle"); // idle | checking | available | unavailable
  const [subdomainReason, setSubdomainReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // ── Custom domain state ─────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [dnsSheetId, setDnsSheetId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [draftDomain, setDraftDomain] = useState("");
  const [verifyingId, setVerifyingId] = useState(null);

  // Mock custom domains until the real data layer exists.
  const [customDomains, setCustomDomains] = useState([]);

  // ── Fetch org + domain on mount ─────────────────────────────────────────────
  const projectId = project?.id;

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

      const entitlements = getOrgEntitlements(orgData);
      const unlocked = isProductUnlocked(entitlements, "subdomain");

      if (unlocked) {
        // Attempt to read the current subdomain (may be null).
        const domainRow = await getOrgDomain(orgData.id);
        if (!alive) return;
        setDomain(domainRow || null);
        if (domainRow) {
          setSubdomainValue(domainRow.subdomain);
        }
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [projectId]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const entitlements = useMemo(
    () => (org ? getOrgEntitlements(org) : null),
    [org],
  );
  const hasSubdomainAddon = useMemo(
    () => isProductUnlocked(entitlements, "subdomain"),
    [entitlements],
  );
  const hasCustomDomainAddon = useMemo(
    () => isProductUnlocked(entitlements, "domain"),
    [entitlements],
  );

  // Stats: subdomain + custom domains.
  const stats = useMemo(() => {
    const subConnected = domain ? 1 : 0;
    const customConnected = customDomains.filter(
      (d) => d.status === "connected",
    ).length;
    const customPending = customDomains.filter((d) =>
      d.status.startsWith("pending"),
    ).length;
    return [
      {
        label: "Subdomain",
        value: domain ? domain.subdomain : "—",
        hint: domain ? `${domain.subdomain}.${ROOT_DOMAIN}` : undefined,
      },
      {
        label: "Custom domains",
        value: String(customConnected + customPending),
        hint: `${customConnected} connected`,
      },
    ];
  }, [domain, customDomains]);

  // ── Subdomain mutations ────────────────────────────────────────────────────
  // These are UI-only until server actions are wired (mirror geiger-dash
  // app/org/domain-actions.js). For now they optimistically update local state.

  function sanitizeSubdomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+/, "")
      .slice(0, 63);
  }

  function validateSubdomain(value) {
    const sub = sanitizeSubdomain(value);
    if (sub.length < 3)
      return { valid: false, reason: "Use at least 3 characters." };
    if (sub.length > 63)
      return { valid: false, reason: "Keep it under 63 characters." };
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub)) {
      return {
        valid: false,
        reason:
          "Use letters, numbers, and hyphens only (no leading or trailing hyphen).",
      };
    }
    return { valid: true, reason: "", subdomain: sub };
  }

  function handleSubdomainChange(e) {
    setSubdomainValue(sanitizeSubdomain(e.target.value));
    setSubdomainStatus("idle");
    setSubdomainReason("");
  }

  async function handleSubdomainSave() {
    const check = validateSubdomain(subdomainValue);
    if (!check.valid) {
      toast.error(check.reason);
      return;
    }
    setSaving(true);
    // Simulate server call — replace with server action later.
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
  }

  async function handleSubdomainRemove() {
    setRemoving(true);
    await new Promise((r) => setTimeout(r, 500));
    setDomain(null);
    setSubdomainValue("");
    setSubdomainStatus("idle");
    setRemoving(false);
    toast.success("Subdomain removed.");
  }

  // ── Custom domain mutations (UI-only, as before) ────────────────────────────

  const handleAdd = () => {
    const domain = draftDomain.trim().toLowerCase();
    if (!domain) {
      toast.error("Enter a domain name.");
      return;
    }
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain name (e.g. events.example.com).");
      return;
    }
    if (customDomains.find((d) => d.domain === domain)) {
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
        domain,
        status: "pending_dns",
        verifiedAt: null,
        cnameTarget: CNAME_TARGET,
        sslStatus: null,
      },
    ]);
    toast.success("Domain added. Configure your DNS to complete setup.");
  };

  const handleDelete = () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setCustomDomains((prev) => prev.filter((d) => d.id !== target.id));
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

  const previewHost = subdomainValue
    ? `${subdomainValue}.${ROOT_DOMAIN}`
    : `${"yourname"}.${ROOT_DOMAIN}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  // Loading state.
  if (loading) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Custom Domains"
          description="Connect your own domain to host event pages under your brand."
        />
        <div className="flex items-center justify-center py-24 text-sm text-text-secondary">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading domain settings…
        </div>
      </MainScreenWrapper>
    );
  }

  // Error / no org.
  if (error || !org) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Custom Domains"
          description="Connect your own domain to host event pages under your brand."
        />
        <EmptyState
          icon={Globe}
          title="Could not load domain settings"
          description={
            error || "This workspace is not linked to an organization."
          }
        />
      </MainScreenWrapper>
    );
  }

  // Subdomain add-on not purchased.
  if (!hasSubdomainAddon) {
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title="Custom Domains"
          description="Connect your own domain to host event pages under your brand."
        />

        <SectionCard
          title="Subdomain"
          description="A branded subdomain for your workspace."
        >
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-tertiary">
              <Lock className="h-6 w-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Subdomain add-on not active
              </p>
              <p className="text-sm text-text-secondary">
                Purchase the Custom subdomain add-on from your workspace plan to
                host your event pages at{" "}
                <code className="text-foreground">yourname.geiger.studio</code>.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() =>
                toast.info("Billing page — coming soon.")
              }
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> View plans
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Custom domain" bare>
          <p className="text-sm text-text-secondary">
            Bring your own domain (e.g.{" "}
            <strong className="text-foreground">events.example.com</strong>)
            for a fully branded experience. This feature is coming soon.
          </p>
        </SectionCard>

        <SectionCard title="How it works" bare>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>
              When you connect a domain, your event pages are served from your
              own URL instead of the default{" "}
              <code className="text-foreground">geiger.events/&hellip;</code>{" "}
              address.
            </p>
            <ol className="ml-4 list-decimal space-y-2">
              <li>
                Purchase the{" "}
                <strong className="text-foreground">Custom subdomain</strong>{" "}
                add-on from your workspace plan.
              </li>
              <li>
                Pick your subdomain (e.g.{" "}
                <strong className="text-foreground">acme</strong>) to get{" "}
                <code className="text-foreground">acme.geiger.studio</code>.
              </li>
              <li>
                Or connect your own domain via a CNAME record pointing to{" "}
                <code className="text-foreground">{CNAME_TARGET}</code>.
              </li>
            </ol>
          </div>
        </SectionCard>
      </MainScreenWrapper>
    );
  }

  // ── Add-on purchased — show subdomain + custom domain UI ─────────────────

  const addAction = hasCustomDomainAddon ? (
    <Button
      onClick={() => setAddOpen(true)}
      className="bg-primary text-primary-foreground"
    >
      <Plus className="h-4 w-4" /> Add domain
    </Button>
  ) : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Custom Domains"
        description="Connect your own domain to host event pages under your brand."
        actions={addAction}
      />

      <StatsBar stats={stats} />

      {/* ── Subdomain section ───────────────────────────────────────────── */}
      <SectionCard
        title="Subdomain"
        description="Your workspace's branded subdomain."
      >
        {domain ? (
          /* Active subdomain — show live details */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <Globe className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {domain.subdomain}.{ROOT_DOMAIN}
                </p>
                <p className="text-xs text-emerald-400">Active</p>
              </div>
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
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`https://${domain.subdomain}.${ROOT_DOMAIN}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Visit
                </a>
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={handleSubdomainRemove}
                disabled={removing}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                {removing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Remove
              </Button>
            </div>
          </div>
        ) : (
          /* No subdomain — show claim form */
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Pick a subdomain to host this workspace. Visitors see only this
              organization&apos;s events.
            </p>

            <div className="space-y-2">
              <Field label="Subdomain">
                <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-surface-card focus-within:ring-2 focus-within:ring-ring">
                  <input
                    value={subdomainValue}
                    onChange={handleSubdomainChange}
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
              </Field>

              <div className="flex min-h-[1.25rem] items-center gap-2 text-xs">
                {subdomainStatus === "checking" && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary" />
                    <span className="text-text-secondary">
                      Checking availability…
                    </span>
                  </>
                )}
                {subdomainStatus === "available" && (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">
                      {previewHost} is available
                    </span>
                  </>
                )}
                {subdomainStatus === "unavailable" && (
                  <span className="text-red-400">
                    {subdomainReason || "Not available."}
                  </span>
                )}
                {subdomainStatus === "idle" && subdomainValue && (
                  <span className="text-text-secondary">
                    Preview: {previewHost}
                  </span>
                )}
                {subdomainStatus === "idle" && !subdomainValue && (
                  <span className="text-text-tertiary">
                    3–63 characters · letters, numbers, and hyphens
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubdomainSave}
                disabled={
                  saving ||
                  !subdomainValue ||
                  subdomainStatus === "unavailable"
                }
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="mr-1.5 h-4 w-4" />
                )}
                Claim subdomain
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Custom domains section ──────────────────────────────────────── */}
      <SectionCard
        title="Custom domains"
        description={
          hasCustomDomainAddon
            ? "Domains linked to your event pages. Each needs a CNAME record."
            : 'Bring your own domain — requires the "Own domain" add-on.'
        }
        bodyPadding={hasCustomDomainAddon && !customDomains.length}
      >
        {!hasCustomDomainAddon ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-tertiary">
              <Lock className="h-6 w-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Coming soon
              </p>
              <p className="text-sm text-text-secondary">
                The <strong>Own domain</strong> add-on will let you connect your
                own domain to host event pages.
              </p>
            </div>
          </div>
        ) : customDomains.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No custom domains"
            description="Add a domain to host your event pages on a branded URL like events.yourcompany.com."
            action={
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Add your first domain
              </Button>
            }
          />
        ) : (
          <SettingsList className="px-3">
            {customDomains.map((d) => (
              <CustomDomainRow
                key={d.id}
                domain={d}
                verifying={verifyingId === d.id}
                onShowDns={() => setDnsSheetId(d.id)}
                onDelete={() => setDeleteTarget(d)}
                onVerify={() => handleVerify(d.id)}
                onCopyCname={() =>
                  copyToClipboard(d.cnameTarget, "DNS target")
                }
              />
            ))}
          </SettingsList>
        )}
      </SectionCard>

      {/* How it works */}
      <SectionCard title="How it works" bare>
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            When you connect a domain, your event pages are served from your own
            URL instead of the default{" "}
            <code className="text-foreground">geiger.events/&hellip;</code>{" "}
            address.
          </p>
          <ol className="ml-4 list-decimal space-y-2">
            <li>
              Pick a <strong className="text-foreground">subdomain</strong> (e.g.{" "}
              <code className="text-foreground">acme.geiger.studio</code>) —
              instant setup.
            </li>
            <li>
              Or add a{" "}
              <strong className="text-foreground">custom domain</strong> and
              create a CNAME record pointing to{" "}
              <code className="text-foreground">{CNAME_TARGET}</code>.
            </li>
            <li>
              We automatically provision an SSL certificate and verify
              ownership.
            </li>
          </ol>
          <p>
            DNS propagation can take up to 48 hours. Once connected, all event
            pages for this workspace will be available on your domain.
          </p>
        </div>
      </SectionCard>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

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
              Enter the domain you want to use for your event pages. A subdomain
              is recommended.
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

      <Sheet
        open={!!dnsSheetId}
        onOpenChange={(o) => !o && setDnsSheetId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>DNS configuration</SheetTitle>
            <SheetDescription>
              Add this record at your DNS provider.
            </SheetDescription>
          </SheetHeader>
          {sheetDomain ? (
            <div className="space-y-6 px-4 pb-6 pt-4">
              <Field label="Your domain">
                <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
                  <code className="text-sm text-foreground">
                    {sheetDomain.domain}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() =>
                      copyToClipboard(sheetDomain.domain, "Domain")
                    }
                    aria-label="Copy domain"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Field>

              <div className="rounded-lg border border-border bg-surface-card p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  DNS record
                </p>
                <div className="space-y-3 text-sm">
                  <DnsRow label="Type" value="CNAME" />
                  <DnsRow
                    label="Name"
                    value={
                      sheetDomain.domain.split(".").slice(0, -2).join(".") ||
                      "@"
                    }
                  />
                  <DnsRow
                    label="Target"
                    value={sheetDomain.cnameTarget}
                    mono
                    copyable
                    onCopy={() =>
                      copyToClipboard(sheetDomain.cnameTarget, "DNS target")
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-surface-card/50 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Status
                </p>
                <DomainStatusBadge status={sheetDomain.status} />
                {sheetDomain.sslStatus ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                    <ShieldCheck
                      className={cn(
                        "h-4 w-4",
                        sheetDomain.sslStatus === "valid"
                          ? "text-emerald-400"
                          : "text-amber-400",
                      )}
                    />
                    SSL certificate{" "}
                    {sheetDomain.sslStatus === "valid"
                      ? "active"
                      : "provisioning…"}
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-text-tertiary">
                <ExternalLink className="mr-1 inline-block h-3 w-3" />
                DNS changes can take up to 48 hours to propagate.
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove domain</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove ${deleteTarget.domain}? Event pages will fall back to the default geiger.events URL.`
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

// --- Sub-components -----------------------------------------------------------

const DOMAIN_STATUS_MAP = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  pending_dns: {
    label: "Pending DNS",
    icon: Clock,
    chip: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  pending_ssl: {
    label: "Pending SSL",
    icon: Clock,
    chip: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    chip: "border-red-500/20 bg-red-500/10 text-red-300",
  },
};

function DomainStatusBadge({ status }) {
  const meta = DOMAIN_STATUS_MAP[status];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Badge className={cn("border", meta.chip)}>
      <Icon className="mr-1 h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function DnsRow({ label, value, mono, copyable, onCopy }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-foreground", mono && "font-mono text-xs")}>
          {value}
        </span>
        {copyable ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CustomDomainRow({
  domain,
  verifying,
  onShowDns,
  onDelete,
  onVerify,
  onCopyCname,
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
          <Globe className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {domain.domain}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            CNAME &rarr;{" "}
            <code className="text-text-secondary">{domain.cnameTarget}</code>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DomainStatusBadge status={domain.status} />

        {domain.status === "pending_dns" || domain.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onVerify(domain.id)}
            disabled={verifying}
          >
            {verifying ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            {verifying ? "Verifying…" : "Verify"}
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onShowDns(domain.id)}
          aria-label="DNS configuration"
        >
          <Settings2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => onDelete(domain)}
          aria-label="Remove domain"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default CustomDomainsScreen;
