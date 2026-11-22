import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
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
const RECENT_LIMIT = 8;

type Method = "qr" | "manual";
type Shown = { key: number; outcome: ControlAdmitResult; code: string; method: Method };
type OutcomeTone = "success" | "warning" | "danger";

const OUTCOME: Record<ControlAdmitResult["status"], { tone: OutcomeTone; icon: IconName; label: string }> = {
  admitted: { tone: "success", icon: "circle-check", label: "Admitted" },
  already: { tone: "warning", icon: "circle-alert", label: "Already inside" },
  blocked: { tone: "danger", icon: "circle-x", label: "Not admitted" },
  capacity: { tone: "warning", icon: "door-open", label: "At capacity" },
};

const TONE_COLOR: Record<OutcomeTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

const METHOD_LABEL: Record<string, string> = { qr: "Scanned", manual: "Typed", api: "API", door: "Door", kiosk: "Kiosk", self: "Self" };
const METHOD_ICON: Record<string, IconName> = { qr: "qr-code", manual: "keyboard" };

const count = (n: number) => n.toLocaleString("en-US");
const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const pct = expected > 0 ? Math.round((admitted / expected) * 100) : 0;
  const lastIn = stats?.recent[0];
  const outcome = shown ? OUTCOME[shown.outcome.status] : null;
  // The viewfinder and frame take the last result's colour so the door can read it at a glance.
  const tint = outcome ? TONE_COLOR[outcome.tone] : colors.primary;
  const recent = stats?.recent.slice(0, RECENT_LIMIT) ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Check-in" subtitle={hub.data?.event.name} />}>
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          {stats ? (
            <Readout
              lead={{
                label: "Inside",
                value: count(admitted),
                hint: expected > 0 ? `of ${count(expected)} · ${pct}%` : "no one expected yet",
                tone: admitted > 0 ? "success" : "neutral",
              }}
              items={[
                { label: "Expected", value: count(expected) },
                { label: "To arrive", value: count(Math.max(0, expected - admitted)) },
                { label: "Last in", value: lastIn ? fmtClock(lastIn.at) : "–" },
              ]}
            >
              {expected > 0 ? <TickMeter value={admitted} max={expected} ticks={44} height={16} label={`${admitted} of ${expected} inside`} /> : null}
            </Readout>
          ) : (
            <Skeleton height={168} radius={radius.lg} />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()} style={styles.scanner}>
          <View style={[styles.viewport, shown ? { borderColor: tint } : null]}>
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
                <View style={styles.viewfinder} pointerEvents="none">
                  <View style={[styles.corner, styles.cornerTopLeft, { borderColor: tint }]} />
                  <View style={[styles.corner, styles.cornerTopRight, { borderColor: tint }]} />
                  <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: tint }]} />
                  <View style={[styles.corner, styles.cornerBottomRight, { borderColor: tint }]} />
                </View>
                <IconButton
                  icon="flashlight"
                  label={torch ? "Turn the torch off" : "Turn the torch on"}
                  variant={torch ? "primary" : "solid"}
                  onPress={() => setTorch((on) => !on)}
                  style={styles.torch}
                />
                <View style={styles.hint} pointerEvents="none">
                  <Icon name="scan-line" size={14} color={colors.foreground} />
                  <Text style={styles.hintText}>{busy ? "Checking…" : "Point at a ticket QR"}</Text>
                </View>
              </>
            ) : (
              <View style={styles.permission}>
                <IconTile icon={permission.canAskAgain ? "camera" : "camera-off"} size={52} tone={permission.canAskAgain ? "neutral" : "warning"} />
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

          {shown && outcome ? (
            <Animated.View
              key={shown.key}
              entering={reduced ? FadeIn : FadeInDown.springify()}
              exiting={FadeOut}
              style={[styles.result, { borderColor: `${tint}59`, backgroundColor: `${tint}14` }]}
              accessibilityLiveRegion="polite"
            >
              <View style={styles.resultTop}>
                <IconTile icon={outcome.icon} size={52} tone={outcome.tone} />
                <View style={styles.resultStack}>
                  <Text style={[styles.resultKicker, { color: tint }]}>{outcome.label}</Text>
                  <Text style={styles.resultTitle}>{shown.outcome.message}</Text>
                </View>
              </View>
              {shown.outcome.name || shown.outcome.code || shown.outcome.party > 1 ? (
                <View style={styles.resultFacts}>
                  {shown.outcome.name ? (
                    <Text style={styles.resultName} numberOfLines={1}>
                      {shown.outcome.name}
                    </Text>
                  ) : null}
                  {shown.outcome.code ? <Text style={styles.resultCode}>{shown.outcome.code}</Text> : null}
                  {shown.outcome.party > 1 ? <CountBadge value={`×${shown.outcome.party}`} tone={outcome.tone} /> : null}
                </View>
              ) : null}
              {shown.outcome.status === "capacity" && shown.outcome.canOverride ? (
                <View style={styles.resultActions}>
                  <View style={styles.flex}>
                    <Button title="Dismiss" variant="secondary" size="sm" onPress={() => setShown(null)} fullWidth />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      title="Override"
                      icon="door-open"
                      size="sm"
                      onPress={() => setOverride({ code: shown.code, method: shown.method, reason: "" })}
                      fullWidth
                    />
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          <Button title="Type a code" icon="keyboard" variant="secondary" onPress={() => setTyping(true)} fullWidth />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
          {!stats ? (
            <SkeletonList rows={3} variant="divided" />
          ) : recent.length ? (
            <ListGroup title="Recent check-ins" footer="Counts and this list refresh every 10 seconds.">
              {recent.map((entry, i) => (
                <ListRow
                  key={entry.id}
                  leading={<IconTile icon={METHOD_ICON[entry.method] ?? "user-check"} size={36} />}
                  title={entry.name}
                  subtitle={[METHOD_LABEL[entry.method] ?? entry.method, entry.gate].filter(Boolean).join(" · ")}
                  trailing={
                    <View style={styles.stamp}>
                      <Text style={styles.stampTime}>{fmtClock(entry.at)}</Text>
                      {entry.code ? <Text style={styles.stampCode}>{entry.code}</Text> : null}
                    </View>
                  }
                  divider={i < recent.length - 1}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              icon="door-open"
              title="No one is in yet"
              message="Scans and typed codes show up here, newest first."
              actionLabel="Type a code"
              onAction={() => setTyping(true)}
            />
          )}
        </Animated.View>
      </View>

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
          <View style={styles.sheetNote}>
            <IconTile icon="door-open" size={36} tone="warning" />
            <Text style={styles.sheetText}>The area is full. The reason is recorded like a supervisor override at the gate.</Text>
          </View>
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

const CORNER = 30;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  scanner: {
    gap: spacing.md,
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
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "20%",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: radius.lg,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: radius.lg,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: radius.lg,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: radius.lg,
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
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
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  resultStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  resultKicker: {
    ...type.kicker,
    textTransform: "uppercase",
  },
  resultTitle: {
    ...type.heading,
    color: colors.foreground,
  },
  resultFacts: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.md,
  },
  resultName: {
    ...type.labelStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  resultCode: {
    ...type.mono,
    color: colors.mutedForeground,
  },
  resultActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stamp: {
    alignItems: "flex-end",
    gap: 2,
  },
  stampTime: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  stampCode: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sheetText: {
    ...type.body,
    flex: 1,
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
