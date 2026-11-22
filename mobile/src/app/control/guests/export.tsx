import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventPicker } from "@/components/control/guests/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { AttendeeExport } from "@/types/control_guests";

// The server's column order for the file, so the list reads left to right like the spreadsheet will.
const COLUMNS = ["Name", "Email", "Phone", "Status", "Party size", "Dietary", "Accessibility", "Company", "Tags", "Registered"];

const stagger = (i: number) => Math.min(i, 8) * 50;

// The event's attendee list as a CSV, built on the server and handed to the share sheet (mail, Drive, Files…).
export default function AttendeeExportScreen() {
  const { project } = useControl();
  const toast = useToast();
  const [eventId, setEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    if (!eventId) return;
    setBusy(true);
    const res = await controlApi<AttendeeExport>(`/api/control/guests/events/${eventId}/export`);
    if (!res.ok) {
      setBusy(false);
      errorFeedback();
      return toast.error(res.error);
    }
    if (!res.data.count) {
      setBusy(false);
      return toast.info("Nobody has registered for this event yet.");
    }
    try {
      const file = new File(Paths.cache, res.data.filename);
      file.create({ overwrite: true });
      file.write(res.data.csv);
      if (!(await Sharing.isAvailableAsync())) {
        errorFeedback();
        toast.error("Sharing isn't available on this device.");
        return;
      }
      successFeedback();
      await Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: res.data.filename });
    } catch {
      errorFeedback();
      toast.error("Couldn't create the file. Try again.");
    } finally {
      setBusy(false);
    }
  };

  let step = 0;
  return (
    <Screen scroll header={<ScreenHeader title="Attendee Export" />}>
      <View style={styles.stack}>
        {project ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <EventPicker projectId={project.id} value={eventId} onChange={(e) => setEventId(e.id)} />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="What's in the file" footer="One row per registration, matched to the Contact Book by email.">
            <View style={styles.columns}>
              {COLUMNS.map((column, i) => (
                <View key={column} style={styles.column}>
                  <Text style={styles.columnIndex}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={styles.columnName}>{column}</Text>
                </View>
              ))}
            </View>
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Need something else?">
            <ListRow
              leading={<IconTile icon="sliders-horizontal" size={36} tone="outline" />}
              title="Attendee Export on the dashboard"
              subtitle="Pick your own columns, a date range or several events at once."
              divider={false}
            />
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.action}>
          <Button title="Export and share CSV" icon="share" onPress={() => void exportCsv()} loading={busy} disabled={!eventId || busy} fullWidth />
          <View style={styles.privacy}>
            <Icon name="lock" size={13} color={colors.textTertiary} />
            <Text style={styles.hint}>The file goes to the app you pick. It holds personal data, so share it with care.</Text>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  column: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceActive,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  columnIndex: {
    ...type.monoSmall,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  columnName: {
    ...type.captionStrong,
    color: colors.foreground,
  },
  action: {
    gap: spacing.md,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
