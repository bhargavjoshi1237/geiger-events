import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Notice } from "@/components/control/team/Notice";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsTemplate } from "@/types/control_ops";
import type { ControlEvent } from "@/types/portal";

export default function TemplatesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const list = useControlQuery<{ templates: OpsTemplate[]; canUse: boolean }>(project ? `/api/control/ops/projects/${project.id}/templates` : null);
  const [open, setOpen] = useState<OpsTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const templates = list.data?.templates ?? [];

  const use = async (template: OpsTemplate) => {
    setBusy(true);
    const res = await controlApi<{ event: ControlEvent }>(`/api/control/ops/templates/${template.id}/use`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Created a draft from "${template.name}". Set its date and venue next.`);
    setOpen(null);
    router.push({ pathname: "/control/event/[id]", params: { id: res.data.event.id } });
  };

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load templates" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!templates.length) {
    body = <EmptyState icon="layers" title="No templates yet" message="Save an event's format, capacity and summary as a template on the dashboard, then start events from it here." />;
  } else {
    body = (
      <ListGroup title={`${templates.length} ${pluralize(templates.length, "template", "templates")}`} footer="Tap one to see what it sets up and start a draft from it.">
        {templates.map((t, i) => (
          <ListRow
            key={t.id}
            leading={<IconTile icon="layers" size={36} />}
            title={t.name}
            subtitle={[t.category, t.blueprint.type, t.blueprint.capacity ? `${t.blueprint.capacity.toLocaleString("en-US")} capacity` : ""].filter(Boolean).join(" · ")}
            trailing={<Uses count={t.uses} />}
            onPress={() => setOpen(t)}
            divider={i < templates.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Templates" />}>
      <Animated.View entering={FadeInDown.springify()}>{body}</Animated.View>

      <Sheet visible={Boolean(open)} onClose={() => setOpen(null)} title={open?.name}>
        {open ? (
          <View style={styles.sheetBody}>
            {open.description ? <Text style={styles.body}>{open.description}</Text> : null}
            <ListGroup title="What it sets up">
              <DetailRow icon="radio" label="Format" value={open.blueprint.type} />
              <DetailRow icon="users" label="Capacity" value={open.blueprint.capacity ? open.blueprint.capacity.toLocaleString("en-US") : "No limit"} mono={Boolean(open.blueprint.capacity)} />
              <DetailRow icon="globe" label="Visibility" value={open.blueprint.visibility} />
              <DetailRow icon="clock" label="Time zone" value={open.blueprint.timezone} mono divider={false} />
            </ListGroup>
            {open.blueprint.summary ? <Text style={styles.caption}>{open.blueprint.summary}</Text> : null}
            {list.data?.canUse ? (
              <Button title="Create a draft event" icon="plus" onPress={() => void use(open)} loading={busy} fullWidth />
            ) : (
              <Notice text="Your role can see templates but not create events." />
            )}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

// How often a template has been used, as a small mono tally.
function Uses({ count }: { count: number }) {
  return (
    <View style={styles.uses} accessible accessibilityLabel={`Used ${count} ${pluralize(count, "time", "times")}`}>
      <Text style={styles.usesValue}>{count}</Text>
      <Text style={styles.usesLabel}>{pluralize(count, "use", "uses")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  uses: {
    alignItems: "flex-end",
  },
  usesValue: {
    ...type.mono,
    color: colors.foreground,
  },
  usesLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
