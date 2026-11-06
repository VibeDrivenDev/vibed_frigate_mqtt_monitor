const ASPECT = 16 / 9;

function fitGrid(count, maxW, maxH) {
  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = Math.floor(Math.min(maxW / cols, (maxH / rows) * ASPECT));
    if (!best || tileW > best.tileW) best = { cols, rows, tileW };
  }
  const tileH = Math.floor(best.tileW / ASPECT);
  return { cols: best.cols, rows: best.rows, tileW: best.tileW, tileH, width: best.cols * best.tileW, height: best.rows * tileH };
}

module.exports = { fitGrid };
