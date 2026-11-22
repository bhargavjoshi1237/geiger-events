import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CodeRow } from "@/components/control/team/CodeRow";
import { copyToClipboard } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamAiApp, TeamAiApps } from "@/types/control_team";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function AiAppsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const path = project ? `/api/control/team/${project.id}/ai-apps` : null;
  const apps = useControlQuery<TeamAiApps>(path);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TeamAiApp | null>(null);
  const [busy, setBusy] = useState(false);
  const data = apps.data;

  const remove = async () => {
    if (!path || !removing) return;
    setBusy(true);
    const res = await controlApi<{ removed: boolean }>(path, { method: "DELETE", body: { id: removing.id } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`${removing.name} removed.`);
    setRemoving(null);
    void apps.reload();
  };

  let body: React.ReactNode;
  if (apps.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load AI apps" message={apps.error} actionLabel="Try again" onAction={() => void apps.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={3} variant="divided" />;
  } else {
    body = (
      <>
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title="Connect" footer="Add this URL as a connector in Claude, ChatGPT, Cursor or any MCP client.">
            <CodeRow
              icon="sparkles"
              label="MCP server URL"
              value={data.serverUrl}
              onCopy={() => void copyToClipboard(data.serverUrl, toast.success)}
              copyLabel="Copy the MCP server URL"
              divider={false}
            />
          </ListGroup>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
          {!data.apps.length ? (
            <View>
              <SectionTitle variant="kicker">Your custom apps</SectionTitle>
              <EmptyState icon="sparkles" title="No custom apps" message="Add an app that isn't in the dashboard's list to get a client ID for it." actionLabel="Add an app" onAction={() => setAdding(true)} />
            </View>
          ) : (
            <ListGroup title="Your custom apps" footer="Each app signs in with its own client ID.">
              {data.apps.map((app, i) => (
                <AppRow
                  key={app.id}
                  app={app}
                  onCopy={() => void copyToClipboard(app.id, toast.success, "Client ID copied.")}
                  onRemove={() => setRemoving(app)}
                  divider={i < data.apps.length - 1}
                />
              ))}
            </ListGroup>
          )}
        </Animated.View>
      </>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="AI Apps" right={<IconButton icon="plus" label="Add an app" variant="plain" onPress={() => setAdding(true)} />} />}>
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Text style={styles.lede}>Connect Claude, ChatGPT, Cursor and other AI apps to this project through the Geiger MCP server. Apps you add here are yours alone.</Text>
        </Animated.View>
        {body}
      </View>

      {path ? (
        <>
          <Sheet visible={adding} onClose={() => setAdding(false)} title="Add an app">
            <AddAppForm
              path={path}
              onClose={() => setAdding(false)}
              onAdded={() => {
                setAdding(false);
                void apps.reload();
              }}
            />
          </Sheet>
          <Sheet visible={Boolean(removing)} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? "app"}?`}>
            <View style={styles.form}>
              <Text style={styles.note}>The app can no longer sign in with this client ID.</Text>
              <View style={styles.actions}>
                <Button title="Keep it" variant="ghost" onPress={() => setRemoving(null)} />
                <Button title="Remove app" variant="destructive" onPress={() => void remove()} loading={busy} />
              </View>
            </View>
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

// An app by name with its client ID in mono, so it can be read off and pasted into the app's settings.
function AppRow({ app, onCopy, onRemove, divider }: { app: TeamAiApp; onCopy: () => void; onRemove: () => void; divider: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <IconTile icon="sparkles" size={36} />
      <View style={styles.rowStack}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {app.name}
        </Text>
        <Text style={styles.code} numberOfLines={1} ellipsizeMode="middle" selectable>
          {app.id}
        </Text>
        {app.redirectUri || app.createdAt ? (
          <Text style={styles.facts} numberOfLines={1}>
            {[app.redirectUri, app.createdAt ? `added ${fmtDate(app.createdAt)}` : ""].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <IconButton icon="copy" label={`Copy ${app.name}'s client ID`} variant="plain" size={36} iconSize={16} onPress={onCopy} />
        <IconButton icon="trash-2" label={`Remove ${app.name}`} variant="plain" size={36} iconSize={16} onPress={onRemove} />
      </View>
    </View>
  );
}

function AddAppForm({ path, onClose, onAdded }: { path: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error("Name the app.");
    setBusy(true);
    const res = await controlApi<{ app: TeamAiApp }>(path, { method: "POST", body: { name: name.trim(), redirectUri: redirectUri.trim() } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`${res.data.app.name} added.`);
    onAdded();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Our support bot" />
        </Field>
        <Field label="Callback URL" hint="Optional. Only if the app asks for one; it must start with https://.">
          <Input value={redirectUri} onChangeText={setRedirectUri} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add app" onPress={() => void add()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
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
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    ...type.bodyStrong,
    color: colors.foreground,
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
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: -spacing.sm,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
