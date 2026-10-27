/* Keep all public HUD overlays aligned to the actual visual viewport
 * while the pinned Noname engine applies its own responsive body scale. */
export function hudViewportGeometry(rect, bodyWidth, viewportWidth, viewportHeight) {
  const effectiveScale = Number(rect?.width) / Number(bodyWidth);
  const scale = Number.isFinite(effectiveScale) && effectiveScale > 0
    ? effectiveScale : 1;
  const inverse = 1 / scale;
  const x = Number.isFinite(rect?.left) ? rect.left : 0;
  const y = Number.isFinite(rect?.top) ? rect.top : 0;
  return {
    scale,
    width: Math.max(0, Number(viewportWidth) || 0),
    height: Math.max(0, Number(viewportHeight) || 0),
    transform: `scale(${inverse})`,
    left: `${-x * inverse}px`,
    top: `${-y * inverse}px`,
  };
}

export function anchorToViewport(element, onScale, {
  win = window, doc = document, Observer = MutationObserver,
} = {}) {
  Object.assign(element.style, {
    position: 'fixed', left: '0', top: '0', right: 'auto', bottom: 'auto',
    transformOrigin: '0 0', pointerEvents: 'none',
  });
  let stopped = false, frame = null, lastScale = null;
  const resize = () => {
    if (stopped) return;
    const body = doc.body;
    if (!body) return;
    const geometry = hudViewportGeometry(body.getBoundingClientRect(),
      body.offsetWidth, win.innerWidth, win.innerHeight);
    for (const key of ['width', 'height', 'transform', 'left', 'top']) {
      const value = key === 'width' || key === 'height'
        ? `${geometry[key]}px` : geometry[key];
      if (element.style[key] !== value) element.style[key] = value;
    }
    if (geometry.scale !== lastScale) {
      lastScale = geometry.scale;
      onScale?.(geometry.scale);
    }
  };
  // iOS Safari fires several events per screen rotation or browser-chrome
  // transition. Recalculate once per animation frame, never on a stale
  // callback after the host iframe unloads.
  const schedule = () => {
    if (stopped || frame !== null) return;
    if (typeof win.requestAnimationFrame === 'function') {
      frame = win.requestAnimationFrame(() => { frame = null; resize(); });
    } else resize();
  };
  const observer = new Observer(schedule);
  observer.observe(doc.body, { attributes: true, attributeFilter: ['style'] });
  const windowEvents = ['resize', 'orientationchange', 'pageshow', 'scroll'];
  const viewportEvents = ['resize', 'scroll'];
  for (const name of windowEvents) win.addEventListener(name, schedule);
  for (const name of viewportEvents)
    win.visualViewport?.addEventListener?.(name, schedule);
  doc.addEventListener?.('fullscreenchange', schedule);
  resize();
  return () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    for (const name of windowEvents) win.removeEventListener(name, schedule);
    for (const name of viewportEvents)
      win.visualViewport?.removeEventListener?.(name, schedule);
    doc.removeEventListener?.('fullscreenchange', schedule);
    if (frame !== null) win.cancelAnimationFrame?.(frame);
    frame = null;
  };
}
