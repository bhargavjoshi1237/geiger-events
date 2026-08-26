"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  DataTable,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import { useOptionalProject } from "@/context/project-context";
import { advertisingApi } from "@/lib/supabase/advertising";
import { DEMO_CAMPAIGNS } from "./demo_insights";
import {
  AD_PLATFORMS,
  PLATFORM_MAP,
  currency,
  compactNumber,
  ctr,
} from "./constants";

const num = (r, key) => Number(r.config?.[key]) || 0;

export function InsightsScreen({ demo = false }) {
  const [campaigns, setCampaigns] = useState(demo ? DEMO_CAMPAIGNS : []);
  const [loading, setLoading] = useState(!demo);
  const projectId = useOptionalProject()?.projectId ?? null;

  useEffect(() => {
    if (demo) return;
    let alive = true;
    advertisingApi.list(projectId, "campaign").then((rows) => {
      if (!alive) return;
      setCampaigns(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, demo]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, r) => ({
        spend: acc.spend + num(r, "spend"),
        impressions: acc.impressions + num(r, "impressions"),
        clicks: acc.clicks + num(r, "clicks"),
        conversions: acc.conversions + num(r, "conversions"),
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    );
  }, [campaigns]);

  const stats = [
    { label: "Total spend", value: currency(totals.spend), footer: "Across all campaigns" },
    { label: "Impressions", value: compactNumber(totals.impressions), footer: "Times shown" },
    { label: "Clicks", value: compactNumber(totals.clicks), footer: `CTR ${ctr(totals.impressions, totals.clicks)}` },
    { label: "Conversions", value: compactNumber(totals.conversions), footer: "Goal completions" },
  ];

  const perPlatform = useMemo(() => {
    return AD_PLATFORMS.map((p) => {
      const rows = campaigns.filter((r) => r.config?.platform === p.value);
      const spend = rows.reduce((s, r) => s + num(r, "spend"), 0);
      const impressions = rows.reduce((s, r) => s + num(r, "impressions"), 0);
      const clicks = rows.reduce((s, r) => s + num(r, "clicks"), 0);
      const conversions = rows.reduce((s, r) => s + num(r, "conversions"), 0);
      return { platform: p.value, count: rows.length, spend, impressions, clicks, conversions };
    }).filter((row) => row.count > 0);
  }, [campaigns]);

  const columns = [
    {
      key: "platform",
      header: "Platform",
      render: (r) => <StatusPill status={r.platform} map={PLATFORM_MAP} />,
    },
    { key: "count", header: "Campaigns", align: "right", className: "text-right tabular-nums", render: (r) => r.count },
    { key: "spend", header: "Spend", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => currency(r.spend) },
    { key: "impressions", header: "Impressions", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => compactNumber(r.impressions) },
    { key: "clicks", header: "Clicks", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => compactNumber(r.clicks) },
    { key: "ctr", header: "CTR", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => ctr(r.impressions, r.clicks) },
    { key: "conversions", header: "Conversions", align: "right", className: "text-right tabular-nums text-muted-foreground", render: (r) => compactNumber(r.conversions) },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Insights"
        description="How your paid campaigns are performing across every connected platform, in one view."
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading insights…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={BarChart3}
            title="No campaign data yet"
            description="Create campaigns in Ad Campaigns and their spend, clicks, and conversions roll up here."
          />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />
          <SectionCard
            title="By platform"
            description="Spend and performance split across your connected ad channels."
          >
            <DataTable
              columns={columns}
              data={perPlatform}
              getRowKey={(r) => r.platform}
            />
          </SectionCard>
        </>
      )}
    </MainScreenWrapper>
  );
}

export default InsightsScreen;
