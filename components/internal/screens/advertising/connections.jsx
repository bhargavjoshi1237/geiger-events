"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Chrome, Facebook, DollarSign, Store, Loader2, Plug, Link2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  StatusPill,
  Field,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@geiger/ui";
import { Input } from "@/components/ui/input";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { advertisingApi } from "@/lib/supabase/advertising";
import { AD_PLATFORMS, CONNECTION_STATUS_MAP } from "./constants";

// Per-platform icon for the connection cards. lucide has no brand marks, so these
// are the closest generic stand-ins.
const PLATFORM_ICON = {
  google_adsense: DollarSign,
  facebook_marketplace: Store,
  google_ads: Chrome,
  meta_ads: Facebook,
};

// The wrapper's entry point: link/unlink the four ad platforms. Each connection
// is a `connection` record on events.advertising_records whose config holds the
// account fields a live OAuth sync would later fill.
export function ConnectionsScreen() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [connectTarget, setConnectTarget] = useState(null);
  const [accountName, setAccountName] = useState("");
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    advertisingApi.list(projectId, "connection").then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // platform value → its live connection record (if any).
  const byPlatform = useMemo(() => {
    const map = {};
    for (const r of records) if (r.config?.platform) map[r.config.platform] = r;
    return map;
  }, [records]);

  const connectedCount = Object.keys(byPlatform).length;

  const stats = [
    { label: "Platforms", value: String(AD_PLATFORMS.length), footer: "Available to link" },
    { label: "Connected", value: String(connectedCount), footer: "Active channels" },
    {
      label: "Not connected",
      value: String(AD_PLATFORMS.length - connectedCount),
      footer: "Awaiting setup",
    },
  ];

  const openConnect = (platform) => {
    setConnectTarget(platform);
    setAccountName("");
  };

  const confirmConnect = () => {
    if (!connectTarget) return;
    const name = accountName.trim();
    if (!name) {
      toast.error("Enter the ad account name to connect.");
      return;
    }
    const record = {
      id: crypto.randomUUID(),
      module: "connection",
      name: connectTarget.label,
      status: "Connected",
      coverUrl: "",
      config: {
        platform: connectTarget.value,
        accountName: name,
        accountId: "",
        syncedAt: new Date().toISOString(),
      },
      createdBy: userId,
      projectId,
    };
    setRecords((prev) => [record, ...prev]);
    setConnectTarget(null);
    toast.success(`Connected ${connectTarget.label}.`);
    advertisingApi.create(record).then((saved) => {
      if (!saved) {
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
        toast.error("Couldn't save the connection to the server.");
      } else {
        setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      }
    });
  };

  const disconnect = (platform) => {
    const record = byPlatform[platform.value];
    if (!record) return;
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    toast.success(`Disconnected ${platform.label}.`);
    advertisingApi.remove(record.id).then((ok) => {
      if (!ok) toast.error("Couldn't disconnect on the server.");
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Connections"
        description="Link your ad platforms once, then control campaigns, budgets, and insights from here — no jumping between dashboards."
      />

      <StatsBar stats={stats} columns={3} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {AD_PLATFORMS.map((platform) => {
            const record = byPlatform[platform.value];
            const connected = Boolean(record);
            const Icon = PLATFORM_ICON[platform.value] || Plug;
            return (
              <div
                key={platform.value}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface-subtle p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card",
                        platform.accent,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{platform.label}</p>
                      <p className="text-xs text-text-secondary">{platform.blurb}</p>
                    </div>
                  </div>
                  <StatusPill
                    status={connected ? "Connected" : "Not connected"}
                    map={CONNECTION_STATUS_MAP}
                  />
                </div>

                {connected ? (
                  <div className="rounded-lg bg-surface-card px-3 py-2 text-sm text-muted-foreground">
                    Account:{" "}
                    <span className="text-foreground">{record.config.accountName || "—"}</span>
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary">
                    Not linked yet. Connect an ad account to start running campaigns.
                  </p>
                )}

                <div className="mt-auto">
                  {connected ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => disconnect(platform)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => openConnect(platform)}
                    >
                      <Link2 className="h-4 w-4" /> Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(connectTarget)} onOpenChange={(o) => !o && setConnectTarget(null)}>
        <DialogContent className="border-border bg-surface-subtle">
          <DialogHeader>
            <DialogTitle>Connect {connectTarget?.label}</DialogTitle>
            <DialogDescription>
              Name the ad account you&apos;re linking. A live sync would authorise via {connectTarget?.label};
              for now this stores the account so campaigns and budgets can target it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Ad account name">
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Acme Events — Main"
                autoFocus
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setConnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={confirmConnect}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ConnectionsScreen;
