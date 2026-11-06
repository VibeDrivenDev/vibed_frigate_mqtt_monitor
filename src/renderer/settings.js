const $ = (id) => document.getElementById(id);
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
let loaded = null;

const FIELD = { host: 'mqtt-host', port: 'mqtt-port', username: 'mqtt-username', password: 'mqtt-password', baseUrl: 'frigate-baseUrl' };
const LABEL = { host: 'MQTT host', port: 'MQTT port', username: 'MQTT username', password: 'MQTT password', baseUrl: 'Frigate server URL' };

function syncAnonymous() {
  const off = $('mqtt-anonymous').checked;
  $('mqtt-username').disabled = off;
  $('mqtt-password').disabled = off;
}

function fill({ settings: s, cameras, zones, canLogin, encrypted, missing }) {
  loaded = s;
  for (const el of document.querySelectorAll('.bad')) el.classList.remove('bad');
  $('banner').hidden = missing.length === 0;
  $('banner').textContent = missing.length ? `Complete these settings to connect: ${missing.map((k) => LABEL[k]).join(', ')}.` : '';
  for (const k of missing) $(FIELD[k]).classList.add('bad');
  $('mqtt-anonymous').checked = s.mqtt.anonymous;
  syncAnonymous();
  $('mqtt-host').value = s.mqtt.host;
  $('mqtt-port').value = s.mqtt.port;
  $('mqtt-username').value = s.mqtt.username;
  $('mqtt-topicPrefix').value = s.mqtt.topicPrefix;
  $('pw-hint').textContent = (s.mqtt.hasPassword ? 'A password is saved. Leave empty to keep it. ' : 'No password is saved. ')
    + (encrypted ? 'The system keychain protects it.' : 'The keychain is not available, so the file stores it as plain text.');
  $('frigate-baseUrl').value = s.frigate.baseUrl;
  $('frigate-streamTemplate').value = s.frigate.streamTemplate;
  $('det-labels').value = s.detection.labels.join(', ');
  $('det-hold').value = s.detection.holdSeconds;
  $('det-zones').value = s.detection.zones.join(', ');
  $('win-corner').value = s.window.corner;
  $('win-maxWidth').value = Math.round(s.window.maxWidth * 1000) / 10;
  $('win-maxHeight').value = Math.round(s.window.maxHeight * 1000) / 10;
  $('win-margin').value = s.window.margin;
  $('login').checked = s.startAtLogin;
  $('login').disabled = !canLogin;
  $('login-hint').textContent = canLogin ? '' : 'Available in the installed app only.';

  const body = $('cams');
  body.textContent = '';
  for (const cam of cameras) {
    const o = s.cameras[cam] || {};
    const tr = document.createElement('tr');
    tr.dataset.camera = cam;
    const cell = (html) => { const td = document.createElement('td'); td.append(html); tr.append(td); };
    cell(Object.assign(document.createElement('span'), { textContent: cam }));
    cell(Object.assign(document.createElement('input'), { type: 'checkbox', className: 'on', checked: o.enabled !== false }));
    cell(Object.assign(document.createElement('input'), { type: 'number', min: 0, className: 'hold', value: o.holdSeconds ?? '' }));
    cell(Object.assign(document.createElement('input'), { type: 'text', className: 'labels', value: (o.labels || []).join(', ') }));
    cell(Object.assign(document.createElement('input'), { type: 'text', className: 'zones', value: (o.zones || []).join(', '), placeholder: (zones[cam] || []).join(', ') }));
    body.append(tr);
  }
}

function collect() {
  const cameras = {};
  for (const tr of $('cams').children) {
    const cam = tr.dataset.camera;
    const o = { ...(loaded.cameras[cam] || {}) };
    delete o.enabled; delete o.holdSeconds; delete o.labels; delete o.zones;
    if (!tr.querySelector('.on').checked) o.enabled = false;
    const hold = tr.querySelector('.hold').value;
    if (hold !== '') o.holdSeconds = Number(hold);
    const labels = list(tr.querySelector('.labels').value);
    if (labels.length) o.labels = labels;
    const zs = list(tr.querySelector('.zones').value);
    if (zs.length) o.zones = zs;
    if (Object.keys(o).length) cameras[cam] = o;
  }
  return {
    mqtt: {
      host: $('mqtt-host').value.trim(),
      port: Number($('mqtt-port').value),
      anonymous: $('mqtt-anonymous').checked,
      username: $('mqtt-username').value,
      password: $('mqtt-password').value,
      topicPrefix: $('mqtt-topicPrefix').value.trim() || 'frigate',
    },
    frigate: { baseUrl: $('frigate-baseUrl').value.trim(), streamTemplate: $('frigate-streamTemplate').value.trim() },
    detection: { labels: list($('det-labels').value), holdSeconds: Number($('det-hold').value), zones: list($('det-zones').value) },
    cameras,
    window: {
      ...loaded.window,
      corner: $('win-corner').value,
      maxWidth: Number($('win-maxWidth').value) / 100,
      maxHeight: Number($('win-maxHeight').value) / 100,
      margin: Number($('win-margin').value),
    },
    startAtLogin: $('login').checked,
  };
}

$('save').addEventListener('click', async () => {
  await window.popup.saveSettings(collect());
  $('msg').textContent = 'Saved. The app uses the new settings now.';
  $('mqtt-password').value = '';
  fill(await window.popup.getSettings());
});
$('mqtt-anonymous').addEventListener('change', syncAnonymous);
$('close').addEventListener('click', () => window.close());
window.popup.getSettings().then(fill);
