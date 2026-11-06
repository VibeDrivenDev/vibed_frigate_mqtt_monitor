const test = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, missingSettings } = require('../src/config');

const cfg = (mqtt = {}, frigate = {}) => ({ mqtt: { ...DEFAULTS.mqtt, ...mqtt }, frigate: { ...DEFAULTS.frigate, ...frigate } });

const filled = { host: 'broker.example.lan' };
const url = { baseUrl: 'https://frigate.example.lan' };

test('the default config lacks every required setting', () => {
  assert.deepStrictEqual(missingSettings(cfg()), ['host', 'baseUrl', 'username', 'password']);
});

test('credentials are missing when only the addresses are set', () => {
  assert.deepStrictEqual(missingSettings(cfg(filled, url)), ['username', 'password']);
});

test('a complete config has nothing missing', () => {
  assert.deepStrictEqual(missingSettings(cfg({ ...filled, username: 'u', password: 'p' }, url)), []);
});

test('an anonymous broker needs no credentials', () => {
  assert.deepStrictEqual(missingSettings(cfg({ ...filled, anonymous: true }, url)), []);
});

test('an empty host or URL is reported', () => {
  assert.deepStrictEqual(missingSettings(cfg({ host: '', anonymous: true }, { baseUrl: '' })), ['host', 'baseUrl']);
});

test('the default config has a menu shortcut', () => {
  assert.strictEqual(DEFAULTS.hotkey, 'CommandOrControl+Alt+Shift+F');
});

test('saveSettings stores the menu shortcut', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { saveSettings } = require('../src/config');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const file = path.join(dir, 'config.json');
  saveSettings(file, { mqtt: { host: 'h' }, hotkey: 'Ctrl+Alt+K' });
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).hotkey, 'Ctrl+Alt+K');
  fs.rmSync(dir, { recursive: true });
});

test('the default config has a disable shortcut', () => {
  assert.strictEqual(DEFAULTS.disableHotkey, 'CommandOrControl+Alt+Shift+D');
});
