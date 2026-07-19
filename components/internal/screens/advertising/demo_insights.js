// Bundled sample ad campaigns for the landing Insights playground — lets the
// performance dashboard render populated stats + a per-platform rollup on the
// public page (no session/DB there). Shape matches what InsightsScreen reads:
// { config: { platform, spend, impressions, clicks, conversions } }, where
// platform is one of the AD_PLATFORMS values. Used only behind the `demo` prop.

export const DEMO_CAMPAIGNS = [
  { id: "demo-camp-1", module: "campaign", name: "Search — Brand", status: "Active", config: { platform: "google_ads", spend: 3200, impressions: 145000, clicks: 4200, conversions: 210 } },
  { id: "demo-camp-2", module: "campaign", name: "Search — Retargeting", status: "Active", config: { platform: "google_ads", spend: 1800, impressions: 82000, clicks: 2400, conversions: 130 } },
  { id: "demo-camp-3", module: "campaign", name: "IG Reels — Awareness", status: "Active", config: { platform: "meta_ads", spend: 2600, impressions: 210000, clicks: 6100, conversions: 180 } },
  { id: "demo-camp-4", module: "campaign", name: "FB Feed — Early bird", status: "Paused", config: { platform: "meta_ads", spend: 1400, impressions: 98000, clicks: 2900, conversions: 95 } },
  { id: "demo-camp-5", module: "campaign", name: "Display — Prospecting", status: "Active", config: { platform: "google_adsense", spend: 900, impressions: 64000, clicks: 1500, conversions: 40 } },
  { id: "demo-camp-6", module: "campaign", name: "Marketplace — Local", status: "Active", config: { platform: "facebook_marketplace", spend: 650, impressions: 38000, clicks: 1100, conversions: 55 } },
];

export default DEMO_CAMPAIGNS;
