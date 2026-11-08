import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProjectSection } from "@/components/control/ProjectSection";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControl } from "@/state/control";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

export default function ControlHomeScreen() {
  const router = useRouter();
  const { status } = useSession();
  const { profile, profileError, refreshProfile, teamEmail, setMode, signOutTeam } = useControl();
  const [confirmOut, setConfirmOut] = useState(false);

  const toAttendee = async () => {
    await setMode("attendee");
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(app)/home");
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title="Control"
        right={
          status === "authed" ? (
            <Button title="My tickets" size="sm" variant="secondary" icon="credit-card" onPress={() => void toAttendee()} />
          ) : undefined
        }
      />

      {profileError && !profile ? (
        <EmptyState
          icon="circle-alert"
          title="Couldn't load your projects"
          message={profileError}
          actionLabel="Try again"
          onAction={() => void refreshProfile()}
        />
      ) : !profile ? (
        <SkeletonList rows={3} variant="card" />
      ) : !profile.projects.length ? (
        <EmptyState
          icon="briefcase"
          title="No event teams yet"
          message={`${teamEmail ?? "This account"} isn't on any project yet. Ask an organiser to invite you, then check again.`}
          actionLabel="Check again"
          onAction={() => void refreshProfile()}
        />
      ) : (
        profile.projects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            onOpenEvent={(event) => router.push({ pathname: "/control/event/[id]", params: { id: event.id } })}
          />
        ))
      )}

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="shield" size={34} />}
          title="Signed in to Control"
          subtitle={teamEmail ?? undefined}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out of Control"
          onPress={() => setConfirmOut(true)}
          chevron={false}
          divider={false}
        />
      </View>

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
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
