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
