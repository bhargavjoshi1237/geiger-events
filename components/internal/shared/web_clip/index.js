// Web clip — pull a component off any public website and embed it.
//
// The module's whole public surface is two components and the clip helpers:
//
//   <WebClipDialog eventId onClip={(clip) => …} />   capture
//   <ClipContent clip />                             render
//
// A clip is a plain serialisable object (lib/clip/model.js), so a consumer
// stores it wherever its own records already live — no table, no migration.

export { WebClipDialog } from "./clip_dialog";
export { ClipContent } from "./clip_content";
export { ClipAppearance } from "./clip_appearance";
export { ClipPruner } from "./clip_pruner";
export { ElementPicker } from "./element_picker";
export {
  CLIP_BACKGROUNDS,
  CLIP_THEMES,
  clipHostLabel,
  isClipFilled,
  normalizeClip,
  removedSummary,
} from "@/lib/clip/model";
