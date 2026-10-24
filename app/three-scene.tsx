"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { RoomView } from "@/lib/game";
import { ROLES, roleFor } from "@/lib/roles";

type Props = {
  mode: "hero" | "table";
  room?: RoomView;
  target?: string;
  onSelect?: (id: string) => void;
};
type Runtime = {
  scene: THREE.Scene;
  players: THREE.Group;
  cup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  reset: () => void;
  portraits: Map<string, THREE.Texture>;
};
function cleanup(
  root: THREE.Object3D,
  keepTextures = new Set<THREE.Texture>(),
) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map && !keepTextures.has(map)) textures.add(map);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
function gold() {
  return new THREE.MeshStandardMaterial({
    color: 0xcba75e,
    metalness: 0.7,
    roughness: 0.28,
  });
}
function makeCup() {
  const g = new THREE.Group();
  const points = [
    [0, 0],
    [0.58, 0],
    [0.63, 0.08],
    [0.61, 0.15],
    [0.3, 0.2],
    [0.12, 0.36],
    [0.1, 1.02],
    [0.32, 1.15],
    [0.52, 1.35],
    [0.72, 1.7],
    [0.83, 2.1],
    [0.85, 2.3],
    [0.79, 2.32],
    [0.74, 2.06],
    [0.63, 1.7],
    [0.44, 1.42],
    [0.2, 1.3],
    [0, 1.28],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(points, 48), gold());
  cup.castShadow = true;
  cup.receiveShadow = true;
  g.add(cup);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.035, 8, 64),
    gold(),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.3;
  g.add(rim);
  for (const dir of [-1, 1]) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.055, 10, 32, Math.PI * 1.4),
      gold(),
    );
    handle.rotation.z = dir > 0 ? -Math.PI * 0.7 : Math.PI * 0.3;
    handle.position.set(dir * 0.8, 1.83, 0);
    g.add(handle);
  }
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2),
    new THREE.MeshStandardMaterial({
      color: 0xffdaa0,
      emissive: 0xcf9728,
      emissiveIntensity: 0.6,
      metalness: 0.35,
      roughness: 0.18,
    }),
  );
  gem.position.set(0, 1.78, 0.71);
  g.add(gem);
  const star = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.19),
    new THREE.MeshStandardMaterial({
      color: 0xffe0a2,
      emissive: 0xdca34f,
      emissiveIntensity: 1.5,
    }),
  );
  star.position.y = 2.9;
  star.name = "star";
  g.add(star);
  return g;
}
function label(text: string, color: string, width = 512, height = 96) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `500 34px "Noto Sans TC",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2, width - 16);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(2.7, 0.5, 1);
  sprite.renderOrder = 5;
  return sprite;
}
function cardTexture() {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 240;
  const x = c.getContext("2d")!;
  x.fillStyle = "#172331";
  x.fillRect(0, 0, 160, 240);
  x.strokeStyle = "#9f8855";
  x.lineWidth = 3;
  x.strokeRect(8, 8, 144, 224);
  x.lineWidth = 1;
  x.strokeRect(15, 15, 130, 210);
  x.save();
  x.translate(80, 120);
  x.rotate(Math.PI / 4);
  x.strokeRect(-38, -38, 76, 76);
  x.restore();
  x.beginPath();
  x.arc(80, 120, 45, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#c4a567";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "50px serif";
  x.fillText("✦", 80, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export default function ThreeScene({ mode, room, target, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const targetRef = useRef(target);
  targetRef.current = target;
  const actorRef = useRef(room?.actor);
  actorRef.current = room?.actor;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = mode === "table";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      mode === "table"
        ? "可拖曳旋轉的 3D 對戰桌；亦可使用下方玩家按鈕選擇目標"
        : "3D 金色星杯",
    );
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      mode === "hero" ? 37 : 39,
      1,
      0.1,
      100,
    );
    camera.position.set(
      ...((mode === "hero" ? [4.3, 3.5, 7.3] : [0, 9.5, 11.8]) as [
        number,
        number,
        number,
      ]),
    );
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, mode === "hero" ? 1.5 : 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.enableZoom = mode === "table";
    controls.minDistance = 8;
    controls.maxDistance = 19;
    controls.maxPolarAngle = Math.PI / 2.5;
    controls.minPolarAngle = 0.2;
    controls.autoRotate = mode === "hero";
    controls.autoRotateSpeed = 0.4;
    controls.update();
    const reset = () => {
      camera.position.set(0, 9.5, 11.8);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    scene.add(new THREE.HemisphereLight(0xd6e3ff, 0x131a24, 2.7));
    const key = new THREE.DirectionalLight(0xffe0a0, 4);
    key.position.set(3, 8, 4);
    key.castShadow = mode === "table";
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.001;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8aaeda, 2);
    fill.position.set(-4, 4, -4);
    scene.add(fill);
    const warm = new THREE.PointLight(0xe7b65c, 8, 12);
    warm.position.set(0, 3, 0);
    scene.add(warm);
    const cup = makeCup();
    scene.add(cup);
    const players = new THREE.Group();
    scene.add(players);
    if (mode === "table") {
      cup.scale.setScalar(0.63);
      cup.position.y = 0.1;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(5.8, 6, 0.3, 96),
        new THREE.MeshStandardMaterial({
          color: 0x14202a,
          roughness: 0.85,
          metalness: 0.18,
        }),
      );
      base.position.y = -0.22;
      base.receiveShadow = true;
      scene.add(base);
      for (const radius of [5.6, 5.45, 3.6, 1.45]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.016, 5, 100),
          new THREE.MeshStandardMaterial({
            color: 0xa48c53,
            metalness: 0.6,
            roughness: 0.3,
          }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.05;
        scene.add(ring);
      }
      for (let i = 0; i < 12; i++) {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.045),
          gold(),
        );
        diamond.position.set(
          Math.sin((i * Math.PI) / 6) * 3.6,
          0,
          Math.cos((i * Math.PI) / 6) * 3.6,
        );
        scene.add(diamond);
      }
      const mat = new THREE.MeshStandardMaterial({
        map: cardTexture(),
        roughness: 0.8,
      });
      for (let i = 0; i < 7; i++) {
        const card = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.035, 0.8), [
          new THREE.MeshStandardMaterial({ color: 0x9e9686 }),
          new THREE.MeshStandardMaterial({ color: 0x9e9686 }),
          mat,
          mat,
          new THREE.MeshStandardMaterial({ color: 0x9e9686 }),
          new THREE.MeshStandardMaterial({ color: 0x9e9686 }),
        ]);
        card.position.set(1.48, 0.03 + i * 0.033, 0.4);
        card.rotation.y = 0.2;
        card.castShadow = true;
        scene.add(card);
      }
    } else {
      cup.position.y = 0.1;
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.2, 0.18, 64),
        new THREE.MeshStandardMaterial({
          color: 0x17212d,
          metalness: 0.5,
          roughness: 0.3,
        }),
      );
      pedestal.position.y = -0.05;
      scene.add(pedestal);
      for (const r of [1.75, 2.15]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.009, 4, 100),
          new THREE.MeshBasicMaterial({
            color: 0x9c834e,
            transparent: true,
            opacity: 0.35,
          }),
        );
        ring.rotation.x = Math.PI / 2.3;
        ring.rotation.z = 0.3;
        ring.position.y = 1.3;
        scene.add(ring);
      }
    }
    const stars = new Float32Array(240 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      stars[i] = (Math.random() - 0.5) * 18;
      stars[i + 1] = Math.random() * 7;
      stars[i + 2] = (Math.random() - 0.5) * 14;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    const particles = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xd6bc80,
        size: 0.018,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(particles);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (w && h) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let visible = true;
    const visibility = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
    });
    visibility.observe(host);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let start = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (
        mode !== "table" ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      for (const hit of raycaster.intersectObjects(players.children, true)) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData.playerId) obj = obj.parent;
        if (obj?.userData.playerId) {
          selectRef.current?.(obj.userData.playerId);
          break;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    let frame = 0;
    let last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = mode === "hero" && !reduced;
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden || now - last < 1000 / 40) return;
      last = now;
      controls.update();
      const star = cup.getObjectByName("star");
      if (star && !reduced) {
        star.rotation.y = now * 0.0007;
        star.position.y = 2.9 + Math.sin(now * 0.001) * 0.06;
      }
      players.children.forEach((g) => {
        const isActive = g.userData.playerId === actorRef.current;
        const isTarget = g.userData.playerId === targetRef.current;
        const marker = g.getObjectByName("selection") as THREE.Mesh;
        if (marker) {
          marker.visible = isActive || isTarget;
          const m = marker.material as THREE.MeshBasicMaterial;
          m.color.setHex(isTarget ? 0xffd685 : 0xc0d9ba);
          m.opacity = 0.75;
        }
        const crystal = g.getObjectByName("crystal");
        if (crystal && !reduced)
          crystal.position.y =
            0.93 + Math.sin(now * 0.0017 + g.position.x) * 0.05;
      });
      renderer.render(scene, camera);
    };
    const portraits = new Map<string, THREE.Texture>();
    if (mode === "table") {
      const loader = new THREE.TextureLoader();
      for (const role of ROLES) {
        const texture = loader.load(`/roles/${role.id}.png`);
        texture.colorSpace = THREE.SRGBColorSpace;
        portraits.set(role.id, texture);
      }
    }
    runtime.current = {
      scene,
      players,
      cup,
      camera,
      controls,
      reset,
      portraits,
    };
    frame = requestAnimationFrame(animate);
    setLoaded(true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      cleanup(scene, new Set(portraits.values()));
      portraits.forEach((texture) => texture.dispose());
      starGeo.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [mode]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt || mode !== "table" || !room) return;
    cleanup(rt.players, new Set(rt.portraits.values()));
    rt.players.clear();
    const count = room.players.length;
    room.players.forEach((p, i) => {
      const g = new THREE.Group();
      g.userData.playerId = p.id;
      const a = (i / count) * Math.PI * 2;
      g.position.set(Math.sin(a) * 4.35, 0, Math.cos(a) * 4.35);
      const color = p.team === "red" ? 0xcb737b : 0x73a7cd;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.6, 0.16, 32),
        new THREE.MeshStandardMaterial({
          color: 0x24313e,
          metalness: 0.45,
          roughness: 0.35,
        }),
      );
      base.castShadow = true;
      g.add(base);
      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.022, 6, 36),
        new THREE.MeshBasicMaterial({ color }),
      );
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.1;
      g.add(trim);
      const portrait = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: rt.portraits.get(roleFor(p.avatar).id),
          toneMapped: false,
        }),
      );
      portrait.scale.set(1.05, 1.45, 1);
      portrait.position.y = 0.92;
      g.add(portrait);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.027, 5, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffd685,
          transparent: true,
          opacity: 0.75,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      ring.name = "selection";
      ring.visible = p.id === room.actor || p.id === targetRef.current;
      g.add(ring);
      const name = label(
        `${p.name}${p.id === room.me ? " · 你" : ""}`,
        p.team === "red" ? "#e1aaad" : "#abcce2",
      );
      name.position.set(0, 1.98, 0);
      g.add(name);
      const hand = label(
        `${p.bot ? "電腦" : "玩家"}  ·  ${p.handCount} 張手牌`,
        "#8d9eb6",
      );
      hand.position.set(0, 1.72, 0);
      hand.scale.set(2.1, 0.39, 1);
      g.add(hand);
      for (let c = 0; c < Math.min(p.handCount, 8); c++) {
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.29, 0.025, 0.44),
          new THREE.MeshStandardMaterial({
            color: 0x1b2939,
            metalness: 0.2,
            roughness: 0.5,
          }),
        );
        back.position.set(
          (c - (Math.min(p.handCount, 8) - 1) / 2) * 0.15,
          0.03,
          -0.88,
        );
        back.rotation.y = (c - (p.handCount - 1) / 2) * 0.08;
        g.add(back);
      }
      rt.players.add(g);
    });
  }, [room?.revision, room?.code, mode, loaded]);
  return (
    <div
      className={`three-container ${mode === "hero" ? "three-hero" : "three-table"}`}
    >
      <div className="three-canvas" ref={container} />
      {failed ? (
        <div className="three-fallback">
          <span className="fallback-grail">♜</span>
          <p>此裝置不支援 3D，已切換為平面桌面。角色與卡牌仍可正常操作。</p>
        </div>
      ) : !loaded ? (
        <div className="three-loading">
          ✦<span>正在喚醒星界…</span>
        </div>
      ) : null}
      {mode === "table" && (
        <div className="scene-toolbar">
          <span>
            <i />
            THREE.JS · 3D 戰場
          </span>
          <span>拖曳旋轉 · 滾輪縮放 · 點選棋子</span>
          <button onClick={() => runtime.current?.reset()}>重設視角</button>
        </div>
      )}
    </div>
  );
}
