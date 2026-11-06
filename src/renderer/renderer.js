const grid = document.getElementById('grid');
const tiles = new Map();
let currentFocus = null;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentFocus) window.popup.setFocus(null);
});

function makeTile(camera, stream, baseUrl) {
  const el = document.createElement('div');
  el.className = 'tile';
  const label = Object.assign(document.createElement('div'), { className: 'label', textContent: camera });
  const hold = Object.assign(document.createElement('div'), { className: 'hold' });
  const pie = Object.assign(document.createElement('div'), { className: 'pie' });
  const secs = document.createElement('span');
  hold.append(pie, secs);
  const video = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true });
  const base = baseUrl.replace(/\/$/, '');
  const snap = document.createElement('img');
  const pollSnap = () => { snap.src = `${base}/api/${camera}/latest.jpg?h=360&t=${Date.now()}`; };
  pollSnap();
  const snapTimer = setInterval(pollSnap, 1000);
  video.addEventListener('playing', () => { clearInterval(snapTimer); snap.remove(); }, { once: true });
  const actions = Object.assign(document.createElement('div'), { className: 'actions' });
  const pinBtn = Object.assign(document.createElement('button'), { textContent: 'Pin' });
  const closeBtn = Object.assign(document.createElement('button'), { textContent: '\u2715', title: 'Close' });
  actions.append(pinBtn, closeBtn);
  const more = Object.assign(document.createElement('div'), { className: 'more' });
  el.append(snap, video, label, hold, actions, more);
  const tile = { el, hold, pie, secs, pinBtn, closeBtn, more, pinned: false };
  pinBtn.addEventListener('click', (e) => { e.stopPropagation(); window.popup.setPinned(camera, !tile.pinned); });
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); window.popup.dismiss(camera); });
  el.addEventListener('click', () => window.popup.setFocus(currentFocus === camera ? null : camera));

  const wsBase = baseUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  let stopMse = startMse(video, `${wsBase}/live/mse/api/ws?src=${encodeURIComponent(stream)}`, () => {
    stopMse = () => {};
    video.remove();
    stopMse = () => {};
  });
  tile.stop = () => { clearInterval(snapTimer); stopMse(); };
  return tile;
}

window.popup.onTiles(({ baseUrl, cols, focus, tiles: list }) => {
  currentFocus = focus;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const keep = new Set(list.map((t) => t.camera));
  for (const [camera, t] of tiles) {
    if (!keep.has(camera)) { t.stop(); t.el.remove(); tiles.delete(camera); }
  }
  for (const t of list) {
    let tile = tiles.get(t.camera);
    if (!tile) {
      tile = makeTile(t.camera, t.stream, baseUrl);
      tiles.set(t.camera, tile);
      grid.append(tile.el);
    }
    tile.hideAt = t.active ? 0 : t.hideAt;
    tile.holdMs = t.holdMs;
    tile.pinned = t.pinned;
    tile.pinBtn.textContent = t.pinned ? 'Unpin' : 'Pin';
    tile.closeBtn.style.display = t.pinned ? 'none' : '';
    tile.el.classList.toggle('hidden', !!focus && focus !== t.camera);
    tile.more.style.display = focus === t.camera && list.length > 1 ? 'block' : 'none';
    tile.more.textContent = `+${list.length - 1} more`;
  }
});

setInterval(() => {
  for (const t of tiles.values()) {
    const leftMs = t.hideAt ? Math.max(0, t.hideAt - Date.now()) : 0;
    t.hold.style.display = t.hideAt || t.pinned ? 'flex' : 'none';
    t.pie.style.display = t.pinned ? 'none' : 'block';
    if (t.pinned) { t.secs.textContent = 'Pinned'; continue; }
    t.secs.textContent = `${Math.ceil(leftMs / 1000)}s`;
    t.pie.style.setProperty('--p', `${t.holdMs ? (leftMs / t.holdMs) * 360 : 0}deg`);
  }
}, 100);
