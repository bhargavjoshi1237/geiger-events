import { EVENT_SETTINGS } from "@/lib/control/catalog";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope } from "@/lib/control/scope";
import { publicSetting } from "@/lib/control/settings_engine";

// GET — the event editor's sections Control can change, and whether this role may save them.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.events, { also: [CONTROL_CAPABILITIES.edit] });
    return { settings: EVENT_SETTINGS.map(publicSetting), canEdit: Boolean(scope.allowed[CONTROL_CAPABILITIES.edit]) };
  });
}
