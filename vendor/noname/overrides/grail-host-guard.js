// Transport availability is an independent pause reason. Never call native
// game.pause/resume here: those also belong to choices and the user's pause.
export function createHostGuard({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
  timeout = 25_000, onChange = () => {} } = {}) {
  let armed = false, stopped = false, held = false, lastReply = 0, revision = 0, timer, pending, release;
  function hold() {
    if (!armed) return;
    revision++;
    if (held) return;
    held = true;
    clearTimer(timer);
    pending = new Promise(resolve => { release = resolve; });
    onChange(true);
  }
  function check() {
    if (armed && !held && (now() - lastReply >= timeout || now() < lastReply)) hold();
    return held;
  }
  function confirm(ticket = revision) {
    if (stopped || ticket !== revision) return false;
    lastReply = now();
    if (!armed) return true;
    clearTimer(timer);
    timer = setTimer(check, timeout);
    if (held) {
      held = false;
      const resolve = release;
      release = pending = undefined;
      onChange(false);
      resolve();
    }
    return true;
  }
  return {
    arm() { if (!stopped && !armed) { armed = true; confirm(); } },
    hold, confirm,
    ticket() { check(); return revision; },
    stop() { stopped = true; armed = true; hold(); clearTimer(timer); },
    get blocked() { return check(); },
    async wait() {
      // Recheck after resolving: a page can lose connectivity again before
      // the continuation gets its turn. A stopped host never releases work.
      while (check()) await pending;
    },
  };
}

export function guardHostInput(win, guard) {
  const types = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'keydown', 'keyup'];
  const options = { capture: true, passive: false };
  const block = event => {
    if (!guard.blocked) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of types) win.addEventListener(type, block, options);
  return () => { for (const type of types) win.removeEventListener(type, block, options); };
}
