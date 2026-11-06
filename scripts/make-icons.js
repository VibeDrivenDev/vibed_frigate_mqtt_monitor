const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const lens = `
  <defs>
    <radialGradient id="glass" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0a1428"/>
      <stop offset="0.45" stop-color="#173a78"/>
      <stop offset="0.8" stop-color="#2f6fd6"/>
      <stop offset="1" stop-color="#173a78"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4f5f7"/>
      <stop offset="1" stop-color="#a9afb9"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#ring)" stroke="#16181c" stroke-width="5"/>
  <circle cx="50" cy="50" r="34" fill="#16181c"/>
  <circle cx="50" cy="50" r="27" fill="url(#glass)"/>
  <circle cx="50" cy="50" r="11" fill="#050b17"/>
  <ellipse cx="38" cy="36" rx="7" ry="4.5" transform="rotate(-35 38 36)" fill="#ffffff" opacity="0.85"/>
  <circle cx="61" cy="62" r="2.6" fill="#ffffff" opacity="0.5"/>`;

const tray = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 100 100">${lens}<circle cx="82" cy="18" r="11" fill="#ff3b30" stroke="#16181c" stroke-width="4"/></svg>`;

const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4150"/><stop offset="1" stop-color="#14161a"/></linearGradient></defs>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#g)"/>
  <g transform="translate(142 142) scale(7.4)">${lens}</g>
  <circle cx="800" cy="224" r="44" fill="#ff3b30" stroke="#16181c" stroke-width="14"/>
</svg>`;

async function render(svg, size, file) {
  const win = new BrowserWindow({ width: size, height: size, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,' + encodeURIComponent(`<style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(file, img.resize({ width: size, height: size }).toPNG());
  win.destroy();
}

app.whenReady().then(async () => {
  const dir = path.join(__dirname, '..', 'assets');
  await render(tray, 64, path.join(dir, 'tray.png'));
  await render(appIcon, 1024, path.join(dir, 'icon.png'));
  app.quit();
});
app.on('window-all-closed', () => {});
