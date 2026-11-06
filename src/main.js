const { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain, net, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const config = require('./config');
const { createTracker } = require('./tracker');
const { fitGrid } = require('./layout');
const { nextFocus } = require('./focus');

const configFile = process.env.SURVEILLANCE_CONFIG || path.join(app.getPath('userData'), 'config.json');
async function loadConfig() {
  const loaded = config.load(configFile);
  if (loaded.mqtt.passwordEnc && !process.env.FRIGATE_MQTT_PASSWORD) {
    try {
      const { result } = await safeStorage.decryptStringAsync(Buffer.from(loaded.mqtt.passwordEnc, 'base64'));
      loaded.mqtt.password = result;
    } catch (e) {
      console.error('password decrypt failed', e.message);
    }
  }
  return loaded;
}
let cfg = null;

function migrateLegacySettings() {
  const legacy = path.join(app.getPath('appData'), 'surveillance-popup', 'config.json');
  if (!fs.existsSync(configFile) && fs.existsSync(legacy)) {
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.copyFileSync(legacy, configFile);
  }
}
let paused = false;
let client = null;
let win = null;
let tray = null;
let picker = null;
let lastKey = '';
let focus = null;
let prevActive = new Set();

const tracker = createTracker({ ruleFor: (cam) => config.ruleFor(cfg, cam) });
let knownCameras = [];
let knownZones = {};

async function refreshCameras() {
  if (!cfg.frigate.baseUrl) return;
  try {
    const res = await net.fetch(`${cfg.frigate.baseUrl.replace(/\/$/, '')}/api/config`);
    const body = await res.json();
    knownCameras = Object.keys(body.cameras || {}).sort();
    knownZones = Object.fromEntries(knownCameras.map((c) => [c, Object.keys(body.cameras[c].zones || {})]));
    if (process.env.SURVEILLANCE_DEBUG) console.log('cameras', knownCameras.join(','));
  } catch (e) {
    console.error('camera list failed', e.message);
  }
  buildMenu();
}

function allCameras() {
  return [...new Set([...knownCameras, ...cfg.pinned])].sort();
}

function openPicker() {
  if (picker && !picker.isDestroyed()) {
    picker.show();
    picker.focus();
    return;
  }
  picker = new BrowserWindow({
    width: 560,
    height: 640,
    title: 'Pin cameras',
    minimizable: false,
    maximizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  picker.setMenuBarVisibility(false);
  picker.loadFile(path.join(__dirname, 'renderer', 'picker.html'));
}

async function reconcileEvents() {
  if (paused || !cfg.frigate.baseUrl) return;
  try {
    const res = await net.fetch(`${cfg.frigate.baseUrl.replace(/\/$/, '')}/api/events?in_progress=1&limit=100`);
    if (!res.ok) return;
    tracker.reconcile(await res.json());
    if (process.env.SURVEILLANCE_DEBUG) console.log('reconcile', JSON.stringify(tracker.snapshot().map((s) => [s.camera, s.active])));
    render();
  } catch (e) {
    console.error('reconcile failed', e.message);
  }
}

function applyLoginItem() {
  if (!app.isPackaged || app.getLoginItemSettings().openAtLogin === !!cfg.startAtLogin) return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!cfg.startAtLogin });
  } catch (e) {
    console.error('login item failed', e.message);
  }
}

async function reloadConfig() {
  cfg = await loadConfig();
  tracker.setPinned(cfg.pinned);
  applyLoginItem();
  lastKey = '';
  connect();
  refreshCameras();
  render();
}

let settingsWin = null;

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 640,
    height: 760,
    title: 'Settings',
    minimizable: false,
    maximizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
}

function togglePin(camera, on) {
  const next = new Set(cfg.pinned);
  if (on) next.add(camera);
  else next.delete(camera);
  cfg.pinned = [...next].sort();
  config.save(configFile, { pinned: cfg.pinned });
  tracker.setPinned(cfg.pinned);
  render();
  buildMenu();
}

function pickDisplay() {
  const all = screen.getAllDisplays();
  const want = cfg.window.display;
  return typeof want === 'number' && all[want] ? all[want] : screen.getPrimaryDisplay();
}

function layout(count) {
  const area = pickDisplay().workArea;
  const m = cfg.window.margin;
  const maxW = Math.floor(area.width * cfg.window.maxWidth) - m;
  const maxH = Math.floor(area.height * cfg.window.maxHeight) - m;
  const g = fitGrid(count, maxW, maxH);
  const [v, h] = cfg.window.corner.split('-');
  const x = h === 'left' ? area.x + m : area.x + area.width - g.width - m;
  const y = v === 'top' ? area.y + m : area.y + area.height - g.height - m;
  return { x, y, width: g.width, height: g.height, cols: g.cols };
}

function ensureWindow() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: true,
    backgroundColor: '#000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

function applyFocus(next) {
  focus = next;
  if (win && !win.isDestroyed()) {
    win.setFocusable(!!focus);
    if (focus) win.focus();
  }
  lastKey = '';
  render();
}

