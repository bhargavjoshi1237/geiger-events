"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, FolderOpen, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { LoadingArea } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useProject } from "@/context/project-context";
import { useCan } from "@/context/rbac-context";
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  replayWebhookDelivery,
  retryWebhookDelivery,
  revealWebhookSecret,
  revokeApiKey,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhookEndpoint,
} from "@/lib/api_webhooks/client";
import { cn } from "@/lib/utils";
import { hostPath, toastSendResult } from "./api_webhooks/constants";
import { useApiWebhooks } from "./api_webhooks/use_api_webhooks";
import KeysTab from "./api_webhooks/keys_tab";
import { CreateKeyDialog, RevokeKeyDialog } from "./api_webhooks/key_dialogs";
import EndpointsTab from "./api_webhooks/endpoints_tab";
import EndpointDialog from "./api_webhooks/endpoint_dialog";
import SecretDialog from "./api_webhooks/secret_dialog";
import DeliveriesTab from "./api_webhooks/deliveries_tab";
import DeliveryDrawer from "./api_webhooks/delivery_drawer";
import DocsTab from "./api_webhooks/docs_tab";

const TABS = [
  { key: "keys", label: "API keys" },
  { key: "webhooks", label: "Webhooks" },
  { key: "deliveries", label: "Deliveries" },
  { key: "docs", label: "Docs" },
];

const POLL_MS = 15_000;

