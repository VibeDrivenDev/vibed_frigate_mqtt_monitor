const test = require('node:test');
const assert = require('node:assert');
const { createTracker } = require('../src/tracker');

function setup(rules = {}) {
  let t = 1000;
  const tracker = createTracker({
    now: () => t,
    ruleFor: (cam) => ({ enabled: true, labels: ['person'], holdSeconds: 30, zones: [], ...rules[cam] }),
  });
  return { tracker, advance: (ms) => (t += ms) };
}
const ev = (type, camera, id, label = 'person') => ({ type, after: { id, camera, label } });
const cams = (tr) => tr.snapshot().map((s) => s.camera);

test('person event shows the camera and stays while active', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  advance(600000);
  assert.deepStrictEqual(cams(tracker), ['door']);
});

test('camera stays visible for the hold time after end, then hides', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(29000);
  assert.deepStrictEqual(cams(tracker), ['door']);
  advance(1001);
  assert.deepStrictEqual(cams(tracker), []);
});

test('a new event during the hold cancels the countdown', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(20000);
  tracker.handleEvent(ev('new', 'door', 'b'));
  advance(60000);
  assert.deepStrictEqual(tracker.snapshot(), [{ camera: 'door', active: true, pinned: false, hideAt: 0, holdMs: 0 }]);
});

test('hold waits for the last of several events', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('new', 'door', 'b'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(100000);
  assert.strictEqual(tracker.snapshot()[0].active, true);
});

test('other labels and disabled cameras are ignored', () => {
  const { tracker } = setup({ yard: { enabled: false } });
  tracker.handleEvent(ev('new', 'door', 'a', 'car'));
  tracker.handleEvent(ev('new', 'yard', 'b'));
  assert.deepStrictEqual(cams(tracker), []);
});

test('per-camera hold overrides the global value', () => {
  const { tracker, advance } = setup({ door: { holdSeconds: 5 } });
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(5001);
  assert.deepStrictEqual(cams(tracker), []);
});

test('dismiss hides the camera and ignores later updates of the same event', () => {
  const { tracker } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.dismiss('door');
  tracker.handleEvent(ev('update', 'door', 'a'));
  assert.deepStrictEqual(cams(tracker), []);
  tracker.handleEvent(ev('new', 'door', 'b'));
  assert.deepStrictEqual(cams(tracker), ['door']);
});

test('snapshot reports hideAt and the full hold length during the countdown', () => {
  const { tracker, advance } = setup({ door: { holdSeconds: 12 } });
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(4000);
  assert.deepStrictEqual(tracker.snapshot(), [{ camera: 'door', active: false, pinned: false, hideAt: 13000, holdMs: 12000 }]);
});

test('a pinned camera is visible with no events and never counts down', () => {
  const { tracker, advance } = setup();
  tracker.setPinned(['door']);
  assert.deepStrictEqual(tracker.snapshot(), [{ camera: 'door', active: false, pinned: true, hideAt: 0, holdMs: 0 }]);
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.handleEvent(ev('end', 'door', 'a'));
  advance(600000);
  assert.deepStrictEqual(cams(tracker), ['door']);
});

test('a pinned camera ignores dismiss and hides after unpin when idle', () => {
  const { tracker } = setup();
  tracker.setPinned(['door']);
  tracker.handleEvent(ev('new', 'door', 'a'));
  tracker.dismiss('door');
  assert.strictEqual(tracker.snapshot()[0].active, true);
  tracker.handleEvent(ev('end', 'door', 'a'));
  tracker.setPinned([]);
  assert.strictEqual(tracker.snapshot().length, 1);
});

test('unpinning an idle camera with no hold left hides it', () => {
  const { tracker } = setup();
  tracker.setPinned(['yard']);
  tracker.setPinned([]);
  assert.deepStrictEqual(cams(tracker), []);
});

const evz = (type, camera, id, zones) => ({ type, after: { id, camera, label: 'person', current_zones: zones } });

test('zone filter opens only for a listed zone', () => {
  const { tracker } = setup({ yard: { zones: ['driveway'] } });
  tracker.handleEvent(evz('new', 'yard', 'a', ['street']));
  assert.deepStrictEqual(cams(tracker), []);
  tracker.handleEvent(evz('update', 'yard', 'a', ['street', 'driveway']));
  assert.deepStrictEqual(cams(tracker), ['yard']);
});

test('an end message closes an event even when the zone does not match', () => {
  const { tracker } = setup({ yard: { zones: ['driveway'] } });
  tracker.handleEvent(evz('new', 'yard', 'a', ['driveway']));
  tracker.handleEvent(evz('end', 'yard', 'a', []));
  assert.strictEqual(tracker.snapshot()[0].active, false);
});

test('reconcile ends an event that is gone from the API after the grace time', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  advance(10000);
  tracker.reconcile([]);
  assert.strictEqual(tracker.snapshot()[0].active, true);
  advance(15000);
  tracker.reconcile([]);
  const snap = tracker.snapshot()[0];
  assert.strictEqual(snap.active, false);
  assert.ok(snap.hideAt > 0);
});

test('reconcile keeps events that the API still lists', () => {
  const { tracker, advance } = setup();
  tracker.handleEvent(ev('new', 'door', 'a'));
  advance(600000);
  tracker.reconcile([{ id: 'a', camera: 'door', label: 'person', zones: [] }]);
  assert.strictEqual(tracker.snapshot()[0].active, true);
});

test('reconcile adds an in-progress event that MQTT missed', () => {
  const { tracker } = setup();
  tracker.reconcile([{ id: 'z', camera: 'door', label: 'person', zones: [] }]);
  assert.deepStrictEqual(cams(tracker), ['door']);
});
