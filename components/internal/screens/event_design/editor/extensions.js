// Editor extension points: append { key, HeaderAction?, CanvasOverlay?, CanvasHud?, StatusItem?, InspectorSection? } (components) here.
// Slots get { plan, doc, selectedIds, flaggedIds, space, dirty, save, apply (undoable doc change), select (focus ids) }; canvas slots also get `view` (renderer ctx). HeaderAction = Share slot.
import { CAPACITY_EXTENSION } from "../capacity/editor_extension";
import { WALKTHROUGH_EXTENSION } from "../walkthrough/walkthrough_action";
import { SHARING_EXTENSION } from "../sharing/editor_collab";

export const EDITOR_EXTENSIONS = [CAPACITY_EXTENSION, WALKTHROUGH_EXTENSION, SHARING_EXTENSION];
