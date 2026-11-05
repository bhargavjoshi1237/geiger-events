const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');

const SCHEME = 'geiger-events';
const APP_ID = 'studio.geiger.events';
const WINDOW_BACKGROUND = '#161616';
// Windows and Linux drop the native frame because the page draws its own controls; macOS keeps its traffic lights.
const FRAMELESS = ['win32', 'linux'].includes(process.platform);
// Window and taskbar icon; the installed exe carries its own, but an unpackaged run would show Electron's.
const APP_ICON = path.join(__dirname, 'assets', 'icon.png');
// Tells the preload this window draws its own controls (pop-ups and macOS keep the native frame).
const FRAMELESS_ARG = '--geiger-events-frameless';
// Long enough that the splash reads as intentional rather than a flicker on fast loads.
const SPLASH_MIN_MS = 1200;
const WINDOW_STATE_EVENTS = ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur'];
const AUTH_TTL_MS = 15 * 60 * 1000;
const LOGIN_BOUNCE_WINDOW_MS = 2000;
const NAVIGATION_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const RESIZE_TICK_MS = 16;
const WM_NCLBUTTONDBLCLK = 0x00a3;

const appUrl = resolveAppUrl();
const appOrigin = appUrl.origin;
const appBasePath = appUrl.pathname.replace(/\/+$/, '');
const APP_URL = `${appOrigin}${appBasePath}`;
const START_URL = `${APP_URL}/desktop`;

let mainWindow = null;
let mainShown = false;
let splashWindow = null;
let splashShownAt = 0;
let revealTimer = null;
let resizeTimer = null;
// The frameless main window is transparent (so the page can round its corners), which rules out Windows' own maximize;
// it fills the work area itself and remembers where to restore to.
const restoreBounds = new WeakMap();
let pendingAuth = null;
let lastLoginBounce = 0;

function resolveAppUrl() {
  const fallback = app.isPackaged ? 'https://geiger.studio/events' : 'http://localhost:3000';
  const raw = process.env.GEIGER_EVENTS_URL || fallback;
  const url = safeUrl(raw);
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`GEIGER_EVENTS_URL must be an http(s) URL, got "${raw}"`);
  }
  return url;
}

function safeUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isInsideApp(pathname) {
  return appBasePath === '' || pathname === appBasePath || pathname.startsWith(`${appBasePath}/`);
}

function isAppUrl(raw) {
  const url = safeUrl(raw);
  return Boolean(url && url.origin === appOrigin && isInsideApp(url.pathname));
}

function isOnDesktopPage() {
  const url = safeUrl(mainWindow.webContents.getURL());
  return Boolean(url && url.origin === appOrigin && url.pathname === `${appBasePath}/desktop`);
}

// 'signout' = the suite login, which the Events "Sign out" button and the suite gate land on; 'home' = the suite root;
// 'orgs' = the suite's organization picker, which the desktop org picker stands in for.
function classifyNavigation(raw) {
  const url = safeUrl(raw);
  if (!url || url.origin !== appOrigin) return 'external';
  if (url.pathname === '/login') return 'signout';
  if (url.pathname === '/') return 'home';
  // Only when Events sits under a base path: in dev, /org is Events' own page.
  if (appBasePath && /^\/org(\/[^/]+)?\/?$/.test(url.pathname)) return 'orgs';
  return isInsideApp(url.pathname) ? 'app' : 'external';
}

async function openExternalSafe(raw, allowedProtocols) {
  const url = safeUrl(raw);
  if (!url || !allowedProtocols.includes(url.protocol)) return false;
  try {
    await shell.openExternal(url.toString());
    return true;
  } catch {
    return false;
  }
}

function bridgeProtocols() {
  return app.isPackaged ? ['https:', 'mailto:'] : ['http:', 'https:', 'mailto:'];
}

