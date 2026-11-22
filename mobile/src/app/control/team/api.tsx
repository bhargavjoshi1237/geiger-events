import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { copyToClipboard, Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { TeamApi, TeamApiKey, TeamWebhook } from "@/types/control_team";

const KEY_TONE = { active: "success", expired: "warning", revoked: "neutral" } as const;

export default function ApiScreen() {
  const { project } = useControl();
  const toast = useToast();
  const base = project ? `/api/control/team/${project.id}/api` : null;
  const api = useControlQuery<TeamApi>(base);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<TeamApiKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const data = api.data;

  const revoke = async () => {
    if (!base || !revoking) return;
    setBusy(revoking.id);
    const res = await controlApi<{ revoked: boolean }>(`${base}/keys`, { method: "DELETE", body: { id: revoking.id } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Key revoked.");
    setRevoking(null);
    void api.reload();
  };

  const toggleWebhook = async (hook: TeamWebhook, active: boolean) => {
    if (!base || busy) return;
    setBusy(hook.id);
    const res = await controlApi<{ webhook: { id: string; active: boolean } }>(`${base}/webhooks`, { method: "PATCH", body: { id: hook.id, active } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    void api.reload();
  };

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="API & Webhooks"
          right={data?.canManage ? <IconButton icon="plus" label="Create an API key" variant="plain" onPress={() => setCreating(true)} /> : undefined}
        />
      }
    >
      {api.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load API settings" message={api.error} actionLabel="Try again" onAction={() => void api.reload()} />
      ) : !data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : (
        <View>
          {!data.canManage ? <Text style={styles.note}>Only roles with Manage settings can create or revoke keys.</Text> : null}
          <Group>
            <ListRow
              leading={<IconTile icon="link" size={34} />}
              title="API base URL"
              subtitle={data.baseUrl}
              trailing={<IconButton icon="copy" label="Copy the API base URL" variant="plain" size={36} iconSize={16} onPress={() => void copyToClipboard(data.baseUrl, toast.success)} />}
              divider={false}
            />
          </Group>

          <SectionTitle variant="kicker">API keys</SectionTitle>
          {!data.keys.length ? (
            <EmptyState
              icon="key-round"
              title="No API keys yet"
              message="Keys let your own systems read events, orders and attendees."
              actionLabel={data.canManage ? "Create a key" : undefined}
              onAction={data.canManage ? () => setCreating(true) : undefined}
            />
          ) : (
            <Group>
              {data.keys.map((key, i) => (
                <ListRow
                  key={key.id}
                  leading={<IconTile icon="key-round" size={34} tone={key.status === "active" ? "neutral" : "outline"} />}
                  title={key.name}
                  subtitle={`${key.prefix}…  ·  ${key.scopes.length} permissions  ·  ${key.lastUsedAt ? `used ${fmtDate(key.lastUsedAt)}` : "never used"}${key.expiresAt ? `  ·  expires ${fmtDate(key.expiresAt)}` : ""}`}
                  trailing={<Pill label={key.status} tone={KEY_TONE[key.status]} variant="outline" />}
                  onPress={data.canManage && key.status === "active" ? () => setRevoking(key) : undefined}
                  divider={i < data.keys.length - 1}
                />
              ))}
            </Group>
          )}

          <SectionTitle variant="kicker">Webhooks</SectionTitle>
          {!data.webhooks.length ? (
            <EmptyState icon="send" title="No webhook endpoints" message="Add endpoints on the dashboard; you can pause and resume them here." />
          ) : (
            <Group>
              {data.webhooks.map((hook, i) => (
                <ListRow
                  key={hook.id}
                  title={hook.description || hook.url}
                  subtitle={[
                    hook.description ? hook.url : "",
                    `${hook.eventTypes.length} events`,
                    hook.disabledReason || (hook.failureStreak ? `${hook.failureStreak} failures in a row` : ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    <Switch value={hook.active} onValueChange={(on) => void toggleWebhook(hook, on)} label={`Send to ${hook.url}`} disabled={!data.canManage || busy !== null} />
                  }
                  divider={i < data.webhooks.length - 1}
                />
              ))}
            </Group>
          )}
        </View>
      )}

      {data && base ? (
        <>
          <Sheet visible={creating} onClose={() => setCreating(false)} title="Create an API key">
            <CreateKeyForm
              data={data}
              path={`${base}/keys`}
              onClose={() => setCreating(false)}
              onCreated={(value) => {
                setCreating(false);
                setSecret(value);
                void api.reload();
              }}
            />
          </Sheet>
          <Sheet visible={Boolean(secret)} onClose={() => setSecret(null)} title="Copy your key now">
            <View style={styles.form}>
              <Text style={styles.note}>{"This is the only time the full key is shown. Store it somewhere safe — it can't be shown again."}</Text>
              <View style={styles.secret}>
                <Text style={styles.secretText} selectable>
                  {secret}
                </Text>
              </View>
              <Button title="Copy key" icon="copy" onPress={() => secret && void copyToClipboard(secret, toast.success, "Key copied.")} fullWidth />
              <Button title="Done" variant="ghost" onPress={() => setSecret(null)} fullWidth />
            </View>
          </Sheet>
          <Sheet visible={Boolean(revoking)} onClose={() => setRevoking(null)} title={`Revoke ${revoking?.name ?? "key"}?`}>
            <View style={styles.form}>
              <Text style={styles.note}>{"Anything using this key stops working immediately. This can't be undone."}</Text>
              <View style={styles.actions}>
                <Button title="Keep it" variant="ghost" onPress={() => setRevoking(null)} />
                <Button title="Revoke" variant="destructive" onPress={() => void revoke()} loading={busy === revoking?.id} />
              </View>
            </View>
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

// Inside the sheet body, which remounts on each open, so every new key starts from a blank form.
function CreateKeyForm({ data, path, onClose, onCreated }: { data: TeamApi; path: string; onClose: () => void; onCreated: (secret: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiry, setExpiry] = useState(data.expiries[0]?.value ?? "never");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Name the key so you can tell it apart later.");
    if (!scopes.length) return toast.error("Choose at least one permission.");
    setBusy(true);
    const res = await controlApi<{ secret: string }>(path, { method: "POST", body: { name: name.trim(), scopes, expiry } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    onCreated(res.data.secret);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Warehouse sync" />
        </Field>
        <Field label="Permissions">
          {/* The sheet doesn't scroll, so the permission list scrolls inside a fixed height. */}
          <ScrollView style={styles.scopes} nestedScrollEnabled>
            {data.scopes.map((scope, i) => (
              <ListRow
                key={scope.key}
                title={scope.label}
                subtitle={scope.description}
                trailing={
                  <Switch
                    value={scopes.includes(scope.key)}
                    onValueChange={(on) => setScopes((prev) => (on ? [...prev, scope.key] : prev.filter((s) => s !== scope.key)))}
                    label={scope.label}
                  />
                }
                divider={i < data.scopes.length - 1}
              />
            ))}
          </ScrollView>
        </Field>
        <Field label="Expires">
          <FilterChips options={data.expiries} value={expiry} onChange={setExpiry} />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Create key" onPress={() => void create()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.lg,
  },
  scopes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: 260,
  },
  secret: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
  },
  secretText: {
    ...type.mono,
    color: colors.foreground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
