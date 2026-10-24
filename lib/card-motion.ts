import * as THREE from "three";

export type Point = { x: number; y: number };
export type Flight = {
  type: "draw" | "play" | "place" | "discard";
  from: Point;
  to: Point;
  image?: string;
  label?: string;
  color?: string;
  delay?: number;
};
export const center = (element: Element | null, fallback: Point): Point => {
  const r = element?.getBoundingClientRect();
  return r && r.width && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : fallback;
};

/** Visual-only overlay. Never waits for or changes game-rule execution. */
export function createCardMotion(host: HTMLElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, innerWidth, 0, -innerHeight, 1, 2000);
  camera.position.z = 1000;
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);
  } catch { /* Flat animation remains available without WebGL. */ }
  host.dataset.renderer = renderer ? "three" : "flat";
  const textures = new Map<string, THREE.Texture>();
  const animations = new Set<Animation>();
  let disposed = false;
  let frame = 0;
  let completed = 0;
  type Active = { f: Flight; start: number; mesh: THREE.Mesh; ring: THREE.Mesh; material: THREE.MeshBasicMaterial[]; };
  const active: Active[] = [];
  function texture(src?: string, title = "星杯傳說") {
    const key = src || "back";
    const old = textures.get(key);
    if (old) return old;
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 352;
    const ctx = canvas.getContext("2d")!;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    function paint(img?: HTMLImageElement) {
      ctx.fillStyle = "#102b35"; ctx.fillRect(0, 0, 256, 352);
      if (img) ctx.drawImage(img, 10, 10, 236, 300);
      ctx.strokeStyle = "#e2bb6d"; ctx.lineWidth = 5; ctx.strokeRect(6, 6, 244, 340);
      ctx.lineWidth = 1; ctx.strokeRect(16, 16, 224, 320);
      ctx.fillStyle = "#efdbaf"; ctx.textAlign = "center";
      ctx.font = src ? "bold 19px sans-serif" : "64px serif";
      ctx.fillText(src ? title : "✦", 128, src ? 333 : 190, 218);
      t.needsUpdate = true;
    }
    paint();
    if (src) { const img = new Image(); img.onload = () => { if (!disposed) paint(img); }; img.src = src; }
    textures.set(key, t);
    return t;
  }
  function complete(type: Flight["type"]) {
    host.dataset.completed = String(++completed);
    const key = `completed${type[0].toUpperCase()}${type.slice(1)}`;
    host.dataset[key] = String(Number(host.dataset[key] || 0) + 1);
  }
  function flat(f: Flight) {
    const el = document.createElement("div");
    el.className = "grail-flight-card";
    el.style.cssText = "position:absolute;left:0;top:0;width:88px;height:122px;border:2px solid #e0b871;border-radius:9px;background:#122b35;box-shadow:0 8px 25px #0009;overflow:hidden;display:grid;place-items:center;color:#f3dfaa;font:32px serif";
    if (f.image) { const img = document.createElement("img"); img.src = f.image; img.alt = ""; img.style.cssText = "width:100%;height:100%;object-fit:contain"; el.append(img); }
    else el.textContent = "✦";
    host.append(el);
    const at = (p: Point, s: number, angle = 0, flip = 0) => `translate(${p.x - 44}px,${p.y - 61}px) perspective(650px) rotateY(${flip}deg) rotate(${angle}deg) scale(${s})`;
    const middle = { x: (f.from.x + f.to.x) / 2, y: Math.max(75, Math.min(f.from.y, f.to.y) - 65) };
    const keys = reduced.matches ? [{ transform: at(f.to, .9), opacity: .6 }, { transform: at(f.to, 1), opacity: 0 }] : [
      { transform: at(f.from, .65, -12, f.type === "draw" ? 90 : 0), opacity: 0, offset: 0 },
      { transform: at(f.from, .9, -7), opacity: 1, offset: .1 },
      { transform: at(middle, 1.25, f.type === "discard" ? 18 : -5), opacity: 1, offset: .48 },
      { transform: at(f.to, f.type === "play" ? 1.05 : f.type === "place" ? .85 : .65, f.type === "discard" ? 32 : 0), opacity: 1, offset: .85 },
      { transform: at(f.to, .6), opacity: 0, offset: 1 },
    ];
    const animation = el.animate(keys, { duration: reduced.matches ? 140 : f.type === "place" ? 1050 : 850, delay: f.delay || 0, easing: "cubic-bezier(.2,.65,.3,1)", fill: "both" });
    animations.add(animation);
    animation.finished.then(() => complete(f.type), () => {}).finally(() => { animations.delete(animation); el.remove(); });
    if (!reduced.matches && (f.type === "play" || f.type === "place")) {
      const ring = document.createElement("div");
      ring.style.cssText = `position:absolute;left:${f.to.x - 30}px;top:${f.to.y - 30}px;width:60px;height:60px;border:2px solid ${f.color || "#e9cc8f"};border-radius:50%;box-shadow:0 0 18px ${f.color || "#e9cc8f"};opacity:0`;
      host.append(ring);
      const pulse = ring.animate([{ transform: "scale(.7)", opacity: .8 }, { transform: `scale(${f.type === "place" ? 1.5 : 2.2})`, opacity: 0 }], { duration: 360, delay: (f.delay || 0) + (f.type === "place" ? 750 : 550), fill: "both" });
      animations.add(pulse);
      pulse.finished.catch(() => {}).finally(() => { animations.delete(pulse); ring.remove(); });
    }
  }
  function release(a: Active) {
    scene.remove(a.mesh, a.ring);
    a.mesh.geometry.dispose(); a.ring.geometry.dispose();
    a.material.forEach(m => m.dispose()); (a.ring.material as THREE.Material).dispose();
  }
  function animate(now: number) {
    frame = 0;
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i], p = Math.min(1, Math.max(0, (now - a.start) / (a.f.type === "place" ? 1100 : 950)));
      if (now < a.start) { a.mesh.visible = a.ring.visible = false; continue; }
      a.mesh.visible = true;
      const t = p * p * (3 - 2 * p);
      const arc = Math.sin(p * Math.PI);
      a.mesh.position.set(THREE.MathUtils.lerp(a.f.from.x, a.f.to.x, t), -THREE.MathUtils.lerp(a.f.from.y, a.f.to.y, t) + arc * 100, arc * 100);
      a.mesh.rotation.set(arc * -.24, a.f.type === "draw" && a.f.image ? Math.PI * (1 - Math.min(1, p * 1.6)) : arc * .45, a.f.type === "discard" ? t * -.6 : arc * .15);
      const s = .7 + arc * .48;
      a.mesh.scale.setScalar(s);
      const opacity = p < .08 ? p / .08 : p > .88 ? (1 - p) / .12 : 1;
      a.material.forEach(m => { m.opacity = opacity; });
      const hit = Math.max(0, (p - .65) / .35);
      a.ring.visible = (a.f.type === "play" || a.f.type === "place") && hit > 0;
      a.ring.position.set(a.f.to.x, -a.f.to.y, 0);
      a.ring.scale.setScalar(1 + hit * (a.f.type === "place" ? 1.3 : 2.5));
      (a.ring.material as THREE.MeshBasicMaterial).opacity = (1 - hit) * .65;
      if (p === 1) { release(a); active.splice(i, 1); complete(a.f.type); }
    }
    renderer?.render(scene, camera);
    if (active.length) frame = requestAnimationFrame(animate);
  }
  function clear() {
    cancelAnimationFrame(frame); frame = 0;
    active.splice(0).forEach(release);
    animations.forEach(a => a.cancel());
    renderer?.clear();
  }
  function resize() {
    clear(); camera.right = innerWidth; camera.bottom = -innerHeight; camera.updateProjectionMatrix();
    renderer?.setSize(innerWidth, innerHeight);
  }
  const visibility = () => { if (document.hidden) clear(); };
  const lost = (e: Event) => { e.preventDefault(); clear(); renderer?.dispose(); renderer?.domElement.remove(); renderer = undefined; host.dataset.renderer = "flat"; };
  renderer?.domElement.addEventListener("webglcontextlost", lost);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", visibility);
  reduced.addEventListener("change", clear);
  return {
    play(f: Flight) {
      if (disposed || document.hidden || active.length + animations.size >= 24) return;
      host.dataset.lastMotion = f.type;
      host.dataset.started = String(Number(host.dataset.started || 0) + 1);
      const key = `started${f.type[0].toUpperCase()}${f.type.slice(1)}`;
      host.dataset[key] = String(Number(host.dataset[key] || 0) + 1);
      if (!renderer || reduced.matches) { flat(f); return; }
      const edge = () => new THREE.MeshBasicMaterial({ color: 0xd8b779, transparent: true });
      const materials = [edge(), edge(), edge(), edge(), new THREE.MeshBasicMaterial({ map: texture(f.image, f.label), transparent: true }), new THREE.MeshBasicMaterial({ map: texture(), transparent: true })];
      const width = innerWidth < 600 ? 76 : 100;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width * 1.38, 3), materials);
      const ring = new THREE.Mesh(new THREE.RingGeometry(24, 27, 48), new THREE.MeshBasicMaterial({ color: f.color || "#edc574", transparent: true, opacity: 0, side: THREE.DoubleSide }));
      scene.add(mesh, ring);
      active.push({ f, mesh, ring, material: materials, start: performance.now() + (f.delay || 0) });
      if (!frame) frame = requestAnimationFrame(animate);
    },
    dispose() {
      disposed = true; clear(); textures.forEach(t => t.dispose());
      renderer?.domElement.removeEventListener("webglcontextlost", lost);
      renderer?.dispose(); renderer?.domElement.remove();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", clear);
    },
  };
}
