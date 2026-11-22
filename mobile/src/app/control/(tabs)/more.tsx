import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { ProjectSwitcher } from "@/components/control/ProjectSwitcher";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { CAPABILITY_META } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useModeSwitch } from "@/lib/use_mode_switch";
import { useControl } from "@/state/control";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlCapability } from "@/types/portal";

const ACCESS_ORDER: ControlCapability[] = ["edit", "publish", "checkIn", "guests", "orders", "refund", "inbox", "analytics", "delete"];

export default function ControlMoreScreen() {
  const router = useRouter();
  const { status, member } = useSession();
  const { profile, project, teamEmail, signOutTeam } = useControl();
  const { toAttendee } = useModeSwitch();
  const [switching, setSwitching] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const projectCount = profile?.projects.length ?? 0;
  const access = project ? ACCESS_ORDER.filter((key) => project.can[key]) : [];

  return (
    <Screen scroll>
      <ScreenTitle title="More" />

      {project?.role ? (
        <View style={styles.group}>
          <ListRow
            leading={<IconTile icon="layers" size={34} />}
            title="Manage"
            subtitle="Program, speakers, sponsors, ticket setup and every other area your role opens"
            onPress={() => router.push("/control/manage")}
            divider={false}
          />
        </View>
      ) : null}

      <SectionTitle variant="kicker">Mode</SectionTitle>
      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="shield" size={34} tone="success" />}
          title="Control"
          subtitle="Running events for your team"
          trailing={<Pill label="Active" tone="success" />}
        />
        {status === "authed" ? (
          <ListRow
            leading={<IconTile icon="ticket" size={34} />}
            title="Switch to my tickets"
            subtitle={member?.email ? `Attendee app · ${member.email}` : "The attendee app"}
            onPress={() => void toAttendee()}
            divider={false}
          />
        ) : (
          <ListRow
            leading={<IconTile icon="ticket" size={34} />}
            title="Sign in to my tickets"
            subtitle="Use the attendee app alongside Control"
            onPress={() => router.push("/(auth)/sign-in")}
            divider={false}
          />
        )}
      </View>

      <SectionTitle variant="kicker">Project</SectionTitle>
      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="briefcase" size={34} />}
          title={project?.name ?? "No project"}
          subtitle={[project?.organizationName, project?.role?.name ?? "No role yet"].filter(Boolean).join(" · ")}
          onPress={projectCount > 1 ? () => setSwitching(true) : undefined}
          trailing={projectCount > 1 ? <Text style={styles.trailing}>{`${projectCount} ${pluralize(projectCount, "project", "projects")}`}</Text> : undefined}
          divider={Boolean(access.length)}
        />
        {access.length ? (
          <View style={styles.access}>
            {access.map((key) => (
              <Pill key={key} label={CAPABILITY_META[key].label} tone="neutral" variant="outline" dot={false} />
            ))}
          </View>
        ) : null}
      </View>

      <SectionTitle variant="kicker">Team account</SectionTitle>
      <View style={styles.group}>
        <ListRow leading={<IconTile icon="mail" size={34} />} title="Signed in to Control" subtitle={teamEmail ?? undefined} />
        <ListRow
          leading={<IconTile icon="external-link" size={34} />}
          title="Open the dashboard"
          subtitle="Page design, seating, campaigns and settings"
          onPress={() => void Linking.openURL(project ? `${SUITE_ORIGIN}/events/project/${project.id}` : SUITE_ORIGIN)}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out of Control"
          onPress={() => setConfirmOut(true)}
          chevron={false}
          divider={false}
        />
      </View>

      <ProjectSwitcher visible={switching} onClose={() => setSwitching(false)} />

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out of Control?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {status === "authed" ? "Your tickets stay signed in." : "You'll need to sign in again to use Control."}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmOut(false)} />
            <Button
              title="Sign out"
              variant="destructive"
              onPress={() => {
                setConfirmOut(false);
                void signOutTeam();
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  trailing: {
    ...type.caption,
    color: colors.textSecondary,
  },
  access: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
