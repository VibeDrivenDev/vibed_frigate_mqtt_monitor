const CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'hvc1.1.6.L93.B0'];

function supportedCodecs() {
  return CODECS.filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`)).join(',');
}

function startMse(video, wsUrl, onFail) {
  let ws = null;
  let stopped = false;
  let retry = null;
  let failures = 0;
  let ms = null;
  let sb = null;
  let queue = [];

  function pump() {
    if (!sb || sb.updating || queue.length === 0) return;
    try {
      sb.appendBuffer(queue.shift());
    } catch (e) {
      queue = [];
    }
  }

  function trim() {
    if (!sb || sb.updating || sb.buffered.length === 0) return;
    const end = sb.buffered.end(sb.buffered.length - 1);
    const start = sb.buffered.start(0);
    if (end - video.currentTime > 1.5) video.currentTime = end - 0.4;
    if (video.currentTime - start > 10) sb.remove(start, video.currentTime - 5);
  }

  function open() {
    if (stopped) return;
    ms = new MediaSource();
    queue = [];
    sb = null;
    video.src = URL.createObjectURL(ms);
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ type: 'mse', value: supportedCodecs() }));
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        if (msg.type !== 'mse') return;
        const mime = msg.value;
        const attach = () => {
          sb = ms.addSourceBuffer(mime);
          sb.mode = 'segments';
          sb.onupdateend = () => { trim(); pump(); };
          pump();
        };
        if (ms.readyState === 'open') attach();
        else ms.addEventListener('sourceopen', attach, { once: true });
        return;
      }
      failures = 0;
      queue.push(ev.data);
      pump();
      video.play().catch(() => {});
    };
    ws.onclose = () => {
      if (stopped) return;
      failures += 1;
      if (failures >= 3) { onFail(); return; }
      retry = setTimeout(open, 2000);
    };
  }

  open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    if (ws) ws.close();
    video.removeAttribute('src');
    video.load();
  };
}