function loadStart(query = '') {
  if (!mainWindow) return;
  // Failures surface through did-fail-load; the rejected promise carries nothing extra.
  mainWindow.loadURL(`${START_URL}${query}`).catch(() => {});
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

// Every path that reveals the main window runs through here, so the splash never outlives it.
function showMain() {
  clearTimeout(revealTimer);
  revealTimer = null;
  if (mainWindow) {
    mainShown = true;
    mainWindow.show();
  }
  closeSplash();
}

function revealMain() {
  if (!mainWindow || mainShown) return;
  const wait = splashWindow && splashShownAt ? SPLASH_MIN_MS - (Date.now() - splashShownAt) : 0;
  if (wait > 0) revealTimer = setTimeout(showMain, wait);
  else showMain();
}

function showWindow() {
  if (!mainWindow) {
    if (app.isReady()) createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  // A deep link or second launch mid-splash shows the app straight away rather than waiting out the splash.
  showMain();
  mainWindow.focus();
}

function bounceToStart(event, query = '') {
  const now = Date.now();
  // A server that keeps redirecting the start page to /login would otherwise spin forever.
  if (now - lastLoginBounce < LOGIN_BOUNCE_WINDOW_MS) return;
  lastLoginBounce = now;
  event.preventDefault();
  // Deferred so the new load doesn't start inside the navigation being cancelled.
  setImmediate(() => loadStart(query));
}

function applyNavigationPolicy(event) {
  if (event.isMainFrame === false) return;
  const kind = classifyNavigation(event.url);
  if (kind === 'app') return;
  // The start page signs out with the suite's cookie options too, so no shadow session cookie survives.
  if (kind === 'signout' || kind === 'home' || kind === 'orgs') {
    bounceToStart(event, { signout: '?signout=1', orgs: '?switch=1' }[kind] || '');
    return;
  }
  event.preventDefault();
  openExternalSafe(event.url, NAVIGATION_PROTOCOLS);
}

function versionArg() {
  return `--geiger-events-version=${app.getVersion()}`;
}

// Links and previews open in the user's browser; only blank sheets the page writes itself (badge printing) stay in-app.
function handleWindowOpen({ url }) {
  if (url === 'about:blank' || url === '') {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        backgroundColor: WINDOW_BACKGROUND,
        // Pop-ups keep a native frame, so they must not inherit the frameless flag and draw a second set of controls.
        webPreferences: { additionalArguments: [versionArg()] },
      },
    };
  }
  openExternalSafe(url, NAVIGATION_PROTOCOLS);
  return { action: 'deny' };
}

function attachPolicies(contents) {
  contents.on('will-navigate', applyNavigationPolicy);
  contents.on('will-redirect', applyNavigationPolicy);
  contents.setWindowOpenHandler(handleWindowOpen);
  contents.on('did-create-window', (child) => attachPolicies(child.webContents));
}

// The bundled error page carries our own window controls, so the window is never stuck without a way to move or close it.
function showErrorPage(reason) {
  mainWindow.loadFile(path.join(__dirname, 'offline.html'), { query: { url: START_URL, reason } }).catch(() => {});
}

function showOffline(_event, errorCode, _description, validatedUrl, isMainFrame) {
  // -3 is ERR_ABORTED: our own redirects and cancelled loads, not a connectivity problem.
  if (!isMainFrame || errorCode === -3 || validatedUrl.startsWith('file:')) return;
  showErrorPage('offline');
}

// The server answered but has no desktop start page (not deployed yet, or down): its error page has none of our chrome.
function showUnavailable(_event, url, httpResponseCode) {
  const target = safeUrl(url);
  if (httpResponseCode < 400 || !target || target.origin !== appOrigin) return;
  if (target.pathname !== `${appBasePath}/desktop`) return;
  showErrorPage('unavailable');
}

function drawsOwnFrame(win) {
  return FRAMELESS && win === mainWindow;
}

function isMaximized(win) {
  return drawsOwnFrame(win) ? restoreBounds.has(win) : win.isMaximized();
}

function windowState(win) {
  if (!win || win.isDestroyed()) return { maximized: false, fullscreen: false, focused: false };
  return { maximized: isMaximized(win), fullscreen: win.isFullScreen(), focused: win.isFocused() };
}

function pushWindowState(win) {
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('desktop:window-state', windowState(win));
  }
}

// The page draws its own controls, so it has to mirror every maximize, fullscreen and focus change.
function trackWindowState(win) {
  for (const name of WINDOW_STATE_EVENTS) win.on(name, () => pushWindowState(win));
}

