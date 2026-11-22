import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Sheet } from "@/components/ui/Sheet";
import { selectionFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = { visible: boolean; onClose: () => void };

// Every tab in Control reads the active project, so switching here re-scopes the whole mode.
export function ProjectSwitcher({ visible, onClose }: Props) {
  const { profile, project, setProjectId } = useControl();
  const projects = profile?.projects ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title="Projects">
      <View style={styles.list}>
        {projects.map((p, i) => {
          const selected = p.id === project?.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${p.name}${p.role ? `, ${p.role.name}` : ""}`}
              onPress={() => {
                selectionFeedback();
                setProjectId(p.id);
                onClose();
              }}
              style={({ pressed }) => [styles.row, i < projects.length - 1 && styles.divided, pressed && styles.pressed]}
            >
              <IconTile icon="briefcase" size={34} tone={selected ? "success" : "neutral"} />
              <View style={styles.stack}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[p.organizationName, p.role?.name ?? "No role yet"].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {selected ? <Icon name="check" size={18} color={colors.foreground} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...type.label,
    fontSize: 15,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
