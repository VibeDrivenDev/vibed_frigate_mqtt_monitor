function nextFocus(focus, prevActive, tiles) {
  if (!focus) return null;
  if (!tiles.some((t) => t.camera === focus)) return null;
  const newDetection = tiles.some((t) => t.active && t.camera !== focus && !prevActive.has(t.camera));
  return newDetection ? null : focus;
}

module.exports = { nextFocus };
