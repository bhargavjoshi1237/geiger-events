import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EventPicker } from "@/components/control/guests/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { AttendeeExport } from "@/types/control_guests";

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

  return (
    <Screen scroll header={<ScreenHeader title="Attendee Export" />}>
      <View style={styles.stack}>
        {project ? <EventPicker projectId={project.id} value={eventId} onChange={(e) => setEventId(e.id)} /> : null}
        <View style={styles.card}>
          <Text style={styles.title}>What&apos;s in the file</Text>
          <Text style={styles.meta}>
            Name, email, phone, status, party size, dietary and access needs, company, tags and registration date — one row per registration,
            matched to the Contact Book by email.
          </Text>
          <Text style={styles.meta}>
            For a custom set of columns, a date range or several events at once, use Attendee Export on the dashboard.
          </Text>
        </View>
        <Button title="Export and share CSV" icon="share" onPress={() => void exportCsv()} loading={busy} disabled={!eventId || busy} fullWidth />
        <Text style={styles.hint}>The file goes to the app you pick. It holds personal data, so share it with care.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
