import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

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
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CommunityChannel, CommunityChannelKind } from "@/types/control_community";
import type { ControlEvent } from "@/types/portal";

const STATUS_TABS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const COPY: Record<CommunityChannelKind, { title: string; empty: string; emptyMessage: string }> = {
  event: {
    title: "Event chat",
    empty: "No event chats yet",
    emptyMessage: "An event's chat starts when you turn it on in the event's communication settings on the dashboard.",
  },
  qa: {
    title: "Q&A threads",
    empty: "No Q&A threads yet",
    emptyMessage: "Start a thread for an event; everyone holding a ticket can ask questions there.",
  },
};

// Event chats and Q&A threads share one list: both are chat channels, told apart by kind.
export function ChannelList({ kind }: { kind: CommunityChannelKind }) {
  const router = useRouter();
  const { project } = useControl();
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useControlQuery<{ channels: CommunityChannel[] }>(
    project ? `/api/control/community/projects/${project.id}/channels?kind=${kind}` : null,
  );
  const copy = COPY[kind];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data?.channels ?? []).filter((c) => {
      if (c.status !== status) return false;
      if (!q) return true;
      return `${c.name} ${c.eventName} ${c.topic} ${c.lastPreview}`.toLowerCase().includes(q);
    });
  }, [list.data, status, query]);

  const total = list.data?.channels.length ?? 0;

  let body: React.ReactNode;
  if (!project?.can.inbox) {
    body = <EmptyState icon="shield" title="Not available" message="Your role can't moderate community chats in this project." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title={`Couldn't load ${copy.title.toLowerCase()}`} message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!total) {
    body = (
      <EmptyState
        icon={kind === "qa" ? "message-circle-question-mark" : "message-circle"}
        title={copy.empty}
        message={copy.emptyMessage}
        actionLabel={kind === "qa" ? "Start a thread" : undefined}
        onAction={kind === "qa" ? () => setCreating(true) : undefined}
      />
    );
  } else if (!shown.length) {
    body = (
      <EmptyState
        icon="search"
        title="Nothing matches"
        message={query ? "Try another name or event." : `No ${status} ${kind === "qa" ? "threads" : "chats"}.`}
        actionLabel="Show active"
        onAction={() => {
          setQuery("");
          setStatus("active");
        }}
      />
    );
  } else {
    body = (
      <View style={styles.group}>
        {shown.map((c, i) => (
          <ListRow
            key={c.id}
            leading={<IconTile icon={kind === "qa" ? "message-circle-question-mark" : "messages-square"} size={38} />}
            title={c.name}
            subtitle={[c.eventName, c.lastPreview || "No messages yet", c.lastMessageAt ? fmtTimeAgo(c.lastMessageAt) : ""].filter(Boolean).join(" · ")}
            trailing={<Pill label={`${c.participantCount}`} tone="neutral" variant="outline" dot={false} />}
            onPress={() => router.push({ pathname: "/control/community/chat/[id]", params: { id: c.id } })}
            divider={i < shown.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title={copy.title}
          right={
            kind === "qa" && project?.can.inbox ? (
              <IconButton icon="plus" label="Start a Q&A thread" variant="solid" onPress={() => setCreating(true)} />
            ) : undefined
          }
        />
      }
    >
      {project?.can.inbox && total ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search by name or event…" autoCapitalize="none" />
          <Segmented options={STATUS_TABS} value={status} onChange={setStatus} />
        </View>
      ) : null}
      {body}
      {kind === "qa" && project ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title="Start a Q&A thread">
          <CreateThreadForm
            projectId={project.id}
            onClose={() => setCreating(false)}
            onCreated={(channel) => {
              setCreating(false);
              void list.reload();
              router.push({ pathname: "/control/community/chat/[id]", params: { id: channel.id } });
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

// Lives inside the sheet body, which remounts on every open, so each opening starts blank.
function CreateThreadForm({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: (c: CommunityChannel) => void }) {
  const toast = useToast();
  const events = useControlQuery<{ events: ControlEvent[] }>(`/api/control/projects/${projectId}/events`, { refetchOnFocus: false });
  const choices = (events.data?.events ?? []).filter((e) => e.when !== "past" || e.status !== "Ended");
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("open");
  const [busy, setBusy] = useState(false);
  const picked = eventId || choices[0]?.id || "";

  const submit = async () => {
    if (!picked) return toast.error("Pick the event this thread belongs to.");
    if (!name.trim()) return toast.error("Give the thread a name.");
    setBusy(true);
    const res = await controlApi<{ channel: CommunityChannel }>(`/api/control/community/projects/${projectId}/channels`, {
      method: "POST",
      body: { eventId: picked, name: name.trim(), topic: topic.trim(), postingMode: mode },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Thread started.");
    onCreated(res.data.channel);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Event">
          {events.loading ? (
            <SkeletonList rows={1} variant="divided" />
          ) : choices.length ? (
            <FilterChips options={choices.map((e) => ({ value: e.id, label: e.name }))} value={picked} onChange={setEventId} />
          ) : (
            <Text style={styles.note}>Create an event first.</Text>
          )}
        </Field>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Ask the panel" />
        </Field>
        <Field label="Topic (optional)">
          <Input value={topic} onChangeText={setTopic} placeholder="What this thread is for" />
        </Field>
        <Field label="Who can post">
          <Segmented
            options={[
              { value: "open", label: "Everyone" },
              { value: "announce", label: "Organisers only" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </Field>
        <Text style={styles.note}>Everyone holding a ticket to the event joins. Targeted audiences are set on the dashboard.</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Start thread" onPress={() => void submit()} loading={busy} disabled={!choices.length} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
