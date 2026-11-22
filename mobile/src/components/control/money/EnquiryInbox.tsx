import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Fact, Facts } from "@/components/control/money/Facts";
import { localDay } from "@/components/control/money/ledger";
import { ENQUIRY_STATUS, metaOf } from "@/components/control/money/meta";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { RecordHead } from "@/components/control/money/RecordHead";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import type { IconName } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { Enquiry, EnquiryKind, EnquiryStatus } from "@/types/control_money";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Won" },
  { value: "declined", label: "Declined" },
];

// A sponsor enquiry becomes "won" by filling a sponsorship spot on the dashboard, so the app never offers it.
const SETTABLE: Record<EnquiryKind, EnquiryStatus[]> = {
  packages: ["new", "contacted", "converted", "declined"],
  sponsors: ["new", "contacted", "declined"],
};

const COPY: Record<EnquiryKind, { title: string; singular: string; icon: IconName; empty: string }> = {
  packages: { title: "Package enquiries", singular: "Package enquiry", icon: "package", empty: "Enquiries from your events' packages pages show up here." },
  sponsors: { title: "Sponsor enquiries", singular: "Sponsor enquiry", icon: "handshake", empty: "Interest from your sponsorship prospectus shows up here." },
};

const OPEN: EnquiryStatus[] = ["new", "contacted"];
const stagger = (i: number) => Math.min(i, 8) * 50;

export function EnquiryInbox({ kind }: { kind: EnquiryKind }) {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const path = project ? `/api/control/money/projects/${project.id}/enquiries/${kind}${status === "all" ? "" : `?status=${status}`}` : null;
  const list = useControlQuery<{ enquiries: Enquiry[] }>(path);
  const enquiries = list.data?.enquiries ?? [];
  const open = enquiries.find((e) => e.id === openId) ?? null;
  const copy = COPY[kind];

  const replace = (next: Enquiry) =>
    list.setData((prev) => (prev ? { enquiries: prev.enquiries.map((e) => (e.id === next.id ? next : e)) } : prev));

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load enquiries" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!enquiries.length) {
    body =
      status === "all" ? (
        <EmptyState icon={copy.icon} title="No enquiries yet" message={copy.empty} />
      ) : (
        <EmptyState icon={copy.icon} title="Nothing here" message="Enquiries with this status show up here." actionLabel="Show all" onAction={() => setStatus("all")} />
      );
  } else {
    const count = (s: EnquiryStatus) => enquiries.filter((e) => e.status === s).length;
    const fresh = count("new");
    const groups = [
      { key: "open", title: "Open", rows: enquiries.filter((e) => OPEN.includes(e.status)) },
      { key: "closed", title: "Closed", rows: enquiries.filter((e) => !OPEN.includes(e.status)) },
    ].filter((g) => g.rows.length);
    let step = 0;

    body = (
      <View style={styles.stack}>
        {/* Status counts only add up on the unfiltered list. */}
        {status === "all" ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{
                label: "New",
                value: String(fresh),
                hint: fresh ? "waiting for a first reply" : `${enquiries.length} ${pluralize(enquiries.length, "enquiry", "enquiries")} in all`,
                tone: fresh ? "info" : "neutral",
              }}
              items={(["contacted", "converted", "declined"] as const).map((s) => ({ label: ENQUIRY_STATUS[s].label, value: String(count(s)) }))}
            />
          </Animated.View>
        ) : null}
        {groups.map((group) => (
          <Animated.View key={group.key} entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title={group.title} action={<CountBadge value={group.rows.length} />}>
              {group.rows.map((e, i) => (
                <MoneyRow
                  key={e.id}
                  date={localDay(e.createdAt)}
                  title={e.title}
                  meta={[e.subtitle, e.eventName].filter(Boolean).join(" · ")}
                  code={e.quantity != null ? `× ${e.quantity}` : undefined}
                  status={metaOf(ENQUIRY_STATUS, e.status)}
                  onPress={() => setOpenId(e.id)}
                  divider={i < group.rows.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title={copy.title} />}>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {body}
      <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title={copy.singular}>
        {open ? <EnquiryDetail enquiry={open} onChanged={replace} /> : null}
      </Sheet>
    </Screen>
  );
}

function EnquiryDetail({ enquiry, onChanged }: { enquiry: Enquiry; onChanged: (e: Enquiry) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<EnquiryStatus | null>(null);
  const locked = enquiry.kind === "sponsors" && enquiry.status === "converted";

  const setStatus = async (status: EnquiryStatus) => {
    setBusy(status);
    const res = await controlApi<{ enquiry: Enquiry }>(`/api/control/money/enquiries/${enquiry.kind}/${enquiry.id}`, { method: "PATCH", body: { status } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Marked ${metaOf(ENQUIRY_STATUS, status).label.toLowerCase()}.`);
    onChanged(res.data.enquiry);
  };

  return (
    <View style={styles.sheet}>
      <RecordHead
        at={enquiry.createdAt}
        title={enquiry.title}
        subtitle={[enquiry.email, enquiry.phone].filter(Boolean).join(" · ") || undefined}
        status={metaOf(ENQUIRY_STATUS, enquiry.status)}
      />

      <Facts>
        {enquiry.subtitle ? <Fact label={enquiry.kind === "packages" ? "Package" : "Spot"} value={enquiry.subtitle} /> : null}
        {enquiry.eventName ? <Fact label="Event" value={enquiry.eventName} /> : null}
        {enquiry.quantity != null ? <Fact label="Quantity" value={String(enquiry.quantity)} mono /> : null}
        {enquiry.message ? <Fact label="Message" value={enquiry.message} block /> : null}
        {enquiry.answers.map((a, i) => (
          <Fact key={`${a.label}-${i}`} label={a.label} value={a.value || "—"} />
        ))}
        <Fact label="Received" value={fmtDateTime(enquiry.createdAt)} mono />
      </Facts>

      {enquiry.email || enquiry.phone ? (
        <View style={styles.actions}>
          {enquiry.email ? (
            <View style={styles.action}>
              <Button title="Email" icon="mail" variant="secondary" onPress={() => void Linking.openURL(`mailto:${enquiry.email}`)} fullWidth />
            </View>
          ) : null}
          {enquiry.phone ? (
            <View style={styles.action}>
              <Button title="Call" icon="smartphone" variant="secondary" onPress={() => void Linking.openURL(`tel:${enquiry.phone}`)} fullWidth />
            </View>
          ) : null}
        </View>
      ) : null}

      {locked ? (
        <Text style={styles.note}>{"This enquiry became a sponsor. Change it on the dashboard."}</Text>
      ) : (
        <View>
          <SectionTitle variant="kicker">Change status</SectionTitle>
          <View style={styles.statuses}>
            {SETTABLE[enquiry.kind]
              .filter((s) => s !== enquiry.status)
              .map((s) => (
                <Button
                  key={s}
                  title={`Mark ${metaOf(ENQUIRY_STATUS, s).label.toLowerCase()}`}
                  variant={s === "declined" ? "destructiveGhost" : "secondary"}
                  onPress={() => void setStatus(s)}
                  loading={busy === s}
                  disabled={busy !== null}
                  fullWidth
                />
              ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  sheet: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  statuses: {
    gap: spacing.sm,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
