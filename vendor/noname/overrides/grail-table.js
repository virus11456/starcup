import * as THREE from "./vendor/three.module.js";
import { anchorToViewport } from "./grail-viewport.js";
export function startTable(state) {
  const canvas = document.createElement("canvas");
  canvas.id = "grail-three";
  document.body.prepend(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const backdrop = document.createElement("div");
  backdrop.id = "grail-backdrop";
  document.body.prepend(backdrop);
  backdrop.append(canvas);
  const stopViewport = anchorToViewport(backdrop);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 8, 11);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xdde7ff, 0x302014, 2));
  const lamp = new THREE.PointLight(0xffd390, 55);
  lamp.position.set(0, 5, 2);
  scene.add(lamp);
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc6a569,
    metalness: 0.75,
    roughness: 0.3,
  });
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.2, 0.4, 96),
    new THREE.MeshStandardMaterial({ color: 0x17252b, roughness: 0.9 }),
  );
  table.position.y = -0.5;
  scene.add(table);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.95, 0.07, 12, 96), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.27;
  scene.add(rim);
  const cup = new THREE.Group();
  const profile = [
    [0, 0],
    [0.45, 0],
    [0.45, 0.08],
    [0.15, 0.17],
    [0.1, 0.65],
    [0.35, 0.8],
    [0.64, 1.25],
    [0.65, 1.35],
    [0.57, 1.35],
    [0.49, 1.12],
    [0.25, 0.87],
    [0, 0.82],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  cup.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), gold));
  cup.position.z = -1.8;
  scene.add(cup);
  const rings = [];
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x659cdb : 0xd97564,
        transparent: true,
        opacity: 0.3,
      }),
    );
    r.rotation.x = Math.PI / 2;
    r.position.set(
      Math.sin((i * Math.PI) / 4) * 4,
      -0.25,
      Math.cos((i * Math.PI) / 4) * 4,
    );
    scene.add(r);
    rings.push(r);
  }
  const geometry = new THREE.BufferGeometry();
  const points = new Float32Array(150 * 3);
  for (let i = 0; i < points.length; i += 3) {
    points[i] = (Math.random() - 0.5) * 14;
    points[i + 1] = Math.random() * 4;
    points[i + 2] = (Math.random() - 0.5) * 12;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const dust = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xe5c48b,
      size: 0.025,
      transparent: true,
      opacity: 0.65,
    }),
  );
  scene.add(dust);
  const resize = () => {
    const width = innerWidth >= 1050 ? innerWidth - 270 : innerWidth;
    renderer.setSize(width, innerHeight);
    camera.aspect = width / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener("resize", resize);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let id,
    previous = -1,
    pulse = 0,
    last = 0;
  function render(now) {
    id = requestAnimationFrame(render);
    if (document.hidden || now - last < 30) return;
    last = now;
    const s = state();
    if (s.turn !== previous) {
      previous = s.turn;
      pulse = 1;
    }
    pulse *= 0.97;
    rings.forEach((r, i) => {
      r.visible = i < (s.playerCount || 8);
      r.material.opacity =
        i === s.turn % Math.max(1, s.playerCount) ? 0.8 : 0.25;
    });
    lamp.intensity = 55 + pulse * 25;
    if (!reduce) {
      cup.rotation.y = Math.sin(now * 0.0002) * 0.15;
      dust.rotation.y = now * 0.000015;
    }
    renderer.render(scene, camera);
  }
  id = requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(id);
    removeEventListener("resize", resize);
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    renderer.dispose();
    stopViewport();
    backdrop.remove();
    canvas.remove();
  };
}
