const test = require('node:test');
const assert = require('node:assert');
const { fitGrid } = require('../src/layout');

const BOX = { w: 624, h: 524 };

test('one camera fills the width of the area', () => {
  const g = fitGrid(1, BOX.w, BOX.h);
  assert.strictEqual(g.cols, 1);
  assert.strictEqual(g.width, 624);
});

test('the grid never exceeds the area, for any camera count', () => {
  for (let n = 1; n <= 20; n++) {
    const g = fitGrid(n, BOX.w, BOX.h);
    assert.ok(g.width <= BOX.w && g.height <= BOX.h, `n=${n} ${g.width}x${g.height}`);
    assert.ok(g.cols * g.rows >= n, `n=${n} fits all tiles`);
  }
});

test('tiles shrink as cameras are added', () => {
  let prev = Infinity;
  for (let n = 1; n <= 12; n++) {
    const { tileW } = fitGrid(n, BOX.w, BOX.h);
    assert.ok(tileW <= prev, `n=${n}`);
    prev = tileW;
  }
});

test('tiles keep a 16:9 shape', () => {
  const g = fitGrid(5, BOX.w, BOX.h);
  assert.ok(Math.abs(g.tileW / g.tileH - 16 / 9) < 0.02);
});
