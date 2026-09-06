import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { Countdown } from "@/components/Countdown";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
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

const periodLabel = (p?: string) =>
  p === "monthly" ? "Monthly" : p === "yearly" ? "Yearly" : p === "one-time" ? "One-time" : p || "—";

// The three attachable item types a plan can carry — see lib/memberships/entitlements.
const INCLUDED_ICON: Record<string, IconName> = {
  vod: "circle-play",
  rooms: "radio",
  discount: "tag",
};

// The countdown shows once renewal is close enough to matter.
const COUNTDOWN_DAYS = 30;

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
        <Animated.View layout={LinearTransition} style={styles.page}>
          {held.map((m, idx) => (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(stagger(idx)).springify()}
              layout={LinearTransition}
            >
              <HeldMembership
                m={m}
                recordings={counts.watch || 0}
                onWatch={() => router.push("/watch")}
                onRooms={() => router.push("/live")}
              />
            </Animated.View>
          ))}

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

// One held membership, head to toe: the poster card, the renewal countdown,
// the perks it promised, what it unlocks, and the plan's own numbers.
function HeldMembership({
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
  const parts = useCountdown(m.expiresAt);
  const active = m.status === "Active";
  const benefits = m.benefits || [];
  const included = m.included || [];
  const showCountdown =
    active && !!m.expiresAt && !!parts && !parts.done && parts.days <= COUNTDOWN_DAYS;

  return (
    <View style={styles.block}>
      <HeldCard
        m={m}
        parts={parts}
        recordings={recordings}
        onWatch={onWatch}
        onRooms={onRooms}
      />

      {showCountdown ? (
        <View>
          <SectionTitle variant="kicker">Renews in</SectionTitle>
          <Countdown dateStr={m.expiresAt} />
        </View>
      ) : null}

      {benefits.length ? (
        <View>
          <SectionTitle>Your perks</SectionTitle>
          <View style={styles.card}>
            {benefits.map((b, idx) => (
              <View
                key={`${b}-${idx}`}
                style={[styles.perkRow, idx < benefits.length - 1 && styles.divided]}
              >
                <Icon name="check" size={15} color={colors.success} />
                <Text style={styles.perkText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle>What&apos;s included</SectionTitle>
        <View style={styles.card}>
          {included.length ? (
            included.map((item, idx) => (
              <IncludedRow
                key={item.key}
                item={item}
                last={idx === included.length - 1}
                onPress={
                  item.key === "vod" ? onWatch : item.key === "rooms" ? onRooms : undefined
                }
              />
            ))
          ) : (
            <Text style={styles.emptyIncluded}>
              Your organiser hasn&apos;t listed perks for this plan yet.
            </Text>
          )}
        </View>
      </View>

      <View>
        <SectionTitle>Plan details</SectionTitle>
        <View style={styles.card}>
          <DetailRow
            icon="dollar-sign"
            label="Price"
            value={m.price > 0 ? `${money(m.price)}${periodSuffix(m.billingPeriod)}` : "Free"}
          />
          <DetailRow icon="clock" label="Billing" value={periodLabel(m.billingPeriod)} />
          {m.discountPercent ? (
            <DetailRow
              icon="tag"
              label="Ticket discount"
              value={`${m.discountPercent}% off every ticket`}
            />
          ) : null}
          <DetailRow
            icon="calendar"
            label="Member since"
            value={m.startedAt ? fmtDate(m.startedAt) : "—"}
          />
          <DetailRow
            icon="rotate-ccw"
            label={!m.expiresAt ? "Expires" : active ? "Renews" : "Ended"}
            value={m.expiresAt ? fmtDate(m.expiresAt) : "Never"}
          />
          <DetailRow
            icon="shield"
            label="Status"
            value={statusPill(MEMBER_STATUS, m.status).label}
            divider={false}
          />
        </View>
      </View>
    </View>
  );
}

function HeldCard({
  m,
  parts,
  recordings,
  onWatch,
  onRooms,
}: {
  m: Membership;
  parts: ReturnType<typeof useCountdown>;
  recordings: number;
  onWatch: () => void;
  onRooms: () => void;
}) {
  const status = statusPill(MEMBER_STATUS, m.status);

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

  // External poster links can refuse to load (hotlink protection) — hide the layer then.
  const [posterOk, setPosterOk] = useState(true);
  const poster = Boolean(m.posterUrl) && posterOk;

  return (
    <View style={styles.held}>
      <LinearGradient
        colors={[colors.surfaceDialog, colors.surfaceSubtle]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Poster sits over the gradient wash at low opacity so text stays legible. */}
      {poster ? (
        <Image
          source={{ uri: m.posterUrl }}
          contentFit="cover"
          contentPosition="center"
          transition={200}
          onError={() => setPosterOk(false)}
          style={[StyleSheet.absoluteFill, styles.heldImage]}
        />
      ) : null}

      <View style={styles.heldBody}>
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
        {m.description ? (
          <Text style={styles.heldDescription} numberOfLines={2}>
            {m.description}
          </Text>
        ) : null}

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
      </View>
    </View>
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

function IncludedRow({
  item,
  last,
  onPress,
}: {
  item: IncludedSummary;
  last: boolean;
  onPress?: () => void;
}) {
  // includedSummary() ends the summary with the duration and the row prints the
  // duration on the right — show the scope alone so it isn't said twice.
  const suffix = item.duration ? ` · ${item.duration}` : "";
  const scope =
    suffix && item.summary.endsWith(suffix)
      ? item.summary.slice(0, -suffix.length)
      : item.summary;
  const detail = scope || item.extras?.join(" · ") || "";

  const body = (
    <>
      <IconTile icon={INCLUDED_ICON[item.key] || "package"} size={34} />
      <View style={styles.includedStack}>
        <Text style={styles.includedName} numberOfLines={1}>
          {item.label}
        </Text>
        {detail ? (
          <Text style={styles.includedSummary} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {item.duration ? <Text style={styles.includedDuration}>{item.duration}</Text> : null}
      {onPress ? <Icon name="chevron-right" size={17} color={colors.textTertiary} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.includedRow,
          !last && styles.divided,
          pressed && styles.pressed,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[styles.includedRow, !last && styles.divided]}>{body}</View>;
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
  const included = plan.included || [];
  // External poster links can refuse to load (hotlink protection) — fall back to the mark then.
  const [posterOk, setPosterOk] = useState(true);
  const poster = Boolean(plan.posterUrl) && posterOk;

  return (
    <View style={[styles.card, styles.planCard]}>
      <View style={styles.planBanner}>
        {poster ? (
          <Image
            source={{ uri: plan.posterUrl }}
            contentFit="cover"
            contentPosition="center"
            transition={200}
            onError={() => setPosterOk(false)}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.planBannerFallback}>
            <Icon name="award" size={28} color={colors.textTertiary} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", colors.surfaceSubtle]}
          locations={[0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.planBody}>
        <View style={styles.planStack}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>
            <Text style={styles.planPriceStrong}>{priceLabel}</Text>
            {plan.discountPercent ? ` · ${plan.discountPercent}% off tickets` : ""}
          </Text>
        </View>
        {plan.description ? (
          <Text style={styles.planDescription} numberOfLines={3}>
            {plan.description}
          </Text>
        ) : null}

        {plan.benefits?.length ? (
          <View style={styles.benefitList}>
            {plan.benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Icon name="check" size={14} color={colors.success} />
                <Text style={styles.benefitText} numberOfLines={2}>
                  {b}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {included.length ? (
          <View style={styles.planIncluded}>
            {included.map((item) => (
              <View key={item.key} style={styles.planIncludedRow}>
                <Icon
                  name={INCLUDED_ICON[item.key] || "package"}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.planIncludedText} numberOfLines={1}>
                  {item.label}
                  {item.duration ? ` · ${item.duration}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button title={cta} onPress={onBuy} loading={busy} disabled={disabled} fullWidth />
        {!free && !paymentsEnabled && !plan.held ? (
          <Text style={styles.offline}>Online payments aren&apos;t available right now.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  block: {
    gap: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  held: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.xl,
  },
  heldImage: {
    opacity: 0.3,
  },
  heldBody: {
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
  heldDescription: {
    ...type.body,
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm + 2,
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
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md - 2,
    paddingVertical: 13,
  },
  perkText: {
    ...type.body,
    fontSize: 14,
    flex: 1,
    color: colors.foreground,
  },
  emptyIncluded: {
    ...type.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  includedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
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
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  planBanner: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceActive,
  },
  planBannerFallback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  planBody: {
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  planStack: {
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
  planDescription: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  benefitList: {
    gap: spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  benefitText: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    color: colors.foreground,
  },
  planIncluded: {
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
    paddingTop: spacing.md,
  },
  planIncludedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planIncludedText: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  offline: {
    ...type.caption,
    textAlign: "center",
    color: colors.textTertiary,
  },
});
