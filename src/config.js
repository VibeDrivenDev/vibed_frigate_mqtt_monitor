const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  mqtt: { host: '', port: 1883, username: '', password: '', anonymous: false, topicPrefix: 'frigate' },
  frigate: { baseUrl: '', streamTemplate: '{camera}_sub_stream' },
  detection: { labels: ['person'], holdSeconds: 30, zones: [] },
  cameras: {},
  pinned: [],
  startAtLogin: false,
  hotkey: 'CommandOrControl+Alt+Shift+F',
  disableHotkey: 'CommandOrControl+Alt+Shift+D',
  window: { display: 'primary', corner: 'bottom-right', maxWidth: 1 / 3, maxHeight: 1 / 2, margin: 16 },
};

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    const isObj = v && typeof v === 'object' && !Array.isArray(v);
    out[k] = isObj && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}

function loadEnv(file) {
  const dir = path.dirname(file);
  for (const f of [path.join(__dirname, '..', '.env'), path.join(dir, '.env')]) {
    if (fs.existsSync(f)) process.loadEnvFile(f);
  }
}

function load(file) {
  loadEnv(file);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2) + '\n');
  }
  const cfg = merge(DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf8')));
  if (process.env.FRIGATE_MQTT_PASSWORD) cfg.mqtt.password = process.env.FRIGATE_MQTT_PASSWORD;
  return cfg;
}

function save(file, patch) {
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify(merge(current, patch), null, 2) + '\n');
}

const SETTINGS_KEYS = ['mqtt', 'frigate', 'detection', 'cameras', 'window', 'startAtLogin', 'hotkey', 'disableHotkey'];

function saveSettings(file, settings, { passwordEnc } = {}) {
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const next = { ...current };
  for (const k of SETTINGS_KEYS) if (k in settings) next[k] = settings[k];
  const mqttIn = settings.mqtt || {};
  const keep = current.mqtt || {};
  next.mqtt = { ...mqttIn };
  delete next.mqtt.password;
  delete next.mqtt.passwordEnc;
  if (mqttIn.password) {
    if (passwordEnc) next.mqtt.passwordEnc = passwordEnc;
    else next.mqtt.password = mqttIn.password;
  } else {
    if (keep.password) next.mqtt.password = keep.password;
    if (keep.passwordEnc) next.mqtt.passwordEnc = keep.passwordEnc;
  }
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
}

function missingSettings(cfg) {
  const out = [];
  if (!cfg.mqtt.host) out.push('host');
  if (!cfg.mqtt.port) out.push('port');
  if (!cfg.frigate.baseUrl) out.push('baseUrl');
  if (!cfg.mqtt.anonymous) {
    if (!cfg.mqtt.username) out.push('username');
    if (!cfg.mqtt.password) out.push('password');
  }
  return out;
}

function ruleFor(cfg, camera) {
  const o = cfg.cameras[camera] || {};
  return {
    enabled: o.enabled !== false,
    labels: o.labels || cfg.detection.labels,
    holdSeconds: o.holdSeconds ?? cfg.detection.holdSeconds,
    zones: o.zones || cfg.detection.zones,
  };
}

function streamFor(cfg, camera) {
  const o = cfg.cameras[camera] || {};
  return o.stream || cfg.frigate.streamTemplate.replace('{camera}', camera);
}

module.exports = { DEFAULTS, load, save, saveSettings, missingSettings, ruleFor, streamFor };
