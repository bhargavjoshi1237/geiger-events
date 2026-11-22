import type { StaffRolePermissions } from "@/types/control_checkin_ops";

// "Scan · Override · 2 gates/zones", the same summary the dashboard's roles table shows.
export function permSummary(p: StaffRolePermissions): string {
  const abilities = [p.canScan && "Scan", p.canSell && "Sell", p.canOverride && "Override"].filter(Boolean).join(" · ") || "No abilities";
  const scope = p.gates.length + p.zones.length;
  return `${abilities} · ${scope ? `${scope} ${scope === 1 ? "gate/zone" : "gates/zones"}` : "all areas"}`;
}
