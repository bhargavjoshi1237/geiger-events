# Geiger Events desktop

A thin Electron shell for Windows. It opens one window on the hosted Events web app (`<APP_URL>/desktop`); sign-in, the org picker and the dashboard are all web pages served by geiger-events. The shell only:

- loads the right URL, and shows a bundled offline page with a Retry button if it can't;
- registers the `geiger-events://` deep-link scheme and hands sign-in links to the page through `window.geigerDesktop` (see `preload.js`);
- keeps in-app navigation in the window and opens everything else in the system browser;
- packages a per-user NSIS installer (no admin prompt).

`APP_URL` is `GEIGER_EVENTS_URL` if set, otherwise `http://localhost:3000` when running unpackaged and `https://geiger.studio/events` in the installed app.

## Run against local dev

```bash
# repo root
npm run dev

# desktop/
npm install
npm start
```

## Run against production

```bat
:: cmd
set GEIGER_EVENTS_URL=https://geiger.studio/events
npm start
```

```powershell
# PowerShell
$env:GEIGER_EVENTS_URL="https://geiger.studio/events"
npm start
```

## Build the installer

```bash
npm run dist           # release/Geiger Events Setup 0.1.0.exe + Geiger Events 0.1.0 Portable.exe
npm run dist:portable  # just the portable exe: one file, no install, unpacks to temp on each launch
npm run dist:dir       # unpacked app in release/win-unpacked, quicker for smoke tests
npm run dist:mac       # Geiger Events 0.1.0.dmg; only works on macOS (needs Apple's hdiutil)
```

The portable exe registers `geiger-events://` to its own path on launch, so if it's moved, run it once from the new place before using browser sign-in.

The macOS build is unsigned: Gatekeeper blocks it until it's signed with an Apple Developer ID and notarized (or the user right-clicks → Open).

The installed app always points at production unless `GEIGER_EVENTS_URL` is set.

**Icon:** `build/icon.png` is the 1024x1024 Geiger mark (from `mobile/assets/images/icon.png`, with ~22% rounded, transparent corners; `assets/icon.png` is the same file for unpackaged runs); electron-builder picks it up automatically and generates the Windows `.ico`.

**SmartScreen:** builds are unsigned, so Windows shows "Windows protected your PC" on first run. Click **More info → Run anyway**. Code-signing the installer removes the warning.

## Low disk space on C:

Electron and electron-builder download a few hundred MB into caches on C: by default. Point them at D: for the current PowerShell session before installing:

```powershell
$env:ELECTRON_CACHE="D:\electron-cache"
$env:ELECTRON_BUILDER_CACHE="D:\electron-builder-cache"
$env:npm_config_cache="D:\npm-cache"
npm install
```

And write the build output to D: too:

```powershell
npx electron-builder --win --config.directories.output=D:\geiger-events-release
```

## Sign-in flow

- **Email + password** happens inside the window.
- **Google, GitHub, SSO and passkeys** open the system browser. When sign-in finishes there, the browser opens `geiger-events://auth?...`, Windows hands that to the running app (or launches it), and the shell passes it to the desktop page, which completes the sign-in.
- `geiger-events://open` just brings the app to the front.
- **App → Switch organization** (Ctrl+Shift+O) and **App → Sign out** reload the desktop page with `?switch=1` / `?signout=1`.