function DeleteEndpointDialog({ endpoint, onOpenChange, onDelete }) {
  const [saving, setSaving] = useState(false);
  async function confirm() {
    setSaving(true);
    const ok = await onDelete(endpoint);
    setSaving(false);
    if (ok) onOpenChange(false);
  }
  return (
    <Dialog open={!!endpoint} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete endpoint?</DialogTitle>
          <DialogDescription>
            {endpoint
              ? `${hostPath(endpoint.url)} stops receiving events now, and anything still queued for it is dropped. Past deliveries stay in the log.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={confirm} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete endpoint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiWebhooksScreen() {
  const { projectId, loading: projectLoading } = useProject();
  const canManage = useCan("events.settings.manage");
  const data = useApiWebhooks(projectId);
  const { refresh, upsertKey, upsertEndpoint, removeEndpoint } = data;

  const [tab, setTab] = useState(null);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [endpointDialog, setEndpointDialog] = useState({ open: false, endpoint: null });
  const [secretTarget, setSecretTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openDeliveryId, setOpenDeliveryId] = useState(null);
  // Remounts the log with an endpoint pre-filtered each time "View deliveries" is used.
  const [deliveryFocus, setDeliveryFocus] = useState({ endpoint: "all", n: 0 });

  // Until the user picks a tab, land on the delivery log once there's something sending, otherwise on keys.
  const settling = projectLoading || data.loading;
  const activeTab = tab ?? (settling ? null : data.endpoints.length ? "deliveries" : "keys");

  // The delivery log is live: re-read it while it's on screen.
  useEffect(() => {
    if (activeTab !== "deliveries" || !projectId) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeTab, projectId, refresh]);

  const openDelivery = useMemo(
    () => data.deliveries.find((d) => d.id === openDeliveryId) || null,
    [data.deliveries, openDeliveryId],
  );

  const tabCounts = {
    keys: data.keys.filter((k) => k.status === "active").length,
    webhooks: data.endpoints.length,
  };

  async function handleCreateKey(values) {
    const result = await createApiKey(projectId, values);
    if (result.error) {
      toast.error(result.error.message);
      return null;
    }
    upsertKey(result.key);
    toast.success(`${result.key.name} created`);
    return result;
  }

  async function handleRevokeKey(key) {
    const result = await revokeApiKey(projectId, key.id);
    if (result.error) {
      toast.error(result.error.message);
      return false;
    }
    upsertKey(result.key);
    toast.success(`${key.name} revoked`);
    return true;
  }

  async function handleTest(endpoint) {
    const pending = toast.loading(`Sending a test event to ${hostPath(endpoint.url)}…`);
    const result = await sendWebhookTest(projectId, endpoint.id);
    toast.dismiss(pending);
    toastSendResult(result, "Test event");
    refresh();
  }

  async function handleSaveEndpoint(values) {
    const editing = endpointDialog.endpoint;
    const result = editing
      ? await updateWebhookEndpoint(projectId, editing.id, values)
      : await createWebhookEndpoint(projectId, values);
    if (result.error) {
      toast.error(result.error.message);
      return false;
    }
    upsertEndpoint(result.endpoint);
    if (editing) {
      toast.success("Endpoint saved");
    } else {
      toast.success("Endpoint added", {
        description: "Send a test event to check it's answering.",
        action: { label: "Send test", onClick: () => handleTest(result.endpoint) },
      });
    }
    return true;
  }

  async function handleToggle(endpoint) {
    const result = await updateWebhookEndpoint(projectId, endpoint.id, { active: !endpoint.active });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    upsertEndpoint(result.endpoint);
    toast.success(result.endpoint.active ? "Endpoint enabled" : "Endpoint disabled");
  }

  async function handleDelete(endpoint) {
    const result = await deleteWebhookEndpoint(projectId, endpoint.id);
    if (result.error) {
      toast.error(result.error.message);
      return false;
    }
    removeEndpoint(endpoint.id);
    toast.success("Endpoint deleted");
    refresh();
    return true;
  }

  async function handleReveal(endpoint) {
    const result = await revealWebhookSecret(projectId, endpoint.id);
    if (result.error) {
      toast.error(result.error.message);
      return null;
    }
    return result.secret;
  }

  async function handleRotate(endpoint) {
    const result = await rotateWebhookSecret(projectId, endpoint.id);
    if (result.error) {
      toast.error(result.error.message);
      return null;
    }
    upsertEndpoint(result.endpoint);
    setSecretTarget(result.endpoint);
    toast.success("Signing secret rotated");
    return result.secret;
  }

  async function handleRetry(delivery) {
    const result = await retryWebhookDelivery(projectId, delivery.id);
    toastSendResult(result, "Retry");
    refresh();
  }

  async function handleReplay(delivery) {
    const result = await replayWebhookDelivery(projectId, delivery.id);
    toastSendResult(result, "Replay");
    refresh();
  }

  function viewDeliveries(endpoint) {
    setDeliveryFocus((current) => ({ endpoint: endpoint.id, n: current.n + 1 }));
    setTab("deliveries");
  }

  function addEndpoint() {
    setEndpointDialog({ open: true, endpoint: null });
  }

  const headerAction = !canManage ? null : activeTab === "keys" ? (
    <Button className="bg-primary text-primary-foreground" onClick={() => setCreateKeyOpen(true)}>
      <Plus className="h-4 w-4" /> Create key
    </Button>
  ) : activeTab === "webhooks" ? (
    <Button className="bg-primary text-primary-foreground" onClick={addEndpoint}>
      <Plus className="h-4 w-4" /> Add endpoint
    </Button>
  ) : null;

  let body;
  if (!projectId && !projectLoading) {
    body = (
      <EmptyState
        icon={FolderOpen}
        title="Open a project"
        description="API keys and webhooks belong to a project. Choose one to manage them."
      />
    );
  } else if (settling || !activeTab) {
    body = <LoadingArea size={48} panel label="Loading API & Webhooks" />;
  } else if (data.failed) {
    body = (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={CircleAlert}
          title="Couldn't load API & Webhooks"
          description="Check your connection and try again."
          action={
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          }
        />
      </div>
    );
  } else if (activeTab === "keys") {
    body = (
      <KeysTab
        keys={data.keys}
        canManage={canManage}
        onCreate={() => setCreateKeyOpen(true)}
        onRevoke={setRevokeTarget}
      />
    );
  } else if (activeTab === "webhooks") {
    body = (
      <EndpointsTab
        endpoints={data.endpoints}
        health={data.health}
        canManage={canManage}
        onAdd={addEndpoint}
        onEdit={(endpoint) => setEndpointDialog({ open: true, endpoint })}
        onSecret={setSecretTarget}
        onToggle={handleToggle}
        onTest={handleTest}
        onDelete={setDeleteTarget}
        onViewDeliveries={viewDeliveries}
      />
    );
  } else if (activeTab === "deliveries") {
    body = (
      <DeliveriesTab
        key={`${deliveryFocus.endpoint}-${deliveryFocus.n}`}
        deliveries={data.deliveries}
        endpoints={data.endpoints}
        health={data.health}
        canManage={canManage}
        initialEndpoint={deliveryFocus.endpoint}
        onOpen={(d) => setOpenDeliveryId(d.id)}
        onRetry={handleRetry}
        onReplay={handleReplay}
        onRefresh={refresh}
        onAddEndpoint={() => {
          setTab("webhooks");
          addEndpoint();
        }}
      />
    );
  } else {
    body = <DocsTab />;
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="API & Webhooks"
        description="Connect your own systems to this project: API keys to read events, orders and attendees or check guests in, and webhooks that push changes to your server as they happen."
        actions={headerAction}
      />

      {!canManage ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <p>
            You can see keys and deliveries, but creating keys, changing endpoints and revealing secrets needs the
            <span className="text-foreground"> Manage settings </span>
            permission.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const count = tabCounts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "relative shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === t.key ? "text-foreground" : "text-text-secondary hover:text-foreground",
              )}
            >
              {t.label}
              {count ? <span className="ml-1.5 text-xs text-text-tertiary">{count}</span> : null}
              {activeTab === t.key ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
            </button>
          );
        })}
      </div>

      {body}

      <CreateKeyDialog
        key={createKeyOpen ? "create-key-open" : "create-key-closed"}
        open={createKeyOpen}
        onOpenChange={setCreateKeyOpen}
        onCreate={handleCreateKey}
      />
      <RevokeKeyDialog apiKey={revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)} onRevoke={handleRevokeKey} />
      <EndpointDialog
        key={endpointDialog.open ? `endpoint-${endpointDialog.endpoint?.id || "new"}` : "endpoint-closed"}
        open={endpointDialog.open}
        endpoint={endpointDialog.endpoint}
        onOpenChange={(open) => setEndpointDialog((current) => ({ ...current, open }))}
        onSave={handleSaveEndpoint}
      />
      <SecretDialog
        key={secretTarget?.id || "secret-closed"}
        endpoint={secretTarget}
        canManage={canManage}
        onOpenChange={(o) => !o && setSecretTarget(null)}
        onReveal={handleReveal}
        onRotate={handleRotate}
      />
      <DeleteEndpointDialog
        endpoint={deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onDelete={handleDelete}
      />
      <DeliveryDrawer
        delivery={openDelivery}
        canManage={canManage}
        onOpenChange={(o) => !o && setOpenDeliveryId(null)}
        onRetry={handleRetry}
        onReplay={handleReplay}
      />
    </MainScreenWrapper>
  );
}

export default ApiWebhooksScreen;
