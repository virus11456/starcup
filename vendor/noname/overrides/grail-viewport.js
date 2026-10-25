/* Keep viewport overlays independent of the upstream body's responsive scale. */
export function anchorToViewport(element, onScale) {
  Object.assign(element.style, {
    position: "fixed", left: "0", top: "0", right: "auto", bottom: "auto",
    transformOrigin: "0 0", pointerEvents: "none",
  });
  const resize = () => {
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const scale = body.offsetWidth ? rect.width / body.offsetWidth : 1;
    const inverse = scale > 0 ? 1 / scale : 1;
    element.style.width = `${innerWidth}px`;
    element.style.height = `${innerHeight}px`;
    element.style.transform = `scale(${inverse})`;
    element.style.left = `${-rect.left * inverse}px`;
    element.style.top = `${-rect.top * inverse}px`;
    onScale?.(scale);
  };
  resize();
  const observer = new MutationObserver(resize);
  observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("resize", resize);
  };
}
