// Editor extension points: append { key, kinds?, HeaderAction?, CanvasOverlay?, CanvasHud?, StatusItem?, InspectorSection? } (components) here.
// Slots get { plan, doc, selectedIds, flaggedIds, space, dirty, save, apply (undoable doc change), select (focus ids) }; canvas slots also get `view` (renderer ctx). HeaderAction = Share slot.
// `kinds` limits an extension to those plan kinds (e.g. capacity tools stay off expo halls); omit it to run everywhere.
import { CAPACITY_EXTENSION } from "../capacity/editor_extension";
import { WALKTHROUGH_EXTENSION } from "../walkthrough/walkthrough_action";
import { SHARING_EXTENSION } from "../sharing/editor_collab";
import { EXPO_EXTENSION } from "../expo/booth_extension";

export const EDITOR_EXTENSIONS = [EXPO_EXTENSION, CAPACITY_EXTENSION, WALKTHROUGH_EXTENSION, SHARING_EXTENSION];

export const extensionsFor = (kind) => EDITOR_EXTENSIONS.filter((ext) => !ext.kinds || ext.kinds.includes(kind));
