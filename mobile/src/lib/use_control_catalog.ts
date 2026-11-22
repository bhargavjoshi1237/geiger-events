import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import type { ControlCatalog, ControlModule } from "@/types/portal";

// The Manage catalog for the active project: which sections this role can open and how each module's records look.
export function useControlCatalog() {
  const { project } = useControl();
  const query = useControlQuery<ControlCatalog>(project ? `/api/control/projects/${project.id}/catalog` : null, { refetchOnFocus: false });
  const modules = query.data?.sections.flatMap((s) => s.modules) ?? [];
  const findModule = (id: string): ControlModule | null => modules.find((m) => m.id === id) ?? null;
  return { ...query, projectId: project?.id ?? null, findModule };
}