function fillWorkArea(win) {
  const bounds = win.getBounds();
  restoreBounds.set(win, bounds);
  win.setBounds(screen.getDisplayMatching(bounds).workArea);
  pushWindowState(win);
}

function restoreFromFill(win) {
  const saved = restoreBounds.get(win);
  restoreBounds.delete(win);
  if (saved) win.setBounds(saved);
  pushWindowState(win);
}

// Dragging a filled window by its header drops it back to its restored size under the cursor, like a native maximize.
function restoreOnDrag(win) {
  win.on('will-move', () => {
    const saved = restoreBounds.get(win);
    if (!saved) return;
    restoreBounds.delete(win);
    const cursor = screen.getCursorScreenPoint();
    const current = win.getBounds();
    const ratio = (cursor.x - current.x) / current.width;
    win.setBounds({ x: Math.round(cursor.x - saved.width * ratio), y: current.y, width: saved.width, height: saved.height });
    pushWindowState(win);
  });
}

function toggleMaximize(win) {
  if (win.isFullScreen()) win.setFullScreen(false);
  else if (drawsOwnFrame(win)) (restoreBounds.has(win) ? restoreFromFill : fillWorkArea)(win);
  else if (win.isMaximized()) win.unmaximize();
  else win.maximize();
}

function stopResize() {
  clearInterval(resizeTimer);
  resizeTimer = null;
}

// No OS resize border on a transparent window, so the page's edge handles drive it: follow the cursor until release.
function startResize(win, edge) {
  stopResize();
  const start = win.getBounds();
  const origin = screen.getCursorScreenPoint();
  const [minWidth, minHeight] = win.getMinimumSize();
  let last = '';
  resizeTimer = setInterval(() => {
    if (win.isDestroyed()) return stopResize();
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - origin.x;
    const dy = cursor.y - origin.y;
    let { x, y, width, height } = start;
    if (edge.includes('e')) width = Math.max(minWidth, start.width + dx);
    if (edge.includes('s')) height = Math.max(minHeight, start.height + dy);
    if (edge.includes('w')) {
      width = Math.max(minWidth, start.width - dx);
      x = start.x + start.width - width;
    }
    if (edge.includes('n')) {
      height = Math.max(minHeight, start.height - dy);
      y = start.y + start.height - height;
    }
    const key = `${x},${y},${width},${height}`;
    if (key === last) return;
    last = key;
    win.setBounds({ x, y, width, height });
  }, RESIZE_TICK_MS);
}

const WINDOW_ACTIONS = {
  minimize: (win) => win.minimize(),
  'toggle-maximize': toggleMaximize,
  close: (win) => win.close(),
};