function render() {
  const visible = tracker.snapshot();
  const nf = nextFocus(focus, prevActive, visible);
  prevActive = new Set(visible.filter((v) => v.active).map((v) => v.camera));
  if (nf !== focus) {
    focus = nf;
    if (win && !win.isDestroyed()) win.setFocusable(false);
  }
  const key = JSON.stringify([focus, visible.map((v) => [v.camera, v.active, v.pinned, v.hideAt])]);
  if (key === lastKey) return;
  lastKey = key;
  if (visible.length === 0) {
    if (win && !win.isDestroyed()) win.hide();
    return;
  }
  const w = ensureWindow();
  const box = layout(focus ? 1 : visible.length);
  w.setBounds({ x: box.x, y: box.y, width: box.width, height: box.height });
  const payload = {
    baseUrl: cfg.frigate.baseUrl,
    cols: box.cols,
    focus,
    tiles: visible.map((v) => ({ ...v, stream: config.streamFor(cfg, v.camera) })),
  };
  const send = () => w.webContents.send('tiles', payload);
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send);
  else send();
  if (!w.isVisible()) w.showInactive();
}

function connect() {
  if (client) client.end(true);
  client = null;
  if (config.missingSettings(cfg).length > 0) {
    setStatus('needs settings');
    return;
  }
  const m = cfg.mqtt;
  client = mqtt.connect({
    host: m.host,
    port: m.port,
    protocol: 'mqtt',
    username: m.username || undefined,
    password: m.password || undefined,
    reconnectPeriod: 3000,
  });
  const topic = `${m.topicPrefix}/events`;
  client.on('connect', () => {
    tracker.reset();
    client.subscribe(topic);
    setStatus('connected');
  });
  client.on('close', () => setStatus('disconnected'));
  client.on('error', (e) => setStatus(`error: ${e.message}`));
  client.on('message', (t, buf) => {
    if (paused || t !== topic) return;
    try {
      tracker.handleEvent(JSON.parse(buf.toString()));
      render();
    } catch (e) {
      console.error('bad event', e.message);
    }
  });
}

let status = 'starting';
function setStatus(s) {
  status = s;
  console.log(`mqtt ${s}`);
  buildMenu();
}

function setPaused(value) {
  paused = value;
  if (paused) {
    tracker.reset();
    render();
  }
  buildMenu();
}

function setDisplay(display) {
  config.save(configFile, { window: { display } });
  cfg.window.display = display;
  lastKey = '';
  render();
  buildMenu();
}

function buildMenu() {
  if (!tray) return;
  const displays = screen.getAllDisplays();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `MQTT ${status}`, enabled: false },
      { label: 'Pause', type: 'checkbox', checked: paused, click: (i) => setPaused(i.checked) },
      {
        label: 'Show on display',
        submenu: [
          { label: 'Primary', type: 'radio', checked: cfg.window.display === 'primary', click: () => setDisplay('primary') },
          ...displays.map((d, i) => ({
            label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
            type: 'radio',
            checked: cfg.window.display === i,
            click: () => setDisplay(i),
          })),
        ],
      },
      { label: 'Pin cameras...', click: openPicker },
      { label: 'Settings...', click: openSettings },
      {
        label: 'Start at login',
        type: 'checkbox',
        checked: !!cfg.startAtLogin,
        enabled: app.isPackaged,
        click: (i) => {
          cfg.startAtLogin = i.checked;
          config.save(configFile, { startAtLogin: i.checked });
          applyLoginItem();
        },
      },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]),
  );
}

ipcMain.handle('get-cameras', () => ({
  baseUrl: cfg.frigate.baseUrl,
  cameras: allCameras(),
  pinned: cfg.pinned,
}));

ipcMain.handle('get-settings', async () => ({
  settings: {
    mqtt: { host: cfg.mqtt.host, port: cfg.mqtt.port, username: cfg.mqtt.username, anonymous: !!cfg.mqtt.anonymous, topicPrefix: cfg.mqtt.topicPrefix, hasPassword: !!cfg.mqtt.password },
    frigate: cfg.frigate,
    detection: cfg.detection,
    cameras: cfg.cameras,
    window: cfg.window,
    startAtLogin: !!cfg.startAtLogin,
  },
  missing: config.missingSettings(cfg),
  cameras: allCameras(),
  zones: knownZones,
  canLogin: app.isPackaged,
  encrypted: await safeStorage.isAsyncEncryptionAvailable(),
}));

ipcMain.handle('save-settings', async (_e, settings) => {
  let passwordEnc = null;
  if (settings.mqtt.password && (await safeStorage.isAsyncEncryptionAvailable())) {
    passwordEnc = (await safeStorage.encryptStringAsync(settings.mqtt.password)).toString('base64');
  }
  config.saveSettings(configFile, settings, { passwordEnc });
  await reloadConfig();
  return true;
});

ipcMain.on('set-pinned', (_e, camera, on) => togglePin(camera, on));

ipcMain.on('set-focus', (_e, camera) => applyFocus(camera || null));

ipcMain.on('dismiss', (_e, camera) => {
  tracker.dismiss(camera);
  render();
});

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock.hide();
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip(app.getName());
  migrateLegacySettings();
  cfg = await loadConfig();
  tracker.setPinned(cfg.pinned);
  applyLoginItem();
  buildMenu();
  connect();
  refreshCameras();
  render();
  if (config.missingSettings(cfg).length > 0) openSettings();
  setInterval(render, 1000);
  setInterval(reconcileEvents, 20000);
  if (process.env.SURVEILLANCE_SHOT) {
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.SURVEILLANCE_SHOT, img.toPNG());
      app.quit();
    }, Number(process.env.SURVEILLANCE_SHOT_DELAY || 6000));
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
