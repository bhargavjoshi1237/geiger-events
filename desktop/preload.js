const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preloads can't reach `app`, so main passes the version in as a launch flag.
const VERSION_FLAG = '--geiger-events-version=';
const versionArg = process.argv.find((arg) => arg.startsWith(VERSION_FLAG));

// Only the frameless main window gets this flag; pop-ups keep their native frame.
const frameless = process.argv.includes('--geiger-events-frameless');

let filled = false;

// Lets the page's CSS switch on desktop styling (and, when frameless, title bar drag regions, rounded corners) before first paint.
function markDesktop() {
  const root = document.documentElement;
  if (!root) return;
  root.dataset.desktop = '1';
  if (frameless) root.dataset.frameless = '1';
  // A maximized or fullscreen window fills the screen edge to edge, so it drops the rounded corners and resize handles.
  if (filled) root.dataset.maximized = '1';
  else delete root.dataset.maximized;
}
markDesktop();
document.addEventListener('DOMContentLoaded', markDesktop);

function applyWindowState(state) {
  filled = Boolean(state && (state.maximized || state.fullscreen));
  markDesktop();
}
if (frameless) {
  ipcRenderer.on('desktop:window-state', (_event, state) => applyWindowState(state));
  ipcRenderer.invoke('desktop:get-window-state').then(applyWindowState, () => {});
}

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('geigerDesktop', {
  isDesktop: true,
  version: versionArg ? versionArg.slice(VERSION_FLAG.length) : '',
  platform: process.platform,
  frameless,
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
  onAuthCallback: (callback) => subscribe('desktop:auth-callback', callback),
  takePendingAuth: () => ipcRenderer.invoke('desktop:take-pending-auth'),
  windowControl: (action) => {
    ipcRenderer.send('desktop:window-control', action);
  },
  getWindowState: () => ipcRenderer.invoke('desktop:get-window-state'),
  startResize: (edge) => ipcRenderer.send('desktop:resize-start', edge),
  endResize: () => ipcRenderer.send('desktop:resize-end'),
  onWindowState: (callback) => subscribe('desktop:window-state', callback),
});
