import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
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
import { appliesTo, changesFrom, draftFrom, draftValue, fieldsOf, iconOf, statusOf, summaryLine, withValue, type Draft } from "@/lib/control_records";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlModule, ControlRecord } from "@/types/portal";

export default function RecordsListScreen() {
  const router = useRouter();
  const { module: moduleId } = useLocalSearchParams<{ module: string }>();
  const catalog = useControlCatalog();
  const mod = catalog.findModule(moduleId);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = [status !== "all" ? `status=${encodeURIComponent(status)}` : "", term ? `q=${encodeURIComponent(term)}` : ""].filter(Boolean).join("&");
  const list = useControlQuery<{ records: ControlRecord[] }>(
    mod && catalog.projectId ? `/api/control/projects/${catalog.projectId}/records/${mod.id}${params ? `?${params}` : ""}` : null,
  );
  const records = list.data?.records ?? [];

  const chips = useMemo(() => {
    if (!mod) return [];
    const options = mod.shape === "ticketing" ? [{ value: "active", label: "Active" }, { value: "inactive", label: "Off" }] : (mod.statuses ?? []).map((s) => ({ value: s.value, label: s.label }));
    return options.length ? [{ value: "all", label: "All" }, ...options] : [];
  }, [mod]);

  const filtered = status !== "all" || Boolean(term);

  let body: React.ReactNode;
  if (catalog.error && !catalog.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load this area" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />;
  } else if (!catalog.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!mod) {
    body = <EmptyState icon="shield" title="Not available" message="Your role can't open this area in this project." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title={`Couldn't load ${mod.title.toLowerCase()}`} message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!records.length) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title="Nothing matches"
        message="Try another name or status."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setStatus("all");
        }}
      />
    ) : (
      <EmptyState icon={iconOf(mod.icon)} title={`No ${mod.title.toLowerCase()} yet`} message={mod.description ?? ""} actionLabel={mod.createLabel ?? `Add ${mod.singular.toLowerCase()}`} onAction={() => setCreating(true)} />
    );
  } else {
    body = (
      <View style={styles.group}>
        {records.map((record, i) => {
          const pill = statusOf(mod, record);
          return (
            <ListRow
              key={record.id}
              leading={<IconTile icon={iconOf(mod.icon)} size={34} />}
              title={record.name}
              subtitle={summaryLine(mod, record) || undefined}
              trailing={pill ? <Pill label={pill.label} tone={pill.tone} variant="outline" /> : undefined}
              onPress={() => router.push({ pathname: "/control/records/[module]/[id]", params: { module: mod.id, id: record.id } })}
              divider={i < records.length - 1}
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
          title={mod?.title ?? "Manage"}
          right={mod ? <IconButton icon="plus" label={mod.createLabel ?? `Add ${mod.singular.toLowerCase()}`} variant="solid" onPress={() => setCreating(true)} /> : undefined}
        />
      }
    >
      {mod ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder={`Search ${mod.title.toLowerCase()}…`} autoCapitalize="none" />
          {chips.length ? <FilterChips options={chips} value={status} onChange={setStatus} /> : null}
        </View>
      ) : null}
      {body}
      {mod && catalog.projectId ? (
        <CreateSheet
          visible={creating}
          module={mod}
          projectId={catalog.projectId}
          onClose={() => setCreating(false)}
          onCreated={(record) => {
            setCreating(false);
            router.push({ pathname: "/control/records/[module]/[id]", params: { module: mod.id, id: record.id } });
          }}
        />
      ) : null}
    </Screen>
  );
}

function CreateSheet({ visible, module, projectId, onClose, onCreated }: { visible: boolean; module: ControlModule; projectId: string; onClose: () => void; onCreated: (record: ControlRecord) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={module.createLabel ?? `Add ${module.singular.toLowerCase()}`}>
      <CreateForm module={module} projectId={projectId} onClose={onClose} onCreated={onCreated} />
    </Sheet>
  );
}

// Lives inside the sheet's body, which remounts on every open, so each opening starts blank.
function CreateForm({ module, projectId, onClose, onCreated }: { module: ControlModule; projectId: string; onClose: () => void; onCreated: (record: ControlRecord) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(module, null));
  const [kind, setKind] = useState(module.kinds?.[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const keys = new Set(module.create?.length ? module.create : ["name"]);
  const fields = fieldsOf(module).filter((f) => keys.has(f.key) && appliesTo(f, kind));

  const submit = async () => {
    const body = changesFrom(module, null, draft, keys);
    if (!String(body.name ?? "").trim()) return toast.error("Give it a name.");
    if (kind) body.kind = kind;
    setBusy(true);
    const res = await controlApi<{ record: ControlRecord }>(`/api/control/projects/${projectId}/records/${module.id}`, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`${module.singular} added.`);
    onCreated(res.data.record);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        {(module.kinds?.length ?? 0) > 1 ? (
          <Field label="Type">
            <FilterChips options={module.kinds ?? []} value={kind} onChange={setKind} />
          </Field>
        ) : null}
        {fields.map((field) => (
          <FieldEditor key={field.key} field={field} statuses={module.statuses} projectId={projectId} value={draftValue(draft, field)} onChange={(v) => setDraft((d) => withValue(d, field, v))} />
        ))}
        <Text style={styles.note}>{"You can fill in the rest after it's created."}</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Create" onPress={() => void submit()} loading={busy} />
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
