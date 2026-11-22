import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { ProjectSwitcher } from "@/components/control/ProjectSwitcher";
import { ModeSwitch } from "@/components/ModeSwitch";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { CAPABILITY_META } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
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
  const canSwitchProject = projectCount > 1;

  return (
    <Screen scroll>
      <ScreenTitle title="More" />

      <View style={styles.stack}>
        <View style={styles.identity}>
          <Pressable
            accessibilityRole={canSwitchProject ? "button" : undefined}
            accessibilityLabel={canSwitchProject ? `${project?.name ?? "Project"}. Switch project` : project?.name ?? "No project"}
            disabled={!canSwitchProject}
            onPress={() => {
              tapFeedback();
              setSwitching(true);
            }}
            style={({ pressed }) => [styles.identityTop, pressed && styles.pressed]}
          >
            <Avatar name={project?.name ?? "Control"} size={52} shape="square" />
            <View style={styles.identityText}>
              <Text style={styles.projectName} numberOfLines={1}>
                {project?.name ?? "No project yet"}
              </Text>
              <Text style={styles.org} numberOfLines={1}>
                {project?.organizationName ?? (teamEmail || "Event team")}
              </Text>
            </View>
            {canSwitchProject ? (
              <View style={styles.switchHint}>
                <Text style={styles.switchCount}>{`${projectCount} ${pluralize(projectCount, "project", "projects")}`}</Text>
                <Icon name="chevrons-up-down" size={16} color={colors.textSecondary} />
              </View>
            ) : null}
          </Pressable>
          {project ? (
            <View style={styles.roleBlock}>
              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>Role</Text>
                <Text style={styles.roleName}>{project.role?.name ?? "No role yet"}</Text>
              </View>
              {access.length ? (
                <View style={styles.access}>
                  {access.map((key) => (
                    <View key={key} style={styles.chip}>
                      <Icon name={CAPABILITY_META[key].icon} size={12} color={colors.mutedForeground} />
                      <Text style={styles.chipText}>{CAPABILITY_META[key].label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.roleNote}>Ask a project admin to give your role access to events.</Text>
              )}
            </View>
          ) : null}
        </View>

        <View>
          <SectionTitle variant="kicker">Mode</SectionTitle>
          <ModeSwitch
            active="control"
            control={{ icon: "shield", title: "Control", detail: "Run events for your team" }}
            attendee={
              status === "authed"
                ? { icon: "ticket", title: "My tickets", detail: member?.email ?? "The attendee app", onPress: () => void toAttendee() }
                : { icon: "ticket", title: "My tickets", detail: "Sign in to see your passes", onPress: () => router.push("/(auth)/sign-in") }
            }
          />
        </View>

        <ListGroup title="Workspace">
          {project?.role ? (
            <ListRow
              leading={<IconTile icon="layout-grid" size={36} />}
              title="Manage"
              subtitle="Program, speakers, sponsors, ticket setup and every area your role opens"
              onPress={() => router.push("/control/manage")}
            />
          ) : null}
          <ListRow
            leading={<IconTile icon="external-link" size={36} />}
            title="Open the dashboard"
            subtitle="Page design, seating charts and display boards"
            onPress={() => void Linking.openURL(project ? `${SUITE_ORIGIN}/events/project/${project.id}` : SUITE_ORIGIN)}
            divider={false}
          />
        </ListGroup>

        <ListGroup title="Team account">
          <ListRow leading={<IconTile icon="mail" size={36} />} title="Signed in to Control" subtitle={teamEmail ?? undefined} />
          <ListRow
            leading={<IconTile icon="log-out" size={36} tone="danger" />}
            title="Sign out of Control"
            onPress={() => setConfirmOut(true)}
            chevron={false}
            divider={false}
          />
        </ListGroup>
      </View>

      <ProjectSwitcher visible={switching} onClose={() => setSwitching(false)} />

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out of Control?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>{status === "authed" ? "Your tickets stay signed in." : "You'll need to sign in again to use Control."}</Text>
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
  stack: {
    gap: spacing.xl,
  },
  identity: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  projectName: {
    ...type.heading,
    color: colors.foreground,
  },
  org: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  switchHint: {
    alignItems: "flex-end",
    gap: 2,
  },
  switchCount: {
    ...type.micro,
    color: colors.textTertiary,
  },
  roleBlock: {
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    padding: spacing.lg,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  roleLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  roleName: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  roleNote: {
    ...type.caption,
    color: colors.textSecondary,
  },
  access: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    ...type.micro,
    color: colors.mutedForeground,
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
