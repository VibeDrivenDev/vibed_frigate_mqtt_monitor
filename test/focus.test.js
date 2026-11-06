const test = require('node:test');
const assert = require('node:assert');
const { nextFocus } = require('../src/focus');

const tile = (camera, active = false) => ({ camera, active });

test('no focus stays no focus', () => {
  assert.strictEqual(nextFocus(null, new Set(), [tile('a')]), null);
});

test('focus stays while the focused camera is visible', () => {
  assert.strictEqual(nextFocus('a', new Set(['a']), [tile('a', true), tile('b')]), 'a');
});

test('focus ends when the focused camera closes', () => {
  assert.strictEqual(nextFocus('a', new Set(['a']), [tile('b', true)]), null);
});

test('focus ends when a new detection starts on another camera', () => {
  assert.strictEqual(nextFocus('a', new Set(['a']), [tile('a', true), tile('b', true)]), null);
});

test('a camera that was already active does not end focus', () => {
  assert.strictEqual(nextFocus('a', new Set(['a', 'b']), [tile('a', true), tile('b', true)]), 'a');
});
