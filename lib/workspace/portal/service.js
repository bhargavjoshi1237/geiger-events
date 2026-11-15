import { createPortalReads } from "./read.js";
import { viewers as defaultViewers } from "./viewer.js";
import { createPortalWrites } from "./write.js";

// Everything the portal API does for one viewer: reads shaped by their roles, and guarded writes.
export function createPortalService({ store, workspace, viewers = defaultViewers } = {}) {
  const reads = createPortalReads({ store, workspace });
  const writes = createPortalWrites({ store, workspace, reads, rebuild: (viewer) => viewers.portal(viewer.event.id, viewer.member) });
  return { ...reads, ...writes, viewers };
}

export const portalService = createPortalService();
