import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { money, RFP_FILTERS, RFP_STATUS, deadlineLabel } from "@/components/control/sourcing/meta";
import { OptionPicker } from "@/components/control/sourcing/OptionPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { Rfp, RfpList, RfpListRow } from "@/types/control_sourcing";

const stagger = (i: number) => Math.min(i, 8) * 50;

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
      <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
        <ListGroup title={`${shown.length} ${pluralize(shown.length, "RFP", "RFPs")}`}>
          {shown.map((r, i) => (
            <RfpRow
              key={r.id}
              rfp={r}
              onPress={() => router.push({ pathname: "/control/sourcing/proposals/[id]", params: { id: r.id } })}
              divider={i < shown.length - 1}
            />
          ))}
        </ListGroup>
      </Animated.View>
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
      <View style={styles.stack}>
        {stats ? (
          <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
            <Readout
              lead={{ label: "Open RFPs", value: String(stats.open), hint: `${stats.drafts} ${pluralize(stats.drafts, "draft", "drafts")}` }}
              items={[
                { label: "Awaiting", value: String(stats.waiting), hint: "No bid yet", tone: stats.waiting ? "warning" : "neutral" },
                { label: "Bids in", value: String(stats.received) },
                {
                  label: "Vs budget",
                  value: stats.avgVsBudget == null ? "—" : `${stats.avgVsBudget > 0 ? "+" : ""}${stats.avgVsBudget}%`,
                  hint: stats.avgVsBudget == null ? "No budget set" : "Average bid",
                  tone: stats.avgVsBudget != null && stats.avgVsBudget > 0 ? "warning" : "neutral",
                },
              ]}
            />
          </Animated.View>
        ) : null}
        {rfps.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()} style={styles.controls}>
            <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search RFPs, events, locations…" autoCapitalize="none" />
            <FilterChips options={RFP_FILTERS} value={status} onChange={setStatus} />
          </Animated.View>
        ) : null}
        {body}
      </View>
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

// An RFP in the list: venues that bid against those invited on the tick scale, then the best bid and deadline in mono.
function RfpRow({ rfp: r, onPress, divider }: { rfp: RfpListRow; onPress: () => void; divider: boolean }) {
  const meta = RFP_STATUS[r.status];
  const context = [r.eventName, r.location, r.attendees ? `${r.attendees.toLocaleString("en-US")} pax` : ""].filter(Boolean).join(" · ");
  const deadline = r.status === "sent" ? deadlineLabel(r.responseDeadline) : "";
  const late = deadline.startsWith("Deadline passed") || deadline === "Due today";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${meta.label}${r.invited ? `, ${r.responded} of ${r.invited} responded` : ""}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <IconTile icon={r.status === "awarded" ? "award" : "file-text"} size={40} tone={r.status === "awarded" ? "success" : "neutral"} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {r.title}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        {context ? (
          <Text style={styles.context} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
        {r.invited ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={r.responded} max={r.invited} ticks={24} height={9} tone="info" label={`${r.responded} of ${r.invited} venues responded`} />
            </View>
            <Text style={styles.count}>
              {r.responded}
              <Text style={styles.countOf}>{`/${r.invited} bids`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.quiet}>Not sent yet</Text>
        )}
        {r.best != null || deadline ? (
          <View style={styles.figures}>
            {r.best != null ? <Text style={styles.best}>{`Best ${money(r.best, r.currency)}`}</Text> : null}
            {deadline ? (
              <View style={styles.deadline}>
                <Icon name="clock" size={12} color={late ? colors.warning : colors.textSecondary} />
                <Text style={[styles.deadlineText, late && styles.late]}>{deadline}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
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
        <View style={styles.pair}>
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
        <View style={styles.pair}>
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
  stack: {
    gap: spacing.xl,
  },
  controls: {
    gap: spacing.md,
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
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  context: {
    ...type.caption,
    color: colors.textSecondary,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: 3,
  },
  meter: {
    flex: 1,
  },
  count: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.foreground,
  },
  countOf: {
    color: colors.textTertiary,
  },
  quiet: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  figures: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  best: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  deadline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  deadlineText: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  late: {
    color: colors.warning,
  },
  form: {
    gap: spacing.lg,
  },
  pair: {
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
