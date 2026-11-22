import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { money, RFP_FILTERS, RFP_STATUS, deadlineLabel } from "@/components/control/sourcing/meta";
import { OptionPicker } from "@/components/control/sourcing/OptionPicker";
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
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Rfp, RfpList } from "@/types/control_sourcing";

export default function ProposalsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<RfpList>(project ? `/api/control/sourcing/projects/${project.id}/rfps` : null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const rfps = useMemo(() => list.data?.rfps ?? [], [list.data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfps.filter((r) => (status === "all" || r.status === status) && (!q || `${r.title} ${r.location} ${r.eventName}`.toLowerCase().includes(q)));
  }, [rfps, status, query]);
  const stats = list.data?.stats;

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load proposals" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!rfps.length) {
    body = (
      <EmptyState
        icon="file-text"
        title="No RFPs yet"
        message="Send one structured request to many venues, collect priced bids and award the winner."
        actionLabel="New RFP"
        onAction={() => setCreating(true)}
      />
    );
  } else if (!shown.length) {
    body = (
      <EmptyState
        icon="search"
        title="No RFPs match"
        message="Try another search or status."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setStatus("all");
        }}
      />
    );
  } else {
    body = (
      <View style={styles.group}>
        {shown.map((r, i) => {
          const meta = RFP_STATUS[r.status];
          const sub = [r.eventName, r.attendees ? `${r.attendees.toLocaleString("en-US")} pax` : "", r.invited ? `${r.responded}/${r.invited} responded` : "Not sent", r.best != null ? `Best ${money(r.best, r.currency)}` : "", r.status === "sent" ? deadlineLabel(r.responseDeadline) : ""]
            .filter(Boolean)
            .join(" · ");
          return (
            <ListRow
              key={r.id}
              leading={<IconTile icon="file-text" size={34} />}
              title={r.title}
              subtitle={sub}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => router.push({ pathname: "/control/sourcing/proposals/[id]", params: { id: r.id } })}
              divider={i < shown.length - 1}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Smart Custom Proposals"
          right={project ? <IconButton icon="plus" label="New RFP" variant="solid" onPress={() => setCreating(true)} /> : undefined}
        />
      }
    >
      {stats ? (
        <View style={styles.stats}>
          <StatTile label="Open RFPs" value={String(stats.open)} hint={`${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`} />
          <StatTile label="Awaiting" value={String(stats.waiting)} hint="No bid yet" />
          <StatTile
            label="Bids"
            value={String(stats.received)}
            hint={stats.avgVsBudget == null ? "No budget" : `${stats.avgVsBudget > 0 ? "+" : ""}${stats.avgVsBudget}% vs budget`}
          />
        </View>
      ) : null}
      {rfps.length ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search RFPs, events, locations…" autoCapitalize="none" />
          <FilterChips options={RFP_FILTERS} value={status} onChange={setStatus} />
        </View>
      ) : null}
      {body}
      {project ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title="New RFP">
          <CreateRfp
            projectId={project.id}
            events={list.data?.events ?? []}
            onClose={() => setCreating(false)}
            onCreated={(rfp) => {
              setCreating(false);
              router.push({ pathname: "/control/sourcing/proposals/[id]", params: { id: rfp.id } });
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

// Lives inside the sheet body, which remounts on every open, so each opening starts blank.
function CreateRfp({ projectId, events, onClose, onCreated }: { projectId: string; events: { id: string; name: string }[]; onClose: () => void; onCreated: (rfp: Rfp) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [attendees, setAttendees] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Give the RFP a title.");
    const body: Record<string, unknown> = { title: title.trim(), location, startDate, endDate };
    if (eventId) body.eventId = eventId;
    if (attendees.trim()) body.attendees = Number(attendees);
    setBusy(true);
    const res = await controlApi<{ rfp: Rfp }>(`/api/control/sourcing/projects/${projectId}/rfps`, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`"${res.data.rfp.title}" created as a draft.`);
    onCreated(res.data.rfp);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Title">
          <Input value={title} onChangeText={setTitle} placeholder="e.g. Spring summit — venue proposal" />
        </Field>
        <Field label="Event">
          <OptionPicker label="Event" options={events.map((e) => ({ value: e.id, label: e.name }))} value={eventId} onChange={setEventId} noneLabel="No event" />
        </Field>
        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Start date">
              <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
          <View style={styles.half}>
            <Field label="End date">
              <Input value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Attendees">
              <Input value={attendees} onChangeText={setAttendees} placeholder="0" keyboardType="number-pad" />
            </Field>
          </View>
          <View style={styles.half}>
            <Field label="Location">
              <Input value={location} onChangeText={setLocation} placeholder="City" />
            </Field>
          </View>
        </View>
        <Text style={styles.note}>It starts as a draft with two weeks for venues to respond. Add requirements and venues before sending.</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Create draft" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
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
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
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