function createSplash() {
  const splash = new BrowserWindow({
    width: 520,
    height: 340,
    frame: false,
    icon: APP_ICON,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    show: false,
    center: true,
    alwaysOnTop: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  splashWindow = splash;

  splash.once('ready-to-show', () => {
    splashShownAt = Date.now();
    splash.show();
  });
  splash.on('closed', () => {
    if (splashWindow === splash) splashWindow = null;
  });
  // A file dropped on the splash would otherwise navigate it away from the bundled page.
  splash.webContents.on('will-navigate', (event) => event.preventDefault());
  splash.loadFile(path.join(__dirname, 'splash.html')).catch(() => {});
}

function createWindow() {
  mainShown = false;
  mainWindow = new BrowserWindow({
    icon: APP_ICON,
    title: 'Geiger Events',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    // Transparent so the page can round the window's corners on every Windows version.
    backgroundColor: FRAMELESS ? '#00000000' : WINDOW_BACKGROUND,
    transparent: FRAMELESS,
    show: false,
    autoHideMenuBar: true,
    frame: !FRAMELESS,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: [versionArg(), ...(FRAMELESS ? [FRAMELESS_ARG] : [])],
    },
  });

  // An app, not a browser: no pinch-zoom.
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  mainWindow.once('ready-to-show', revealMain);
  mainWindow.on('closed', () => {
    stopResize();
    mainWindow = null;
  });
  trackWindowState(mainWindow);
  if (FRAMELESS) restoreOnDrag(mainWindow);
  // Windows won't maximize a transparent window on a header double-click, so do it ourselves.
  if (process.platform === 'win32') {
    const win = mainWindow;
    win.hookWindowMessage(WM_NCLBUTTONDBLCLK, () => toggleMaximize(win));
  }
  attachPolicies(mainWindow.webContents);
  mainWindow.webContents.on('did-fail-load', showOffline);
  mainWindow.webContents.on('did-navigate', showUnavailable);
  loadStart();
}

function freshPendingAuth() {
  if (pendingAuth && Date.now() - pendingAuth.receivedAt > AUTH_TTL_MS) pendingAuth = null;
  return pendingAuth ? pendingAuth.payload : null;
}

function authPayload(params) {
  return {
    tokenHash: params.get('token_hash'),
    type: params.get('type'),
    state: params.get('state'),
    email: params.get('email'),
    error: params.get('error'),
  };
}

function receiveAuth(params) {
  pendingAuth = { payload: authPayload(params), receivedAt: Date.now() };
  // Without a window yet, the start page picks it up through takePendingAuth once loaded.
  if (!mainWindow) return;
  if (isOnDesktopPage()) mainWindow.webContents.send('desktop:auth-callback', pendingAuth.payload);
  else loadStart();
}

function handleDeepLink(raw) {
  const url = safeUrl(raw);
  if (!url || url.protocol !== `${SCHEME}:`) return;
  const host = url.host.toLowerCase();
  if (host === 'auth') receiveAuth(url.searchParams);
  if (host === 'auth' || host === 'open') showWindow();
}

function findDeepLink(argv) {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${SCHEME}:`));
}

function registerScheme() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else if (process.env.PORTABLE_EXECUTABLE_FILE) {
    // The portable exe unpacks to a temp folder each run, so the link must point at the exe itself, not this copy.
    app.setAsDefaultProtocolClient(SCHEME, process.env.PORTABLE_EXECUTABLE_FILE);
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }
}

// IPC is only honoured from Events pages, so nothing else that loads can read a sign-in token.
function isTrustedSender(event) {
  return Boolean(event.senderFrame && isAppUrl(event.senderFrame.url));
}

function registerIpc() {
  ipcMain.handle('desktop:open-external', (event, url) => {
    if (!isTrustedSender(event) || typeof url !== 'string') return false;
    return openExternalSafe(url, bridgeProtocols());
  });

  ipcMain.handle('desktop:take-pending-auth', (event) => {
    if (!isTrustedSender(event)) return null;
    const payload = freshPendingAuth();
    pendingAuth = null;
    return payload;
  });

  // Window controls only touch the sender's own window, so the bundled offline page may use them too.
  ipcMain.on('desktop:window-control', (event, action) => {
    if (typeof action !== 'string' || !Object.hasOwn(WINDOW_ACTIONS, action)) return;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) WINDOW_ACTIONS[action](win);
  });

  ipcMain.handle('desktop:get-window-state', (event) => windowState(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.on('desktop:resize-start', (event, edge) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !drawsOwnFrame(win) || !RESIZE_EDGES.includes(edge)) return;
    if (isMaximized(win) || win.isFullScreen()) return;
    startResize(win, edge);
  });
  ipcMain.on('desktop:resize-end', stopResize);
}

function buildMenu() {
  const viewItems = [
    { role: 'reload' },
    { role: 'forceReload' },
    ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  return Menu.buildFromTemplate([
    {
      label: 'App',
      submenu: [
        {
          label: 'Switch organization',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => loadStart('?switch=1'),
        },
        { label: 'Sign out', click: () => loadStart('?signout=1') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    { label: 'View', submenu: viewItems },
  ]);
}

function start() {
  registerScheme();
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  app.on('second-instance', (_event, argv) => {
    const link = findDeepLink(argv);
    if (link) handleDeepLink(link);
    else showWindow();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Windows hands a cold-start deep link over in argv; stash it before the first page loads.
  const launchLink = findDeepLink(process.argv);
  if (launchLink) handleDeepLink(launchLink);

  app.whenReady().then(() => {
    registerIpc();
    Menu.setApplicationMenu(buildMenu());
    createSplash();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

if (app.requestSingleInstanceLock()) start();
else app.quit();
