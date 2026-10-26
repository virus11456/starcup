// Preserve the existing native engine and connection epoch across bfcache.
// Closing the actual page still ends this runner; it does not migrate the host.
export function createRelayLifecycle({ poll, disconnect, onStop = () => {}, onError = () => {}, onSuspend = () => {},
  window: win = window, document: doc = document, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let stopped = false, suspended = false, running = false, queued = false, timer;
  function wake(delay = 0) {
    if (stopped || suspended) return;
    if (running) { queued = true; return; }
    clearTimer(timer);
    timer = setTimer(run, delay);
  }
  async function run() {
    if (stopped || suspended || running) return;
    running = true;
    let delay = 10_000;
    try { delay = await poll(); }
    catch (error) { onError(error); }
    finally {
      running = false;
      if (delay === null) stop();
      else if (!stopped && !suspended) {
        const next = queued ? Math.min(delay, 80) : delay;
        queued = false;
        wake(next);
      }
    }
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimer(timer);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
    win.removeEventListener('online', online);
    win.removeEventListener('offline', offline);
    doc.removeEventListener('visibilitychange', visible);
    disconnect();
    onStop();
  }
  function hide(event) {
    if (!event.persisted) { stop(); return; }
    suspended = true;
    clearTimer(timer);
    onSuspend();
    disconnect();
  }
  function show(event) {
    if (!event.persisted || stopped) return;
    suspended = false;
    wake();
  }
  function online() { wake(); }
  function offline() { onSuspend(); }
  function visible() { if (doc.visibilityState === 'visible') wake(); }
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  win.addEventListener('online', online);
  win.addEventListener('offline', offline);
  doc.addEventListener('visibilitychange', visible);
  return { wake, stop, get inactive() { return stopped || suspended; } };
}
