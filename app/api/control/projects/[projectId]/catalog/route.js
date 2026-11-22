import { MODULES, SECTIONS, catalogSections } from "@/lib/control/catalog";
import { withControl } from "@/lib/control/http";
import { publicModule } from "@/lib/control/records_engine";
import { publicSetting } from "@/lib/control/settings_engine";
import { projectPermissions } from "@/lib/control/scope";

// GET — the Manage sections this role can open, each with its modules' field definitions.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const extra = [...new Set(MODULES.map((m) => m.permission).filter(Boolean))];
    const access = await projectPermissions(ctx, projectId, [...SECTIONS.map((s) => s.permission), ...extra]);
    const allowed = new Set(SECTIONS.filter((s) => access.allowed(s.permission)).map((s) => s.key));
    return {
      sections: catalogSections(allowed).map(({ permission: _permission, modules, settings, ...section }) => ({
        ...section,
        // A module with its own stricter key only shows to roles that hold it.
        modules: modules.filter((m) => !m.permission || access.allowed(m.permission)).map(publicModule),
        settings: settings.map(publicSetting),
      })),
    };
  });
}
