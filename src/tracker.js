const GRACE_MS = 20000;

const zonesOf = (o) => [...(o.current_zones || []), ...(o.entered_zones || []), ...(o.zones || [])];

function createTracker({ ruleFor, now = Date.now }) {
  const cameras = new Map();
  const dismissed = new Map();
  let pinned = new Set();

  function state(camera) {
    let s = cameras.get(camera);
    if (!s) {
      s = { events: new Map(), hideAt: 0, holdMs: 0 };
      cameras.set(camera, s);
    }
    return s;
  }

  function endEvent(camera, id) {
    dismissed.delete(id);
    const s = cameras.get(camera);
    if (s && s.events.delete(id) && s.events.size === 0) {
      s.holdMs = ruleFor(camera).holdSeconds * 1000;
      s.hideAt = now() + s.holdMs;
    }
  }

  function handleEvent(msg) {
    const obj = msg && (msg.after || msg.before);
    if (!obj || !obj.camera || !obj.id) return;
    if (msg.type === 'end') {
      endEvent(obj.camera, obj.id);
      return;
    }
    const rule = ruleFor(obj.camera);
    if (!rule.enabled || !rule.labels.includes(obj.label)) return;
    if (rule.zones.length > 0 && !zonesOf(obj).some((z) => rule.zones.includes(z))) return;
    if (dismissed.has(obj.id)) return;
    const s = state(obj.camera);
    if (!s.events.has(obj.id)) s.events.set(obj.id, now());
    s.hideAt = 0;
  }

  function reconcile(inProgress) {
    const t = now();
    const live = new Set(inProgress.map((e) => e.id));
    for (const e of inProgress) handleEvent({ type: 'update', after: e });
    for (const [camera, s] of cameras) {
      for (const [id, seenAt] of [...s.events]) {
        if (!live.has(id) && t - seenAt > GRACE_MS) endEvent(camera, id);
      }
    }
    for (const [id, at] of dismissed) {
      if (!live.has(id) && t - at > GRACE_MS) dismissed.delete(id);
    }
  }

  function setPinned(list) {
    pinned = new Set(list);
  }

  function dismiss(camera) {
    const s = cameras.get(camera);
    if (!s || pinned.has(camera)) return;
    for (const id of s.events.keys()) dismissed.set(id, now());
    s.events.clear();
    s.hideAt = 0;
  }

  function reset() {
    cameras.clear();
    dismissed.clear();
  }

  function snapshot() {
    const t = now();
    const out = [];
    for (const camera of new Set([...cameras.keys(), ...pinned])) {
      const s = cameras.get(camera) || { events: new Map(), hideAt: 0, holdMs: 0 };
      const isPinned = pinned.has(camera);
      if (s.events.size > 0) out.push({ camera, active: true, pinned: isPinned, hideAt: 0, holdMs: 0 });
      else if (isPinned) out.push({ camera, active: false, pinned: true, hideAt: 0, holdMs: 0 });
      else if (s.hideAt > t) out.push({ camera, active: false, pinned: false, hideAt: s.hideAt, holdMs: s.holdMs });
    }
    return out.sort((a, b) => a.camera.localeCompare(b.camera));
  }

  return { handleEvent, reconcile, dismiss, setPinned, reset, snapshot };
}

module.exports = { createTracker, GRACE_MS };
