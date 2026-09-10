# Venue display simulator

**Date:** 2026-09-10 · **Area:** Program → Display Boards → board builder

## Goal

Show a display board the way an audience will actually see it: on real venue
hardware, in a lit room, from real seats. The flat 16:9 preview answers "what
does the wall render"; the simulator answers "does it read on a center-hung from
the upper bowl / on a ribbon / on a 55" portrait kiosk".

## UX

The builder's preview gets a **Screen | In venue** toggle. "In venue" shows:

- A 3D viewport (orbit, zoom, pan) with a HUD: screen name + typical specs,
  auto-pan, show-lighting, reset view, fullscreen, "Now showing" slide.
- Viewpoint chips per screen (e.g. Floor seats / Upper bowl / Drone); switching
  flies the camera there.
- A one-line planning tip per screen, and a picker grid of the 8 screen types.

## Screen types (`lib/display/placements.js`)

| Key | Screen | Content on it |
| --- | --- | --- |
| `center_hung` | Drum center-hung + halo rings over a boxing ring (the reference photo) | Board ×4 around the drum; halos run the ticker |
| `ribbon` | 360° fascia ribbons, two tiers, basketball bowl | Ticker (Now & Next) |
| `stage` | Keynote LED wall + angled portrait IMAG screens | Board on the wall; stylised live camera feed on IMAG |
| `video_wall` | Concourse wall of 16×9 cabinets | Board with per-cabinet seams + calibration drift |
| `totem` | 55" portrait lobby kiosks | Board re-laid for 9:16 (header, board, up-next list) |
| `door_sign` | 43" LCD beside each meeting-room door | Board; room plates from the agenda's rooms |
| `marquee` | Double-sided outdoor pylon + facade ticker | Board on both faces; event name on the cap |
| `anamorphic` | Curved L-corner forced-perspective billboard | Virtual 3D room + floating board, projected from the sweet spot |

## Architecture

- **One slide renderer, still.** `lib/display/renderer.js` stays the only place
  a slide is painted. The simulator runs a `BoardPlayer` on an offscreen canvas
  and uploads it as a `CanvasTexture` at 30 fps.
- `lib/display/surfaces.js` re-lays that canvas for non-16:9 screens (portrait,
  ticker strip, IMAG feed). It draws the board canvas, never a slide.
- `components/.../display/venue/`:
  - `venue_preview.jsx` — UI shell; `next/dynamic` (ssr off) + WebGL probe +
    error boundary, same pattern as the lanyard badge.
  - `venue_scene.jsx` — Canvas, board texture provider, orbit rig with fly-to
    and idle pan, bloom (EffectComposer + UnrealBloom + OutputPass).
  - `kit.jsx` — LED shader (pixel dots fade into the image with distance via
    `fwidth`), crowd points with phone lights, volumetric beams, walkers, sky.
  - `scenes/*` — one file per venue; `outdoor.jsx` holds shared city pieces.
- Anamorphic: the virtual scene renders from the sweet-spot camera into a render
  target; the screen samples it with that camera's view-projection, so the
  illusion is exact at the sweet spot and shears anywhere else.

## Decisions

- No new dependencies: three's own OrbitControls / postprocessing, no drei.
- Idle motion is a slow pan about the target, not a full orbit — a full turn
  around an off-centre target walks the camera through walls. Per-screen or
  per-viewpoint `sway` (radians) tunes it; the sweet spot uses `hold`.
- No DB changes; placement choice is view state only.
