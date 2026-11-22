import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Meter } from "@/components/ui/Meter";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtClock } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused, usePoll } from "@/lib/use_poll";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAdmitResult, ControlCheckinStats, ControlEventDetail } from "@/types/portal";

const STATS_POLL_MS = 10_000;
const SAME_CODE_MS = 3_000;
const RESULT_MS = 3_500;

type Method = "qr" | "manual";
type Shown = { key: number; outcome: ControlAdmitResult; code: string; method: Method };

const OUTCOME_STYLE: Record<ControlAdmitResult["status"], { color: string; icon: IconName }> = {
  admitted: { color: colors.success, icon: "circle-check" },
  already: { color: colors.warning, icon: "circle-alert" },
  blocked: { color: colors.danger, icon: "circle-x" },
  capacity: { color: colors.warning, icon: "door-open" },
};

const METHOD_LABEL: Record<string, string> = { qr: "Scanned", manual: "Typed", api: "API", door: "Door", kiosk: "Kiosk", self: "Self" };

export default function ControlCheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduced = useReducedMotion();
  const toast = useToast();
  const focused = useAppFocused();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });
  const [permission, requestPermission] = useCameraPermissions();

  const [stats, setStats] = useState<ControlCheckinStats | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [override, setOverride] = useState<{ code: string; method: Method; reason: string } | null>(null);
  const busyRef = useRef(false);
  const lastScan = useRef<{ data: string; at: number } | null>(null);
  const shownKey = useRef(0);

  const loadStats = useCallback(async () => {
    const res = await controlApi<ControlCheckinStats>(`/api/control/events/${id}/checkin`);
    if (res.ok) setStats(res.data);
  }, [id]);

  usePoll(loadStats, STATS_POLL_MS, true);

  // A refusal with an override waits for a decision; every other result clears itself so the door keeps moving.
  useEffect(() => {
    if (!shown || (shown.outcome.status === "capacity" && shown.outcome.canOverride)) return undefined;
    const timer = setTimeout(() => setShown((current) => (current?.key === shown.key ? null : current)), RESULT_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  const show = (outcome: ControlAdmitResult, code: string, method: Method) => {
    shownKey.current += 1;
    setShown({ key: shownKey.current, outcome, code, method });
    if (outcome.status === "admitted") successFeedback();
    else errorFeedback();
  };

  const admit = async (code: string, method: Method, overrideReason?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const res = await controlApi<ControlAdmitResult>(`/api/control/events/${id}/checkin`, {
      method: "POST",
      body: { code, method, clientId: Crypto.randomUUID(), overrideReason },
    });
    busyRef.current = false;
    setBusy(false);
    if (res.ok) {
      show(res.data, code, method);
      if (res.data.status === "admitted") void loadStats();
    } else if (res.status === 404) {
      show({ status: "blocked", name: "", party: 1, message: res.error, code: "" }, code, method);
    } else {
      errorFeedback();
      toast.error(res.error);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    const last = lastScan.current;
    // The camera fires many times a second; one ticket held in frame is one attempt.
    if (busyRef.current || (last && last.data === data && now - last.at < SAME_CODE_MS)) return;
    lastScan.current = { data, at: now };
    void admit(data, "qr");
  };

  const submitTyped = () => {
    const code = typed.trim();
    if (!code) return toast.error("Type the 8-character code on the ticket.");
    setTyping(false);
    setTyped("");
    void admit(code, "manual");
  };

  const submitOverride = () => {
    if (!override) return;
    const { code, method, reason } = override;
    setOverride(null);
    setShown(null);
    void admit(code, method, reason.trim() || "Override from the app");
  };

  const paused = busy || typing || Boolean(override);
  const cameraLive = focused && permission?.granted;
  const admitted = stats?.admitted ?? 0;
  const expected = stats?.expected ?? 0;

  return (
    <Screen scroll header={<ScreenHeader title="Check-in" subtitle={hub.data?.event.name} />}>
      <View style={styles.counts}>
        {stats ? (
          <>
            <View style={styles.countsRow}>
              <Text style={styles.countsValue}>
                {admitted.toLocaleString("en-US")}
                <Text style={styles.countsOf}>{` of ${expected.toLocaleString("en-US")}`}</Text>
              </Text>
              <Text style={styles.countsLabel}>Inside</Text>
            </View>
            <Meter value={admitted} max={expected} label={`${admitted} of ${expected} inside`} />
          </>
        ) : (
          <Skeleton height={44} radius={radius.md} />
        )}
      </View>

      <View style={styles.viewport}>
        {!permission ? (
          <Skeleton height={320} radius={radius.xl} />
        ) : permission.granted ? (
          <>
            {cameraLive ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={paused ? undefined : onScanned}
              />
            ) : null}
            <View style={styles.viewfinder} pointerEvents="none" />
            <IconButton
              icon="flashlight"
              label={torch ? "Turn the torch off" : "Turn the torch on"}
              variant={torch ? "primary" : "solid"}
              onPress={() => setTorch((on) => !on)}
              style={styles.torch}
            />
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintText}>{busy ? "Checking…" : "Point at a ticket QR"}</Text>
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <IconTile icon={permission.canAskAgain ? "camera" : "camera-off"} size={48} />
            <Text style={styles.permissionTitle}>{permission.canAskAgain ? "Scan tickets with your camera" : "Camera access is off"}</Text>
            <Text style={styles.permissionText}>
              {permission.canAskAgain
                ? "Allow the camera to scan ticket QR codes at the door."
                : "Turn the camera on for Geiger Events in Settings, or type ticket codes instead."}
            </Text>
            <Button
              title={permission.canAskAgain ? "Allow camera" : "Open Settings"}
              icon={permission.canAskAgain ? "camera" : "settings"}
              size="sm"
              onPress={() => void (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            />
          </View>
        )}
      </View>

      {shown ? (
        <Animated.View
          key={shown.key}
          entering={reduced ? FadeIn : FadeInDown.springify()}
          exiting={FadeOut}
          style={[styles.result, { borderColor: OUTCOME_STYLE[shown.outcome.status].color }]}
          accessibilityLiveRegion="polite"
        >
          <Icon name={OUTCOME_STYLE[shown.outcome.status].icon} size={28} color={OUTCOME_STYLE[shown.outcome.status].color} />
          <View style={styles.resultStack}>
            <Text style={[styles.resultTitle, { color: OUTCOME_STYLE[shown.outcome.status].color }]}>{shown.outcome.message}</Text>
            {shown.outcome.name || shown.outcome.code ? (
              <Text style={styles.resultMeta} numberOfLines={1}>
                {[shown.outcome.name, shown.outcome.code].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {shown.outcome.status === "capacity" && shown.outcome.canOverride ? (
              <View style={styles.resultActions}>
                <Button title="Dismiss" variant="ghost" size="sm" onPress={() => setShown(null)} />
                <Button
                  title="Override"
                  icon="door-open"
                  size="sm"
                  onPress={() => setOverride({ code: shown.code, method: shown.method, reason: "" })}
                />
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.manual}>
        <Button title="Type a code" icon="keyboard" variant="secondary" onPress={() => setTyping(true)} fullWidth />
      </View>

      <SectionTitle variant="kicker">Recent</SectionTitle>
      {stats?.recent.length ? (
        <View style={styles.group}>
          {stats.recent.slice(0, 8).map((entry, i, list) => (
            <ListRow
              key={entry.id}
              leading={<IconTile icon={entry.method === "qr" ? "qr-code" : "user-check"} size={34} />}
              title={entry.name}
              subtitle={[entry.code, METHOD_LABEL[entry.method] ?? entry.method, entry.gate].filter(Boolean).join(" · ")}
              trailing={<Text style={styles.time}>{fmtClock(entry.at)}</Text>}
              divider={i < list.length - 1}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{stats ? "No one has been checked in yet." : "Loading…"}</Text>
      )}

      <Sheet
        visible={typing}
        onClose={() => {
          setTyping(false);
          setTyped("");
        }}
        title="Type a code"
      >
        <View style={styles.sheetBody}>
          <Field label="Ticket code" hint="The 8-character code under the ticket's QR.">
            <Input
              value={typed}
              onChangeText={setTyped}
              placeholder="3F2B9C1E"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={64}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={submitTyped}
              style={styles.codeInput}
            />
          </Field>
          <Button title="Check in" icon="door-open" onPress={submitTyped} fullWidth />
        </View>
      </Sheet>

      <Sheet visible={Boolean(override)} onClose={() => setOverride(null)} title="Admit over capacity?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>The area is full. The reason is recorded like a supervisor override at the gate.</Text>
          <Field label="Reason">
            <Input
              value={override?.reason ?? ""}
              onChangeText={(reason) => setOverride((current) => (current ? { ...current, reason } : current))}
              placeholder="e.g. Re-entry after a medical exit"
              autoFocus
            />
          </Field>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setOverride(null)} />
            <Button title="Admit anyway" icon="door-open" onPress={submitOverride} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  counts: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  countsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  countsValue: {
    ...type.display,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  countsOf: {
    ...type.heading,
    color: colors.textSecondary,
  },
  countsLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  viewport: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
    justifyContent: "center",
  },
  viewfinder: {
    position: "absolute",
    top: "18%",
    left: "18%",
    right: "18%",
    bottom: "18%",
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    opacity: 0.6,
  },
  torch: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
  },
  hint: {
    position: "absolute",
    bottom: spacing.md,
    alignSelf: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.chipScrim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  hintText: {
    ...type.captionStrong,
    color: colors.foreground,
  },
  permission: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  permissionTitle: {
    ...type.heading,
    color: colors.foreground,
    textAlign: "center",
  },
  permissionText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  result: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    padding: spacing.lg,
  },
  resultStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  resultTitle: {
    ...type.bodyStrong,
  },
  resultMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  resultActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  manual: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  time: {
    ...type.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    ...type.body,
    color: colors.textSecondary,
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
  codeInput: {
    ...type.monoLarge,
  },
});
