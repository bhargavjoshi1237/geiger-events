import { WorkspaceError } from "../errors.js";
import { copyService } from "../server/copy_instance.js";
import { commandSender } from "../server/send.js";
import { workspaceStore } from "../server/store.js";
import { services } from "./carry.js";
import { BUILTIN_TEMPLATES, builtinTemplate } from "./catalog.js";
import { installExtras, installMaps, templateSnapshot, templateSummary } from "./installer.js";

// The built-in template gallery: what each contains, and installing one (again, to fill in what's missing).
const send = commandSender(workspaceStore);

export const templateService = {
  builtins: () => BUILTIN_TEMPLATES.map(templateSummary),

  async install(context, key) {
    const template = builtinTemplate(key);
    if (!template) throw new WorkspaceError("not_found", 404, "That template doesn't exist.");
    const definition = await workspaceStore.definition(context);
    if (!definition.workspace) await send(context, "workspace.create", { createdFrom: { kind: "builtin", key: template.key } });
    const keys = await copyService.applySnapshot(context, templateSnapshot(template));
    const result = await installExtras(context, template.extras ?? {}, installMaps(keys, context.principal.id), services);
    return { template: template.name, ...result };
  },
};
