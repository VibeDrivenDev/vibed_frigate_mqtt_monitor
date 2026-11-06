const list = document.getElementById('list');

(async () => {
  const { baseUrl, cameras, pinned } = await window.popup.getCameras();
  const base = baseUrl.replace(/\/$/, '');
  const on = new Set(pinned);
  const imgs = [];

  for (const camera of cameras) {
    const btn = document.createElement('button');
    btn.className = 'cam';
    const img = document.createElement('img');
    const name = Object.assign(document.createElement('span'), { textContent: camera });
    const badge = Object.assign(document.createElement('b'), { textContent: 'Pinned' });
    btn.append(img, name, badge);
    btn.classList.toggle('on', on.has(camera));
    btn.addEventListener('click', () => {
      const next = !on.has(camera);
      if (next) on.add(camera); else on.delete(camera);
      btn.classList.toggle('on', next);
      window.popup.setPinned(camera, next);
    });
    imgs.push(() => { img.src = `${base}/api/${camera}/latest.jpg?h=180&t=${Date.now()}`; });
    list.append(btn);
  }

  const refresh = () => imgs.forEach((f) => f());
  refresh();
  setInterval(refresh, 3000);
})();
