import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CodeRow } from "@/components/control/team/CodeRow";
import { copyToClipboard } from "@/components/control/team/Group";
import { Notice } from "@/components/control/team/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { TeamApi, TeamApiKey, TeamWebhook } from "@/types/control_team";

const KEY_META = {
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "warning" },
  revoked: { label: "Revoked", tone: "neutral" },
} as const;

const stagger = (i: number) => Math.min(i, 8) * 50;
const failing = (hook: TeamWebhook) => Boolean(hook.disabledReason || hook.failureStreak);

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

  let body: React.ReactNode;
  if (api.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load API settings" message={api.error} actionLabel="Try again" onAction={() => void api.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else {
    const activeKeys = data.keys.filter((k) => k.status === "active").length;
    const liveHooks = data.webhooks.filter((h) => h.active).length;
    const failingHooks = data.webhooks.filter(failing).length;
    let step = 0;

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            items={[
              { label: "Active keys", value: String(activeKeys), hint: `of ${data.keys.length}` },
              { label: "Webhooks on", value: String(liveHooks), hint: `of ${data.webhooks.length}` },
              { label: "Failing", value: String(failingHooks), tone: failingHooks ? "warning" : "neutral" },
            ]}
          />
        </Animated.View>

        {!data.canManage ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Notice text="Only roles with Manage settings can create or revoke keys." />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Endpoint">
            <CodeRow
              icon="link"
              label="API base URL"
              value={data.baseUrl}
              onCopy={() => void copyToClipboard(data.baseUrl, toast.success)}
              copyLabel="Copy the API base URL"
              divider={false}
            />
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          {!data.keys.length ? (
            <View>
              <SectionTitle variant="kicker">API keys</SectionTitle>
              <EmptyState
                icon="key-round"
                title="No API keys yet"
                message="Keys let your own systems read events, orders and attendees."
                actionLabel={data.canManage ? "Create a key" : undefined}
                onAction={data.canManage ? () => setCreating(true) : undefined}
              />
            </View>
          ) : (
            <ListGroup title="API keys" footer={data.canManage && activeKeys ? "Tap an active key to revoke it." : undefined}>
              {data.keys.map((key, i) => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  onPress={data.canManage && key.status === "active" ? () => setRevoking(key) : undefined}
                  divider={i < data.keys.length - 1}
                />
              ))}
            </ListGroup>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          {!data.webhooks.length ? (
            <View>
              <SectionTitle variant="kicker">Webhooks</SectionTitle>
              <EmptyState icon="send" title="No webhook endpoints" message="Add endpoints on the dashboard; you can pause and resume them here." />
            </View>
          ) : (
            <ListGroup title="Webhooks" footer="Endpoints are added on the dashboard; pause or resume them here.">
              {data.webhooks.map((hook, i) => (
                <HookRow
                  key={hook.id}
                  hook={hook}
                  disabled={!data.canManage || busy !== null}
                  onToggle={(on) => void toggleWebhook(hook, on)}
                  divider={i < data.webhooks.length - 1}
                />
              ))}
            </ListGroup>
          )}
        </Animated.View>
      </View>
    );
  }

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
      {body}

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
              {revoking ? (
                <View style={styles.secret}>
                  <Text style={styles.secretText}>{`${revoking.prefix}…`}</Text>
                </View>
              ) : null}
              <Text style={styles.note}>{"Anything using this key stops working immediately. This can't be undone."}</Text>
              <View style={styles.actions}>
                <Button title="Keep it" variant="ghost" onPress={() => setRevoking(null)} />
                <Button title="Revoke key" variant="destructive" onPress={() => void revoke()} loading={busy === revoking?.id} />
              </View>
            </View>
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

// A key by its mono prefix, with when it was last used and when it runs out.
function KeyRow({ apiKey, onPress, divider }: { apiKey: TeamApiKey; onPress?: () => void; divider: boolean }) {
  const meta = KEY_META[apiKey.status];
  const facts = [
    `${apiKey.scopes.length} ${pluralize(apiKey.scopes.length, "scope", "scopes")}`,
    apiKey.lastUsedAt ? `used ${fmtDate(apiKey.lastUsedAt)}` : "never used",
    apiKey.expiresAt ? `expires ${fmtDate(apiKey.expiresAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <IconTile icon="key-round" size={36} tone={apiKey.status === "active" ? "success" : apiKey.status === "expired" ? "warning" : "outline"} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, apiKey.status === "revoked" && styles.rowTitleMuted]} numberOfLines={1}>
            {apiKey.name}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        <Text style={styles.code} numberOfLines={1}>{`${apiKey.prefix}…`}</Text>
        <Text style={styles.facts} numberOfLines={1}>
          {facts}
        </Text>
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, divider && styles.divided]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${apiKey.name}, ${meta.label}. Revoke`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

// A failing endpoint lights amber so it reads as needing attention before anything else.
function HookRow({ hook, disabled, onToggle, divider }: { hook: TeamWebhook; disabled: boolean; onToggle: (on: boolean) => void; divider: boolean }) {
  const bad = failing(hook);
  const problem = hook.disabledReason || (hook.failureStreak ? `${hook.failureStreak} failures in a row` : "");
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <IconTile icon={bad ? "circle-alert" : "send"} size={36} tone={bad ? "warning" : hook.active ? "success" : "neutral"} />
      <View style={styles.rowStack}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {hook.description || hook.url}
        </Text>
        {hook.description ? (
          <Text style={styles.code} numberOfLines={1}>
            {hook.url}
          </Text>
        ) : null}
        <Text style={styles.facts} numberOfLines={1}>
          {`${hook.eventTypes.length} ${pluralize(hook.eventTypes.length, "event", "events")}${hook.lastSuccessAt ? ` · delivered ${fmtDate(hook.lastSuccessAt)}` : ""}`}
        </Text>
        {problem ? (
          <Text style={styles.problem} numberOfLines={2}>
            {problem}
          </Text>
        ) : null}
      </View>
      <Switch value={hook.active} onValueChange={onToggle} label={`Send to ${hook.url}`} disabled={disabled} />
    </View>
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
        <Field label={`Permissions · ${scopes.length} chosen`}>
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
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTitle: {
    ...type.bodyStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  rowTitleMuted: {
    color: colors.mutedForeground,
  },
  code: {
    ...type.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
  facts: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  problem: {
    ...type.caption,
    color: colors.warning,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  scopes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
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
