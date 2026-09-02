import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE } from "@/lib/api";
import { useCountdown } from "@/lib/countdown";
import { fmtDate, money, pluralize } from "@/lib/format";
import { MEMBER_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { IncludedSummary, Membership, Plan } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

const periodSuffix = (p?: string) =>
  p && p !== "one-time" ? `/${p === "monthly" ? "mo" : p === "yearly" ? "yr" : p}` : "";

export default function MembershipsScreen() {
  const router = useRouter();
  const { data, plans, counts, loading, refreshAll } = usePortalData();
  const { token } = useSession();
  const { success, error, info } = useToast();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const held = data?.memberships || [];
  const available = useMemo(() => (plans.plans || []).filter((p) => !p.held), [plans]);
  const dataLoading = data === null;

  const buy = async (plan: Plan) => {
    if (!token || busyPlanId) return;
    setBusyPlanId(plan.id);
    try {
      const returnUrl = `${API_BASE}/members/app-return`;
      const res = await api<{ enrolled?: boolean; planName?: string; url?: string }>(
        "/api/portal/membership/checkout",
        { method: "POST", token, body: { planId: plan.id, returnUrl } },
      );
      if (!res.ok) {
        error(res.error || "Couldn't start checkout.");
        return;
      }
      if (res.data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.url,
          "geigerevents://membership-return",
        );
        if (result.type === "success" && result.url) {
          const params = new URLSearchParams(
            (result.url.split("?")[1] || "").replace(/#.*$/, ""),
          );
          const sessionId = params.get("membership_session");
          const canceled = params.get("membership_canceled");
          if (sessionId) {
            const verify = await api<{ enrolled?: boolean; planName?: string }>(
              "/api/portal/membership/verify",
              { method: "POST", token, body: { sessionId } },
            );
            if (!verify.ok) {
              error(verify.error || "We couldn't confirm your membership.");
            } else if (verify.data.enrolled) {
              success(`You're now a member of ${verify.data.planName || plan.name}.`);
              void refreshAll();
            } else {
              error("We couldn't confirm your membership.");
            }
          } else if (canceled) {
            info("Checkout canceled.");
          }
        }
      } else if (res.data.enrolled) {
        success(`You're now a member of ${res.data.planName || plan.name}.`);
        void refreshAll();
      }
    } catch {
      error("Couldn't start checkout.");
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Memberships" />

      {dataLoading ? (
        <SkeletonList rows={3} />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {held.map((m, idx) => (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(stagger(idx)).springify()}
              layout={LinearTransition}
            >
              <HeldCard
                m={m}
                recordings={counts.watch || 0}
                onWatch={() => router.push("/watch")}
                onRooms={() => router.push("/live")}
              />
            </Animated.View>
          ))}

          {held.length ? (
            <View>
              <SectionTitle>What&apos;s included</SectionTitle>
              <View style={styles.card}>
                {held
                  .flatMap((m) => m.included || [])
                  .map((item, idx, all) => (
                    <IncludedRow key={`${item.key}-${idx}`} item={item} last={idx === all.length - 1} />
                  ))}
                {!held.some((m) => m.included?.length) ? (
                  <Text style={styles.emptyIncluded}>
                    Your organiser hasn&apos;t listed perks for this plan yet.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {loading.plans && !available.length ? (
            <SkeletonList rows={2} />
          ) : available.length ? (
            <View>
              <SectionTitle>{held.length ? "Upgrade" : "Join a membership"}</SectionTitle>
              <View style={styles.list}>
                {available.map((p, idx) => (
                  <Animated.View
                    key={p.id}
                    entering={FadeInDown.delay(stagger(idx)).springify()}
                    layout={LinearTransition}
                  >
                    <PlanCard
                      plan={p}
                      paymentsEnabled={plans.paymentsEnabled}
                      busy={busyPlanId === p.id}
                      upgrade={held.length > 0}
                      onBuy={() => buy(p)}
                    />
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {!held.length && !available.length && !loading.plans ? (
            <EmptyState
              icon="award"
              title="No memberships"
              message="When an organiser offers one, you'll be able to join right here — and your perks show up across the app."
            />
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

function HeldCard({
  m,
  recordings,
  onWatch,
  onRooms,
}: {
  m: Membership;
  recordings: number;
  onWatch: () => void;
  onRooms: () => void;
}) {
  const status = statusPill(MEMBER_STATUS, m.status);
  const parts = useCountdown(m.expiresAt);

  const progress = useMemo(() => {
    if (!m.startedAt || !m.expiresAt || !parts || parts.done) return 1;
    const s = new Date(m.startedAt).getTime();
    const e = new Date(m.expiresAt).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 1;
    const remaining =
      parts.days * 864e5 + parts.hours * 36e5 + parts.minutes * 6e4 + parts.seconds * 1e3;
    return Math.max(0, Math.min(1, (e - s - remaining) / (e - s)));
  }, [m.startedAt, m.expiresAt, parts]);

  const priceLine = [
    `${money(m.price)}${periodSuffix(m.billingPeriod)}`,
    m.discountPercent ? `${m.discountPercent}% off every ticket` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <LinearGradient
      colors={[colors.surfaceDialog, colors.surfaceSubtle]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={styles.held}
    >
      <View style={styles.heldHead}>
        <View style={styles.heldHeadStack}>
          {m.startedAt ? (
            <Text style={styles.heldKicker}>Member since {fmtDate(m.startedAt)}</Text>
          ) : null}
          <Text style={styles.heldName} numberOfLines={2}>
            {m.planName}
          </Text>
        </View>
        <Pill label={status.label} tone={status.tone} />
      </View>

      {priceLine ? <Text style={styles.heldPrice}>{priceLine}</Text> : null}

      {m.status === "Active" && m.expiresAt ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.heldRenews}>
            {parts && !parts.done
              ? `Renews in ${parts.days} ${pluralize(parts.days, "day", "days")} · ${fmtDate(m.expiresAt)}`
              : `Renews ${fmtDate(m.expiresAt)}`}
          </Text>
        </>
      ) : null}

      <View style={styles.heldActions}>
        <GhostAction
          icon="circle-play"
          label={
            recordings ? `${recordings} ${pluralize(recordings, "recording", "recordings")}` : "Watch"
          }
          onPress={onWatch}
        />
        <GhostAction icon="radio" label="Member rooms" onPress={onRooms} />
      </View>
    </LinearGradient>
  );
}

function GhostAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
    >
      <Icon name={icon} size={17} color={colors.foreground} />
      <Text style={styles.ghostLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function IncludedRow({ item, last }: { item: IncludedSummary; last: boolean }) {
  return (
    <View style={[styles.includedRow, !last && styles.includedDivided]}>
      <View style={styles.includedStack}>
        <Text style={styles.includedName}>{item.label}</Text>
        {item.summary || item.extras?.length ? (
          <Text style={styles.includedSummary} numberOfLines={2}>
            {item.summary || item.extras.join(" · ")}
          </Text>
        ) : null}
      </View>
      {item.duration ? <Text style={styles.includedDuration}>{item.duration}</Text> : null}
    </View>
  );
}

function PlanCard({
  plan,
  paymentsEnabled,
  busy,
  upgrade,
  onBuy,
}: {
  plan: Plan;
  paymentsEnabled: boolean;
  busy: boolean;
  upgrade: boolean;
  onBuy: () => void;
}) {
  const free = plan.price <= 0;
  const disabled = plan.held || busy || (!free && !paymentsEnabled);
  const priceLabel = free ? "Free" : `${money(plan.price)}${periodSuffix(plan.billingPeriod)}`;
  const cta = free
    ? "Join for free"
    : `${upgrade ? "Switch to" : "Join"} ${plan.name} — ${priceLabel}`;

  return (
    <View style={[styles.card, styles.planCard]}>
      <View style={styles.planHead}>
        <View style={styles.planStack}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>
            <Text style={styles.planPriceStrong}>{priceLabel}</Text>
            {plan.discountPercent ? ` · ${plan.discountPercent}% off tickets` : ""}
          </Text>
          {plan.benefits?.length ? (
            <Text style={styles.planBenefits} numberOfLines={3}>
              {plan.benefits.join(" · ")}
            </Text>
          ) : null}
        </View>
        <Icon name="star" size={18} color={colors.textTertiary} />
      </View>
      <Button title={cta} onPress={onBuy} loading={busy} disabled={disabled} fullWidth />
      {!free && !paymentsEnabled && !plan.held ? (
        <Text style={styles.offline}>Online payments aren&apos;t available right now.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  held: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.xl,
    padding: spacing.lg + 4,
  },
  heldHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heldHeadStack: {
    flex: 1,
    minWidth: 0,
  },
  heldKicker: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  heldName: {
    ...type.title,
    fontSize: 24,
    lineHeight: 28,
    color: colors.foreground,
    marginTop: spacing.sm + 2,
  },
  heldPrice: {
    ...type.body,
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  progressTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.borderMuted,
    marginTop: spacing.lg + 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.foreground,
  },
  heldRenews: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm + 2,
  },
  heldActions: {
    flexDirection: "row",
    gap: spacing.md - 2,
    marginTop: spacing.lg + 2,
  },
  ghost: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: spacing.sm,
  },
  ghostLabel: {
    ...type.label,
    flexShrink: 1,
    color: colors.foreground,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  emptyIncluded: {
    ...type.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  includedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 14,
  },
  includedDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  includedStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  includedName: {
    ...type.label,
    color: colors.foreground,
  },
  includedSummary: {
    ...type.caption,
    color: colors.textSecondary,
  },
  includedDuration: {
    ...type.caption,
    color: colors.textSecondary,
  },
  planCard: {
    paddingVertical: spacing.lg,
    gap: 14,
  },
  planHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planStack: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  planName: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  planPrice: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  planPriceStrong: {
    ...type.title,
    fontSize: 18,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  planBenefits: {
    ...type.caption,
    color: colors.textTertiary,
  },
  offline: {
    ...type.caption,
    textAlign: "center",
    color: colors.textTertiary,
  },
});
