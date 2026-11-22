import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { copyToClipboard, Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamAiApp, TeamAiApps } from "@/types/control_team";

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

  return (
    <Screen scroll header={<ScreenHeader title="AI Apps" right={<IconButton icon="plus" label="Add an app" variant="plain" onPress={() => setAdding(true)} />} />}>
      <Text style={styles.note}>Connect Claude, ChatGPT, Cursor and other AI apps to this project through the Geiger MCP server. Apps you add here are yours alone.</Text>
      {apps.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load AI apps" message={apps.error} actionLabel="Try again" onAction={() => void apps.reload()} />
      ) : !data ? (
        <SkeletonList rows={3} variant="divided" />
      ) : (
        <View>
          <Group>
            <ListRow
              leading={<IconTile icon="sparkles" size={34} />}
              title="MCP server URL"
              subtitle={data.serverUrl}
              trailing={<IconButton icon="copy" label="Copy the MCP server URL" variant="plain" size={36} iconSize={16} onPress={() => void copyToClipboard(data.serverUrl, toast.success)} />}
              divider={false}
            />
          </Group>
          <SectionTitle variant="kicker">Your custom apps</SectionTitle>
          {!data.apps.length ? (
            <EmptyState icon="sparkles" title="No custom apps" message="Add an app that isn't in the dashboard's list to get a client ID for it." actionLabel="Add an app" onAction={() => setAdding(true)} />
          ) : (
            <Group>
              {data.apps.map((app, i) => (
                <ListRow
                  key={app.id}
                  title={app.name}
                  subtitle={`Client ID ${app.id}${app.redirectUri ? ` · ${app.redirectUri}` : ""}`}
                  trailing={
                    <View style={styles.trailing}>
                      <IconButton icon="copy" label={`Copy ${app.name}'s client ID`} variant="plain" size={36} iconSize={16} onPress={() => void copyToClipboard(app.id, toast.success, "Client ID copied.")} />
                      <IconButton icon="trash-2" label={`Remove ${app.name}`} variant="plain" size={36} iconSize={16} onPress={() => setRemoving(app)} />
                    </View>
                  }
                  divider={i < data.apps.length - 1}
                />
              ))}
            </Group>
          )}
        </View>
      )}

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
                <Button title="Remove" variant="destructive" onPress={() => void remove()} loading={busy} />
              </View>
            </View>
          </Sheet>
        </>
      ) : null}
    </Screen>
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
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
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
