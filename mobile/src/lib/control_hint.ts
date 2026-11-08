import type { RolesHint } from "@/types/portal";

// "Acme", "Acme and Beta", or "Acme, Beta and 2 more".
export function teamOrgsLabel(hint: RolesHint): string {
  const names = hint.team.organizations.map((org) => org.name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
