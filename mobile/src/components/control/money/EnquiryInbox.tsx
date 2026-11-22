import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Fact, Facts } from "@/components/control/money/Facts";
import { ENQUIRY_STATUS, metaOf } from "@/components/control/money/meta";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import type { IconName } from "@/components/ui/icons";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime, fmtShortDay } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
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

const COPY: Record<EnquiryKind, { title: string; icon: IconName; empty: string }> = {
  packages: { title: "Package enquiries", icon: "package", empty: "Enquiries from your events' packages pages show up here." },
  sponsors: { title: "Sponsor enquiries", icon: "handshake", empty: "Interest from your sponsorship prospectus shows up here." },
};

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
    body = (
      <View style={styles.group}>
        {enquiries.map((e, i) => (
          <MoneyRow
            key={e.id}
            icon={copy.icon}
            title={e.title}
            meta={[e.subtitle, e.eventName, fmtShortDay(e.createdAt)].filter(Boolean).join(" · ")}
            status={metaOf(ENQUIRY_STATUS, e.status)}
            onPress={() => setOpenId(e.id)}
            divider={i < enquiries.length - 1}
          />
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
      <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title={open?.title ?? "Enquiry"}>
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
      <Facts>
        {enquiry.subtitle ? <Fact label={enquiry.kind === "packages" ? "Package" : "Spot"} value={enquiry.subtitle} /> : null}
        {enquiry.eventName ? <Fact label="Event" value={enquiry.eventName} /> : null}
        {enquiry.quantity != null ? <Fact label="Quantity" value={String(enquiry.quantity)} /> : null}
        {enquiry.message ? <Fact label="Message" value={enquiry.message} /> : null}
        {enquiry.answers.map((a, i) => (
          <Fact key={`${a.label}-${i}`} label={a.label} value={a.value || "—"} />
        ))}
        <Fact label="Received" value={fmtDateTime(enquiry.createdAt)} />
        <Fact label="Status" value={metaOf(ENQUIRY_STATUS, enquiry.status).label} />
      </Facts>

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

      {locked ? (
        <Text style={styles.note}>{"This enquiry became a sponsor. Change it on the dashboard."}</Text>
      ) : (
        <View style={styles.statuses}>
          {SETTABLE[enquiry.kind]
            .filter((s) => s !== enquiry.status)
            .map((s) => (
              <Button
                key={s}
                title={`Mark ${metaOf(ENQUIRY_STATUS, s).label.toLowerCase()}`}
                variant={s === "declined" ? "destructiveGhost" : "ghost"}
                onPress={() => void setStatus(s)}
                loading={busy === s}
                disabled={busy !== null}
                fullWidth
              />
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
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
    gap: spacing.xs,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
