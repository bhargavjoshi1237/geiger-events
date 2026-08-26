import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition, useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE } from "@/lib/api";
import { useCountdown } from "@/lib/countdown";
import { fmtDate, money } from "@/lib/format";
import { MEMBER_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { IncludedSummary, Membership, Plan } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

const periodSuffix = (p?: string) =>
  p && p !== "one-time"
    ? `/${p === "monthly" ? "mo" : p === "yearly" ? "yr" : p}`
    : "";

export default function MembershipsScreen() {
  const { data, plans, loading, refreshing, refreshAll } = usePortalData();
  const { token } = useSession();
  const { success, error, info } = useToast();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const scrollY = useSharedValue(0);

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
        const result = await WebBrowser.openAuthSessionAsync(res.data.url, "geigerevents://membership-return");
        if (result.type === "success" && result.url) {
          const params = new URLSearchParams((result.url.split("?")[1] || "").replace(/#.*$/, ""));
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
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader
        title="Memberships"
        subtitle="Your memberships, their benefits and renewal dates — and plans you can join."
        scrollY={scrollY}
      />

      {dataLoading ? (
        <SkeletonList rows={3} />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {held.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
              <SectionTitle>Your memberships</SectionTitle>
              <View style={styles.list}>
                {held.map((m, idx) => (
                  <Animated.View key={m.id} entering={FadeInDown.delay(stagger(idx)).springify()} layout={LinearTransition}>
                    <HeldCard m={m} />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {loading.plans ? (
            <SkeletonList rows={2} />
          ) : available.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
              <SectionTitle>{held.length ? "Available memberships" : "Join a membership"}</SectionTitle>
              <View style={styles.list}>
                {available.map((p, idx) => (
                  <Animated.View key={p.id} entering={FadeInDown.delay(stagger(idx)).springify()} layout={LinearTransition}>
                    <PlanCard
                      plan={p}
                      paymentsEnabled={plans.paymentsEnabled}
                      busy={busyPlanId === p.id}
                      onBuy={() => buy(p)}
                    />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {!held.length && !available.length && !loading.plans ? (
            <EmptyState
              icon="check-circle"
              title="No memberships"
              message="Memberships you hold will appear here. When an organizer offers one, you'll be able to join right from this page."
            />
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

function HeldCard({ m }: { m: Membership }) {
  const status = statusPill(MEMBER_STATUS, m.status);
  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadStack}>
          <Text style={styles.cardTitle}>{m.planName}</Text>
          <Text style={styles.cardSub}>
            {money(m.price)}
            {periodSuffix(m.billingPeriod)}
            {m.discountPercent ? ` · ${m.discountPercent}% member discount` : ""}
          </Text>
        </View>
        <Pill label={status.label} tone={status.tone} />
      </View>

      {m.description ? <Text style={styles.cardBody}>{m.description}</Text> : null}

      {m.benefits?.length ? (
        <View style={styles.benefits}>
          {m.benefits.map((b, i) => (
            <View key={i} style={styles.benefit}>
              <Feather name="check" size={14} color={colors.success} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Included items={m.included} />

      <View style={styles.footRow}>
        {m.startedAt ? <Text style={styles.footText}>Since {fmtDate(m.startedAt)}</Text> : null}
        {m.expiresAt ? (
          <Text style={styles.footText}> · Renews {fmtDate(m.expiresAt)}</Text>
        ) : null}
      </View>
      {m.status === "Active" && m.expiresAt ? <RenewalBar m={m} /> : null}
    </Card>
  );
}

function RenewalBar({ m }: { m: Membership }) {
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

  return (
    <View style={styles.renewBlock}>
      {parts && !parts.done ? (
        <View style={styles.renewsRow}>
          <Feather name="clock" size={12} color={colors.textTertiary} />
          <Text style={styles.renewsText}>
            Renews in {parts.days} {parts.days === 1 ? "day" : "days"}
          </Text>
        </View>
      ) : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function PlanCard({
  plan,
  paymentsEnabled,
  busy,
  onBuy,
}: {
  plan: Plan;
  paymentsEnabled: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  const free = plan.price <= 0;
  const disabled = plan.held || busy || (!free && !paymentsEnabled);
  const label = plan.held
    ? "Current plan"
    : free
      ? "Join for free"
      : `Join — ${money(plan.price)}${periodSuffix(plan.billingPeriod)}`;

  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadStack}>
          <Text style={styles.cardTitle}>{plan.name}</Text>
          <View style={styles.cardSubRow}>
            <Text style={styles.cardPrice}>{free ? "Free" : money(plan.price)}</Text>
            {!free ? <Text style={styles.cardPeriod}>{periodSuffix(plan.billingPeriod)}</Text> : null}
            {plan.discountPercent ? (
              <Text style={styles.cardPeriod}> · {plan.discountPercent}% off tickets</Text>
            ) : null}
          </View>
        </View>
        {plan.held ? (
          <Pill label="Held" tone="warning" />
        ) : (
          <Feather name="star" size={16} color={colors.textTertiary} />
        )}
      </View>

      {plan.description ? <Text style={styles.cardBody}>{plan.description}</Text> : null}

      {plan.benefits?.length ? (
        <View style={styles.benefits}>
          {plan.benefits.map((b, i) => (
            <View key={i} style={styles.benefit}>
              <Feather name="check" size={14} color={colors.success} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Included items={plan.included} />

      <Button title={label} onPress={onBuy} loading={busy} disabled={disabled} fullWidth />
      {!free && !paymentsEnabled && !plan.held ? (
        <Text style={styles.paymentsOffline}>Online payments aren&apos;t available right now.</Text>
      ) : null}
    </Card>
  );
}

function Included({ items }: { items: IncludedSummary[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.included}>
      <Text style={styles.includedTitle}>What&apos;s included</Text>
      {items.map((i) => (
        <View key={i.key} style={styles.includedItem}>
          <View style={styles.includedHead}>
            <Text style={styles.includedName}>{i.label}</Text>
            <Text style={styles.includedDuration}>{i.duration}</Text>
          </View>
          {i.extras?.length ? (
            <Text style={styles.includedExtras}>{i.extras.join(" · ")}</Text>
          ) : null}
        </View>
      ))}
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
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardHeadStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  cardSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
  cardBody: {
    ...type.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  benefits: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  benefitText: {
    ...type.caption,
    flexShrink: 1,
    color: colors.mutedForeground,
  },
  footRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    marginTop: spacing.md,
  },
  footText: {
    ...type.caption,
    color: colors.textTertiary,
  },
  renewBlock: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  renewsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  renewsText: {
    ...type.caption,
    color: colors.textTertiary,
  },
  progressTrack: {
    height: 3,
    overflow: "hidden",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.pill,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  cardSubRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 2,
  },
  cardPrice: {
    ...type.body,
    fontWeight: "600",
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  cardPeriod: {
    ...type.caption,
    color: colors.textTertiary,
  },
  included: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  includedTitle: {
    ...type.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  includedItem: {
    gap: 2,
  },
  includedHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  includedName: {
    ...type.caption,
    color: colors.foreground,
  },
  includedDuration: {
    ...type.caption,
    color: colors.textSecondary,
  },
  includedExtras: {
    ...type.caption,
    color: colors.textTertiary,
  },
  paymentsOffline: {
    ...type.caption,
    textAlign: "center",
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
});
