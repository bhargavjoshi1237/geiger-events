import { createCopyService } from "./copy.js";
import { workspaceService } from "./service.js";
import { collectExtras, extrasSentence, installCarried } from "../templates/carry.js";

export const copyService = createCopyService({
  recomputeObject: (context, objectId) => workspaceService.recomputeObject(context, objectId),
  extras: { collect: collectExtras, install: installCarried, sentence: extrasSentence },
});
