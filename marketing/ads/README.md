# Geiger ads

All 241 ads from the claude.ai ads design project, copied onto one page and exported as PNGs.

- `index.html`: every ad from the design's 19 pages: the six Geiger Events pages (Final Ads, Research Ads, Glass Showcase, UI Showcase, Ads Remix, Ads), New Formats, and one page per suite product (Studio, Flow, Notes, Forms, Grey, Assets, Campaign, Comms, Content, Docs, Pods, Property). It's static HTML, so open it straight in a browser. The DS components (buttons, icons, logo, inputs, switches) are baked in as the markup `@geiger/ui` rendered.
- `assets/`: Geist fonts, the `@geiger/ui` stylesheet, the textures (grain, streaks, mark, QR) and `image-slot.js`, the design tool's photo placeholder used by `research-ads/1f`.
- `png/<page>/<id>-<name>.png`: the exports. Ads are built at 540 px and exported at 2× (1080 × 1080, 1080 × 1350, 1080 × 1920). The `ads-remix/2g` carousel also gets one PNG per slide; `research-ads/1g` is already split into three cards.

## Re-render

```sh
node marketing/ads/render.mjs                     # every ad at 2×
node marketing/ads/render.mjs --scale 3           # sharper exports
node marketing/ads/render.mjs --only final-ads    # one page, or a single ad: --only ads-remix/2g
```

The script needs Chrome or Edge. It finds them in the usual install paths; otherwise set `CHROME_PATH`. It has no npm dependencies. To change an ad, edit its markup in `index.html` and run the script again.

## Photo slot

`research-ads/1f` ("A real night") is built around a photo, and the design leaves that slot empty, so it exports with the placeholder caption. Put the photo in `assets/` and add `src="assets/<file>"` to its `<image-slot>` in `index.html`, then run `--only research-ads/1f`.

## Textures

The design tool's file download is capped, so `assets/tex/streaks-light.png` and `streaks-dark.png` arrived cut off at 22% and 32% of their rows. The missing rows were rebuilt from cross-faded segments of the real rows. To match the design exactly, drop the original files from the design project's `tex/` folder in their place and re-render.
