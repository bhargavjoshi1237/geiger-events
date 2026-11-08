# Geiger Events ads

All 65 ads from the claude.ai design project "Geiger Events Ads", copied onto one page and exported as PNGs.

- `index.html`: every ad from the five design pages (Final Ads, Glass Showcase, UI Showcase, Ads Remix, Ads). It's static HTML, so open it straight in a browser. The DS components (buttons, icons, logo, inputs, switches) are baked in as the markup `@geiger/ui` rendered.
- `assets/`: Geist fonts, the `@geiger/ui` stylesheet and the textures (grain, streaks, mark, QR).
- `png/<page>/<id>-<name>.png`: the exports. Ads are built at 540 px and exported at 2× (1080 × 1080, 1080 × 1350, 1080 × 1920). The `ads-remix/2g` carousel also gets one PNG per slide.

## Re-render

```sh
node marketing/ads/render.mjs                     # every ad at 2×
node marketing/ads/render.mjs --scale 3           # sharper exports
node marketing/ads/render.mjs --only final-ads    # one page, or a single ad: --only ads-remix/2g
```

The script needs Chrome or Edge. It finds them in the usual install paths; otherwise set `CHROME_PATH`. It has no npm dependencies. To change an ad, edit its markup in `index.html` and run the script again.

## Textures

The design tool's file download is capped, so `assets/tex/streaks-light.png` and `streaks-dark.png` arrived cut off at 22% and 32% of their rows. The missing rows were rebuilt from cross-faded segments of the real rows. To match the design exactly, drop the original files from the design project's `tex/` folder in their place and re-render.
