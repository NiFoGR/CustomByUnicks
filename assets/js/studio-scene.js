/* ==========================================================================
   UNICKS custom design studio: the 3D room
   --------------------------------------------------------------------------
   The room is built from code rather than loaded as a fixed model, so it
   rebuilds the moment an option changes. Real fittings modelled in Blender
   can replace any part later: export them as .glb and load them in place of
   the matching function below.

   Units are metres. x runs across the room (width W), z runs back to front
   (length L), y is up. The back wall sits at z = -L/2.
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const H = 2.4;          // ceiling height
const T = 0.12;         // wall thickness, shown where the model is cut open
const GAP = 0.0025;     // joint between stone slabs
const TEX = 2.4;        // one texture covers 2.4m of stone
const UP = new THREE.Vector3(0, 1, 0);
const LED = new THREE.Color(1, 0.7, 0.4);         // warm white strip, about 2700K
const GOLD = new THREE.Color(0xc6a15b);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (v) => v - Math.floor(v);

const STONE_TINT = { black: 0x2b2b2c, brown: 0x4b3d33, cream: 0xd8cbb4, travertine: 0x9c8f80 };
const METALS = {
  brass:  { color: 0xd2a865, metalness: 1, roughness: 0.32 },
  black:  { color: 0x1a1a1a, metalness: 0.55, roughness: 0.5 },
  gun:    { color: 0x55575b, metalness: 1, roughness: 0.3 },
  nickel: { color: 0xcfcdc8, metalness: 1, roughness: 0.24 }
};

/* ---------- small helpers ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// collects flat quads into one geometry (one draw call per wall and material)
class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  add(o, u, v, n, w, h, uv) {
    const k = this.p.length / 3;
    const a = o, b = o.clone().addScaledVector(u, w), c = b.clone().addScaledVector(v, h), d = o.clone().addScaledVector(v, h);
    const t = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    [a, b, c, d].forEach((p, j) => { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(t[j][0], t[j][1]); });
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  get empty() { return !this.i.length; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    return g;
  }
}

// rectangle minus holes, as a list of rectangles (s along the wall, y up)
function cut(rect, holes) {
  let out = [rect];
  holes.forEach((h) => {
    const next = [];
    out.forEach((r) => {
      if (h.s1 <= r.s0 || h.s0 >= r.s1 || h.y1 <= r.y0 || h.y0 >= r.y1) { next.push(r); return; }
      if (h.y1 < r.y1) next.push({ s0: r.s0, s1: r.s1, y0: h.y1, y1: r.y1 });
      if (h.y0 > r.y0) next.push({ s0: r.s0, s1: r.s1, y0: r.y0, y1: h.y0 });
      const y0 = Math.max(r.y0, h.y0), y1 = Math.min(r.y1, h.y1);
      if (h.s0 > r.s0) next.push({ s0: r.s0, s1: h.s0, y0, y1 });
      if (h.s1 < r.s1) next.push({ s0: h.s1, s1: r.s1, y0, y1 });
    });
    out = next;
  });
  return out.filter((r) => r.s1 - r.s0 > 1e-4 && r.y1 - r.y0 > 1e-4);
}

// stone boxes get texture coordinates from their size, so veins stay to scale
function stoneUV(g, ox = 0, oy = 0) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let a, b;
    if (ay >= ax && ay >= az) { a = p.getX(i); b = p.getZ(i); }
    else if (ax >= az) { a = p.getZ(i); b = p.getY(i); }
    else { a = p.getX(i); b = p.getY(i); }
    uv.setXY(i, a / TEX + ox, b / TEX + oy);
  }
  uv.needsUpdate = true;
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* soft light and shadow shapes, drawn once */
const SHAPES = {};
function shapes() {
  if (SHAPES.down) return SHAPES;
  // bright at the top edge, fading down, soft at the sides
  SHAPES.down = canvasTex(64, 256, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = j / (h - 1), u = i / (w - 1);
      const side = Math.min(1, Math.min(u, 1 - u) / 0.18);
      const a = Math.pow(1 - v, 2.2) * side * side * (3 - 2 * side);
      const k = (j * w + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
  });
  // bright at both side edges (light from vertical strips)
  SHAPES.sides = canvasTex(256, 64, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / (w - 1), v = j / (h - 1);
      const e = Math.pow(1 - Math.min(u, 1 - u) * 2, 2.5);
      const vert = Math.min(1, Math.min(v, 1 - v) / 0.12);
      const k = (j * w + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round((0.25 + 0.75 * e) * vert * 255);
    }
    x.putImageData(img, 0, 0);
  });
  SHAPES.round = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  // glow around a rectangle (backlit mirror)
  SHAPES.halo = canvasTex(256, 256, (x, w, h) => {
    x.filter = 'blur(14px)';
    x.fillStyle = '#fff';
    x.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
  });
  SHAPES.pedestal = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#1f1a15'); g.addColorStop(0.55, '#120f0d'); g.addColorStop(1, '#0b0a09');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  return SHAPES;
}

/* ==========================================================================
   createStudio(host, options) -> api
   ========================================================================== */
export function createStudio(host, opt) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const Q = { dpr: small ? 1.5 : 2, tex: small ? '1k' : '2k', shadow: small ? 1024 : 2048, mirror: small ? 0.45 : 0.7 };
  const reduced = !!opt.reduced;

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a09);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 0.4;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minAzimuthAngle = -Math.PI * 0.62;
  controls.maxAzimuthAngle = Math.PI * 0.62;

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 30, cubeRT);
  let envRT = null;

  /* ---------- materials ---------- */
  const S = shapes();
  const M = {
    wall: new THREE.MeshStandardMaterial({ roughness: 0.2 }),
    floor: new THREE.MeshStandardMaterial({ roughness: 0.26 }),
    wood: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
    metal: new THREE.MeshStandardMaterial(),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    bath: new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xeef4f2, roughness: 0.02, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }),
    shell: new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.9 }),
    groutDark: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.95 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xe4ded4, roughness: 0.95 }),
    door: new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.55 }),
    groove: new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 1 }),
    mirrorEdge: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.2, metalness: 0.4 }),
    inlay: new THREE.MeshStandardMaterial({ roughness: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    inlayMetal: new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }),
    hair: new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.15) }),
    strip: new THREE.MeshBasicMaterial({ color: LED.clone().multiplyScalar(7) }),
    sconce: new THREE.MeshStandardMaterial({ color: 0xf4e6cf, roughness: 0.6, emissive: LED, emissiveIntensity: 2.2 }),
    downlight: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66).multiplyScalar(3) }),
    bottleA: new THREE.MeshPhysicalMaterial({ color: 0x6b3a12, roughness: 0.1, transmission: 0, clearcoat: 1 }),
    bottleB: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
    bottleC: new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.4 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x3f5a35, roughness: 0.8 }),
    towel: new THREE.MeshStandardMaterial({ color: 0xe9e3d8, roughness: 1 }),
    pedestal: new THREE.MeshBasicMaterial({ map: S.pedestal }),
    dim: new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 })
  };
  const glows = [];     // additive light shapes, scaled together for day and evening
  const glowMat = (shape, k) => {
    const m = new THREE.MeshBasicMaterial({ map: shape, color: LED.clone().multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    m.userData.k = k; glows.push(m); return m;
  };
  const aoMat = (shape, o) => new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shape, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const AO = { down: aoMat(S.down, 0.55), round: aoMat(S.round, 0.6) };

  /* ---------- textures, loaded only when a finish is picked ---------- */
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const base = new URL('../tex/', import.meta.url).href;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function tex(name) {
    if (!texCache[name]) {
      texCache[name] = new Promise((resolve) => {
        loader.load(base + name + '-' + (name === 'walnut' || name === 'oak' ? '1k' : Q.tex) + '.webp', (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = aniso;
          resolve(t);
        }, undefined, () => resolve(null));
      });
    }
    return texCache[name];
  }
  function setMap(mat, name, tint) {
    mat.userData.want = name;
    if (!mat.map || mat.userData.has !== name) { mat.map = null; mat.color.set(tint); mat.needsUpdate = true; }
    return tex(name).then((t) => {
      if (mat.userData.want !== name) return;
      if (t) { mat.map = t; mat.color.set(0xffffff); mat.userData.has = name; mat.needsUpdate = true; }
    });
  }

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0xfff0dd, 0x3a2e24, 0.5);
  scene.add(hemi);

  const pedestal = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.pedestal);
  pedestal.rotation.x = -Math.PI / 2; pedestal.position.y = -0.121;
  scene.add(pedestal);

  /* ---------- state ---------- */
  let st = null, P = null;                 // current design and its derived layout
  let room = null, walls = {}, ceiling = null, dims = null, mirror = null, spots = [];
  let mood = false, dirty = true, tween = null, active = true, built = false;

  function layout(s) {
    const W = s.w, L = s.l;
    const sw = clamp(W * 0.38, 0.9, 1.4), sd = clamp(L * 0.34, 0.9, 1.2);
    const xs = W / 2 - sw, zf = -L / 2 + sd;
    const bath = s.layout === 'bath' && L >= 2.9 && W >= 2.0;
    const vx0 = -W / 2 + 0.12, vx1 = xs - 0.12;
    const vw = clamp(vx1 - vx0 - 0.1, 0.6, 1.5), xv = (vx0 + vx1) / 2;
    const zt = -L / 2 + clamp(L * 0.38, 0.75, 1.3);
    const ba = 0.375, bb = 0.85, bx = W / 2 - 0.08 - ba, bz = (zf + 0.08 + L / 2 - 0.08) / 2;
    const fx0 = -W / 2 + 0.66, fx1 = bath ? bx - ba - 0.3 : W / 2 - 0.12;
    const fz0 = zf + 0.12, fz1 = L / 2 - 0.12;
    return { W, L, sw, sd, xs, zf, bath, vw, xv, zt, ba, bb, bx, bz, fx0, fx1, fz0, fz1,
      lit: s.lights || {}, ex: s.extras || {} };
  }

  function wallsDef(W, L) {
    return {
      back:  { o: V(-W / 2, 0, -L / 2), u: V(1, 0, 0),  n: V(0, 0, 1),  len: W },
      right: { o: V(W / 2, 0, -L / 2),  u: V(0, 0, 1),  n: V(-1, 0, 0), len: L },
      front: { o: V(W / 2, 0, L / 2),   u: V(-1, 0, 0), n: V(0, 0, -1), len: W },
      left:  { o: V(-W / 2, 0, L / 2),  u: V(0, 0, -1), n: V(1, 0, 0),  len: L }
    };
  }
  const at = (wd, s, y, off) => wd.o.clone().addScaledVector(wd.u, s).add(V(0, y, 0)).addScaledVector(wd.n, off || 0);
  // a group placed on a wall: local x runs along the wall, local z points into the room
  function onWall(wd, s, y, off) {
    const g = new THREE.Group();
    g.position.copy(at(wd, s, y, off));
    g.rotation.y = Math.atan2(wd.n.x, wd.n.z);
    return g;
  }

  function mesh(geo, mat, parent, x, y, z, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    if (parent) parent.add(m);
    return m;
  }
  const box = (w, h, d, mat, parent, x, y, z, shadow) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, shadow);
  const sbox = (w, h, d, mat, parent, x, y, z, ox, oy) => mesh(stoneUV(new THREE.BoxGeometry(w, h, d), ox, oy), mat, parent, x, y, z);
  function cyl(r, len, mat, parent, axis, x, y, z, seg) {
    const g = new THREE.CylinderGeometry(r, r, len, seg || 24);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    return mesh(g, mat, parent, x, y, z);
  }
  function plane(w, h, mat, parent, x, y, z, rx, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    m.renderOrder = 2;
    parent.add(m);
    return m;
  }

  /* ---------- walls ---------- */
  function buildWall(key, wd, holes, seed, extra) {
    const full = new THREE.Group(), stub = new THREE.Group();
    const r = rng(seed);
    const n = Math.max(1, Math.round(wd.len / 1.2)), sw = wd.len / n, f = sw / TEX;
    const q = new Quads();
    for (let i = 0; i < n; i++) {
      const flip = i % 2 === 1;                       // neighbouring slabs are mirrored, like book-matched marble
      const a = fract(seed * 0.137 + (i >> 1) * 0.381 + r() * 0.05) * (1 - f);
      const uvAt = (s, y) => { let t = (s - i * sw) / sw; if (flip) t = 1 - t; return [a + t * f, y / TEX]; };
      cut({ s0: i * sw + (i ? GAP / 2 : 0), s1: (i + 1) * sw - (i < n - 1 ? GAP / 2 : 0), y0: 0, y1: H }, holes).forEach((c) => {
        const p0 = uvAt(c.s0, c.y0), p1 = uvAt(c.s1, c.y1);
        q.add(at(wd, c.s0, c.y0, 0.001), wd.u, UP, wd.n, c.s1 - c.s0, c.y1 - c.y0, [p0[0], p0[1], p1[0], p1[1]]);
      });
    }
    const slabs = new THREE.Mesh(q.geometry(), M.wall);
    slabs.receiveShadow = true;
    full.add(slabs);

    // the wall itself, dark, visible where the model is cut
    const ry = Math.atan2(wd.n.x, wd.n.z);
    cut({ s0: -T, s1: wd.len + T, y0: 0, y1: H }, holes).forEach((c) => {
      const m = box(c.s1 - c.s0, c.y1 - c.y0, T, M.shell, full, 0, 0, 0);
      m.position.copy(at(wd, (c.s0 + c.s1) / 2, (c.y0 + c.y1) / 2, -T / 2 - 0.0005));
      m.rotation.y = ry; m.castShadow = false;
    });
    // grout line behind the slab joints (cut around niches and the door like the slabs)
    const gq = new Quads();
    cut({ s0: 0, s1: wd.len, y0: 0, y1: H }, holes).forEach((c) => gq.add(at(wd, c.s0, c.y0, 0.0002), wd.u, UP, wd.n, c.s1 - c.s0, c.y1 - c.y0, [0, 0, 1, 1]));
    full.add(new THREE.Mesh(gq.geometry(), M.groutDark));
    // a fine gold line on top of the cut wall, like a lit edge
    const line = box(wd.len + 2 * T, 0.006, 0.006, M.hair, full, 0, 0, 0, false);
    line.position.copy(at(wd, wd.len / 2, H + 0.003, -0.004)); line.rotation.y = ry;

    // recessed niches
    holes.filter((h) => h.depth).forEach((h) => {
      const d = h.depth, w = h.s1 - h.s0, hh = h.y1 - h.y0, nq = new Quads(), m = wd.n.clone().negate();
      nq.add(at(wd, h.s0, h.y0, -d), wd.u, UP, wd.n, w, hh, [0, 0, w / TEX, hh / TEX]);
      nq.add(at(wd, h.s0, h.y0, 0.001), wd.u, m, UP, w, d, [0, 0, w / TEX, d / TEX]);
      nq.add(at(wd, h.s0, h.y1, -d), wd.u, wd.n, UP.clone().negate(), w, d, [0, 0, w / TEX, d / TEX]);
      nq.add(at(wd, h.s0, h.y0, 0.001), m, UP, wd.u, d, hh, [0, 0, d / TEX, hh / TEX]);
      nq.add(at(wd, h.s1, h.y0, -d), wd.n, UP, wd.u.clone().negate(), d, hh, [0, 0, d / TEX, hh / TEX]);
      const nm = new THREE.Mesh(nq.geometry(), M.wall); nm.receiveShadow = true; full.add(nm);
      const plug = box(w, hh, T - d, M.shell, full, 0, 0, 0, false);
      plug.position.copy(at(wd, (h.s0 + h.s1) / 2, (h.y0 + h.y1) / 2, -d - (T - d) / 2)); plug.rotation.y = ry;
    });

    // low stub shown when the wall is cut away
    const sb = box(wd.len + 2 * T, 0.07, T, M.shell, stub, 0, 0, 0, false);
    sb.position.copy(at(wd, wd.len / 2, 0.035, -T / 2)); sb.rotation.y = ry;
    const sl = box(wd.len + 2 * T, 0.004, 0.004, M.hair, stub, 0, 0, 0, false);
    sl.position.copy(at(wd, wd.len / 2, 0.072, -0.003)); sl.rotation.y = ry;
    stub.visible = false;

    if (extra) extra(full);
    room.add(full, stub);
    walls[key] = { full, stub, wd };
  }

  /* ---------- floor ---------- */
  function buildFloor() {
    const { W, L } = P, g = new THREE.Group(), r = rng(7 + Math.round(W * 10) * 31 + Math.round(L * 10));
    const tw = 1.2, td = 0.6, fu = tw / TEX, fv = td / TEX;
    const nx = Math.ceil(W / tw), nz = Math.ceil(L / td);
    const x0 = -nx * tw / 2, z0 = -nz * td / 2;
    const q = new Quads();
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const ax = x0 + ix * tw, az = z0 + iz * td;
      const cx0 = Math.max(ax, -W / 2) + (ax > -W / 2 ? GAP / 2 : 0), cx1 = Math.min(ax + tw, W / 2) - (ax + tw < W / 2 ? GAP / 2 : 0);
      const cz0 = Math.max(az, -L / 2) + (az > -L / 2 ? GAP / 2 : 0), cz1 = Math.min(az + td, L / 2) - (az + td < L / 2 ? GAP / 2 : 0);
      if (cx1 <= cx0 || cz1 <= cz0) continue;
      const ou = r() * (1 - fu), ov = r() * (1 - fv), rot = r() < 0.5;
      const U = (x) => ou + ((x - ax) / tw) * fu, Vv = (z) => ov + ((z - az) / td) * fv;
      let uv = [U(cx0), Vv(cz1), U(cx1), Vv(cz0)];
      if (rot) uv = [uv[2], uv[3], uv[0], uv[1]];
      q.add(V(cx0, 0, cz1), V(1, 0, 0), V(0, 0, -1), UP, cx1 - cx0, cz1 - cz0, uv);
    }
    const tiles = new THREE.Mesh(q.geometry(), M.floor);
    tiles.receiveShadow = true;
    g.add(tiles);
    plane(W, L, M.groutDark, g, 0, -0.0005, 0, -Math.PI / 2).renderOrder = 0;
    box(W + 2 * T, 0.12, L + 2 * T, M.shell, g, 0, -0.0605, 0, false).receiveShadow = true;

    // soft shadow where floor meets wall
    const aoF = (w, x, z, ry) => { const m = plane(w, 0.32, AO.down, g, x, 0.0008, z, -Math.PI / 2); m.rotation.order = 'YXZ'; m.rotation.y = ry; };
    aoF(W, 0, -L / 2 + 0.16, 0); aoF(W, 0, L / 2 - 0.16, Math.PI); aoF(L, -W / 2 + 0.16, 0, Math.PI / 2); aoF(L, W / 2 - 0.16, 0, -Math.PI / 2);

    // compass star and border, set into the floor
    const fw = P.fx1 - P.fx0, fd = P.fz1 - P.fz0, cx = (P.fx0 + P.fx1) / 2, cz = (P.fz0 + P.fz1) / 2;
    if (P.ex.star && fw > 0.5 && fd > 0.5) {
      const R = Math.min(0.55, 0.42 * Math.min(fw, fd)), a = [], b = [];
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4, rr = k % 2 ? R * 0.58 : R, rb = R * 0.2;
        const tip = [Math.cos(ang) * rr, Math.sin(ang) * rr];
        const s1 = [Math.cos(ang - Math.PI / 8) * rb, Math.sin(ang - Math.PI / 8) * rb];
        const s2 = [Math.cos(ang + Math.PI / 8) * rb, Math.sin(ang + Math.PI / 8) * rb];
        a.push(0, 0, s1[0], s1[1], tip[0], tip[1]);
        b.push(0, 0, tip[0], tip[1], s2[0], s2[1]);
      }
      const tri = (arr, mat) => {
        const pos = [];
        for (let i = 0; i < arr.length; i += 2) pos.push(arr[i], 0, -arr[i + 1]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        const uv = []; for (let i = 0; i < arr.length; i += 2) uv.push(arr[i] / TEX + 0.3, arr[i + 1] / TEX + 0.3);
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const m = new THREE.Mesh(geo, mat); m.position.set(cx, 0.0012, cz); m.receiveShadow = true; g.add(m);
      };
      tri(a, M.inlayMetal); tri(b, M.inlay);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R * 0.675, 96), M.inlayMetal);
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.0013, cz); g.add(ring);
    }
    if (P.ex.border && fw > 0.4 && fd > 0.4) {
      const bw = 0.03, y = 0.0011, m = M.inlay;
      [[cx, P.fz0, fw, bw], [cx, P.fz1, fw, bw]].forEach((s) => { const p = plane(s[2], s[3], m, g, s[0], y, s[1], -Math.PI / 2); p.renderOrder = 1; });
      [[P.fx0, cz, bw, fd], [P.fx1, cz, bw, fd]].forEach((s) => { const p = plane(s[2], s[3], m, g, s[0], y, s[1], -Math.PI / 2); p.renderOrder = 1; });
    }
    room.add(g);
  }

  /* ---------- fittings ---------- */
  function buildVanity(back) {
    const { L, vw, xv, lit } = P, g = new THREE.Group(), z0 = -L / 2;
    const cabMat = st.vanity === 'stone' ? M.wall : M.wood;
    const cab = mesh(new RoundedBoxGeometry(vw, 0.4, 0.46, 3, 0.012), cabMat, g, xv, 0.58, z0 + 0.235);
    if (st.vanity === 'stone') stoneUV(cab.geometry, 0.2, 0.1);
    box(vw - 0.04, 0.007, 0.004, M.groove, g, xv, 0.58, z0 + 0.466, false);
    // stone trough top with a carved basin
    const th = 0.14, y = 0.78 + th / 2, bw = clamp(vw * 0.62, 0.45, 0.95), side = (vw - bw) / 2;
    sbox(vw, th, 0.12, M.wall, g, xv, y, z0 + 0.06, 0.1, 0.2);
    sbox(vw, th, 0.07, M.wall, g, xv, y, z0 + 0.465, 0.1, 0.2);
    sbox(side, th, 0.31, M.wall, g, xv - bw / 2 - side / 2, y, z0 + 0.275, 0.1, 0.2);
    sbox(side, th, 0.31, M.wall, g, xv + bw / 2 + side / 2, y, z0 + 0.275, 0.1, 0.2);
    sbox(bw, 0.03, 0.31, M.wall, g, xv, 0.795, z0 + 0.275, 0.1, 0.2);
    cyl(0.022, 0.004, M.metal, g, 'y', xv, 0.812, z0 + 0.29);
    // wall-mounted tap and two controls
    cyl(0.03, 0.012, M.metal, g, 'z', xv, 1.05, z0 + 0.006);
    cyl(0.012, 0.19, M.metal, g, 'z', xv, 1.05, z0 + 0.095);
    cyl(0.014, 0.02, M.metal, g, 'z', xv, 1.05, z0 + 0.19);
    [-1, 1].forEach((sgn) => {
      cyl(0.028, 0.01, M.metal, g, 'z', xv + sgn * 0.13, 1.05, z0 + 0.005);
      cyl(0.02, 0.045, M.metal, g, 'z', xv + sgn * 0.13, 1.05, z0 + 0.03);
    });
    // a few things on the counter
    const tx = xv - bw / 2 - side / 2;
    if (side > 0.12) {
      cyl(0.03, 0.17, M.bottleA, g, 'y', tx - 0.02, 0.92 + 0.085, z0 + 0.22, 20);
      cyl(0.008, 0.03, M.metal, g, 'y', tx - 0.02, 0.92 + 0.185, z0 + 0.22, 12);
      cyl(0.035, 0.12, M.bottleC, g, 'y', tx + 0.06, 0.92 + 0.06, z0 + 0.16, 20);
    }

    // mirror (a real reflection) and its lighting
    // wall lights sit either side of the mirror but never past the left wall or the shower glass
    const sOff = Math.min(clamp(vw - 0.36, 0.45, 1.1) / 2 + 0.17, P.xs - 0.15 - xv, xv + P.W / 2 - 0.1);
    const mw = lit.sconce ? Math.min(clamp(vw - 0.36, 0.45, 1.1), 2 * (sOff - 0.1)) : clamp(vw * 0.82, 0.45, 1.1), mh = 0.82, my = 1.56;
    const res = Math.round(1024 * Q.mirror);
    mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: res, textureHeight: Math.round(res * mh / mw), color: new THREE.Color().setRGB(0.47, 0.47, 0.47, THREE.LinearSRGBColorSpace) });
    mirror.position.set(xv, my, z0 + 0.026);
    g.add(mirror);
    box(mw - 0.02, mh - 0.02, 0.02, M.mirrorEdge, g, xv, my, z0 + 0.014, false);
    if (lit.mirror) plane(mw + 0.42, mh + 0.42, glowMat(S.halo, 1.1), g, xv, my, z0 + 0.003);
    if (lit.sconce) {
      [-1, 1].forEach((sgn) => {
        const sx = xv + sgn * sOff;
        box(0.06, 0.3, 0.012, M.metal, g, sx, my + 0.02, z0 + 0.006);
        mesh(new RoundedBoxGeometry(0.1, 0.3, 0.07, 2, 0.01), M.sconce, g, sx, my + 0.02, z0 + 0.047);
        plane(0.5, 0.95, glowMat(S.round, 0.42), g, sx, my + 0.02, z0 + 0.003);
      });
    }
    if (lit.plinth) {
      box(vw - 0.03, 0.006, 0.006, M.strip, g, xv, 0.374, z0 + 0.43, false);
      plane(vw + 0.5, 0.9, glowMat(S.down, 0.8), g, xv, 0.0016, z0 + 0.46, -Math.PI / 2);
      plane(vw + 0.1, 0.38, glowMat(S.down, 0.7), g, xv, 0.19, z0 + 0.0025);
    } else {
      plane(vw + 0.1, 0.6, AO.round, g, xv, 0.0014, z0 + 0.25, -Math.PI / 2);
    }
    room.add(g);
  }

  function buildShower() {
    const { W, L, sw, sd, xs, zf, lit, ex } = P, g = new THREE.Group(), z0 = -L / 2, cx = W / 2 - sw / 2;
    // fixed glass panel with a slim metal frame
    const gl = sd - 0.02;
    box(0.008, 2.0, gl, M.glass, g, xs, 1.0, z0 + gl / 2, false).renderOrder = 3;
    box(0.022, 0.022, gl, M.metal, g, xs, 2.0, z0 + gl / 2);
    box(0.022, 2.0, 0.022, M.metal, g, xs, 1.0, z0 + gl);
    box(0.022, 2.0, 0.022, M.metal, g, xs, 1.0, z0 + 0.011);
    box(0.022, 0.012, gl, M.metal, g, xs, 0.006, z0 + gl / 2);
    // linear drain at the front of the shower
    box(sw - 0.24, 0.004, 0.05, M.metal, g, cx + 0.02, 0.002, zf - 0.09, false);
    // bench along the back wall
    if (ex.bench) {
      const bl = sw - 0.04, bxc = xs + 0.02 + bl / 2;
      sbox(bl, 0.05, 0.42, M.wall, g, bxc, 0.445, z0 + 0.21, 0.3, 0.1);
      sbox(bl, 0.42, 0.36, M.wall, g, bxc, 0.21, z0 + 0.18, 0.3, 0.1);
      if (lit.plinth) {
        box(bl - 0.02, 0.006, 0.006, M.strip, g, bxc, 0.414, z0 + 0.4, false);
        plane(bl, 0.66, glowMat(S.down, 0.75), g, bxc, 0.0016, z0 + 0.36 + 0.33, -Math.PI / 2);
        plane(bl, 0.4, glowMat(S.down, 0.7), g, bxc, 0.2, z0 + 0.3605);
      }
    }
    // overhead rain shower on an arm from the back wall
    if (ex.rain) {
      cyl(0.03, 0.012, M.metal, g, 'z', cx, 2.16, z0 + 0.006);
      cyl(0.011, 0.36, M.metal, g, 'z', cx, 2.16, z0 + 0.18);
      cyl(0.16, 0.012, M.metal, g, 'y', cx, 2.14, z0 + 0.38, 48);
    }
    room.add(g);
    // shower controls and hand shower on the side wall
    const r = walls.right;
    const c = onWall(r.wd, sd * 0.42, 1.12, 0);
    cyl(0.075, 0.01, M.metal, c, 'z', 0, 0, 0.005, 40);
    cyl(0.026, 0.05, M.metal, c, 'z', 0, 0, 0.03);
    cyl(0.018, 0.04, M.metal, c, 'z', 0, -0.13, 0.02);
    const rail = onWall(r.wd, sd * 0.78, 0, 0);
    cyl(0.01, 0.85, M.metal, rail, 'y', 0, 1.45, 0.04);
    cyl(0.012, 0.04, M.metal, rail, 'z', 0, 1.04, 0.02); cyl(0.012, 0.04, M.metal, rail, 'z', 0, 1.86, 0.02);
    const hs = cyl(0.02, 0.22, M.metal, rail, 'y', 0, 1.62, 0.07); hs.rotation.x = 0.25;
    const hose = new THREE.CatmullRomCurve3([V(0, 1.52, 0.07), V(-0.02, 1.05, 0.12), V(-(sd * 0.36) * 0.6, 0.86, 0.08), V(-(sd * 0.36), 0.99, 0.02)]);
    mesh(new THREE.TubeGeometry(hose, 40, 0.007, 8), M.metal, rail);
    r.full.add(c, rail);
  }

  function buildNiches() {
    const { W, sw, lit } = P;
    if (!lit.niche) return;
    // shower niche on the back wall
    const b = walls.back, h = b.niche, cx = (h.s0 + h.s1) / 2, w = h.s1 - h.s0;
    const g = onWall(b.wd, cx, 0, 0);
    box(w - 0.02, 0.006, 0.006, M.strip, g, 0, h.y1 - 0.012, -0.012, false);
    plane(w, h.y1 - h.y0, glowMat(S.down, 1.3), g, 0, (h.y0 + h.y1) / 2, -h.depth + 0.002);
    plane(w, h.depth, glowMat(S.down, 0.9), g, 0, h.y0 + 0.002, -h.depth / 2, -Math.PI / 2);
    cyl(0.028, 0.19, M.bottleB, g, 'y', -w * 0.25, h.y0 + 0.095, -0.05, 20);
    cyl(0.03, 0.15, M.bottleC, g, 'y', -w * 0.25 + 0.075, h.y0 + 0.075, -0.05, 20);
    cyl(0.024, 0.12, M.bottleA, g, 'y', w * 0.22, h.y0 + 0.06, -0.05, 20);
    b.full.add(g);
    // tall niche above the toilet
    const l = walls.left, t = l.niche, tw = t.s1 - t.s0;
    const g2 = onWall(l.wd, (t.s0 + t.s1) / 2, 0, 0);
    [-1, 1].forEach((sgn) => box(0.006, t.y1 - t.y0 - 0.02, 0.006, M.strip, g2, sgn * (tw / 2 - 0.012), (t.y0 + t.y1) / 2, -0.012, false));
    plane(tw, t.y1 - t.y0, glowMat(S.sides, 0.9), g2, 0, (t.y0 + t.y1) / 2, -t.depth + 0.002);
    [0.33, 0.66].forEach((k) => box(tw - 0.004, 0.012, t.depth - 0.005, M.glass, g2, 0, t.y0 + (t.y1 - t.y0) * k, -t.depth / 2, false));
    const vase = new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.05, 0.05], [0.045, 0.12], [0.022, 0.19], [0.026, 0.21], [0, 0.21]].map((q) => new THREE.Vector2(q[0], q[1])), 32);
    mesh(vase, M.bottleC, g2, 0, t.y0 + 0.006, -0.05);
    [[-0.012, 0.24, -0.2], [0.01, 0.28, 0.15], [0.0, 0.22, 0.02]].forEach((q) => { const st = cyl(0.002, q[1], M.bottleB, g2, 'y', q[0], t.y0 + 0.16 + q[1] / 2, -0.05, 6); st.rotation.z = q[2]; });
    cyl(0.03, 0.11, M.bottleB, g2, 'y', -0.04, t.y0 + (t.y1 - t.y0) * 0.33 + 0.06, -0.05, 20);
    cyl(0.025, 0.14, M.bottleA, g2, 'y', 0.05, t.y0 + (t.y1 - t.y0) * 0.66 + 0.075, -0.05, 20);
    l.full.add(g2);
  }

  function buildToilet() {
    const { L, zt } = P, l = walls.left, s = L / 2 - zt;
    const g = onWall(l.wd, s, 0, 0);
    // wall-hung pan: a side profile, extruded and softened at the edges
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.4); sh.lineTo(0.46, 0.4);
    sh.quadraticCurveTo(0.53, 0.4, 0.53, 0.33);
    sh.quadraticCurveTo(0.52, 0.19, 0.34, 0.165);
    sh.lineTo(0, 0.2); sh.lineTo(0, 0.4);
    const pan = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.028, bevelSegments: 6, curveSegments: 24 });
    pan.rotateY(-Math.PI / 2); pan.translate(0.14, 0, 0);
    mesh(pan, M.ceramic, g);
    mesh(new RoundedBoxGeometry(0.355, 0.028, 0.5, 3, 0.012), M.ceramic, g, 0, 0.443, 0.27);
    box(0.24, 0.155, 0.008, M.metal, g, 0, 1.0, 0.004);
    box(0.002, 0.13, 0.004, M.groove, g, 0, 1.0, 0.009, false);
    plane(0.5, 0.75, AO.round, g, 0, 0.0014, 0.3, -Math.PI / 2);
    l.full.add(g);
  }

  function buildRail() {
    if (!P.ex.rail) return;
    const l = walls.left, g = onWall(l.wd, 0.62, 0, 0);
    const y0 = 0.7, y1 = 1.7, hw = 0.25;
    [-1, 1].forEach((sgn) => {
      cyl(0.013, y1 - y0, M.metal, g, 'y', sgn * hw, (y0 + y1) / 2, 0.065);
      [y0 + 0.08, y1 - 0.08].forEach((yy) => cyl(0.009, 0.06, M.metal, g, 'z', sgn * hw, yy, 0.03));
    });
    for (let i = 0; i < 9; i++) cyl(0.009, hw * 2, M.metal, g, 'x', 0, y0 + 0.05 + i * ((y1 - y0 - 0.1) / 8), 0.065);
    const towel = mesh(new RoundedBoxGeometry(hw * 1.7, 0.42, 0.03, 2, 0.012), M.towel, g, 0, y1 - 0.32, 0.09);
    towel.rotation.x = -0.05;
    l.full.add(g);
  }

  function buildBath() {
    if (!P.bath) return;
    const { ba, bb, bx, bz } = P, g = new THREE.Group();
    const pts = [[0, 0.07], [0.74, 0.08], [0.86, 0.2], [0.92, 0.5], [0.94, 0.6], [1.0, 0.6], [0.99, 0.42], [0.95, 0.16], [0.88, 0.02], [0.8, 0]]
      .map((p) => new THREE.Vector2(p[0], p[1]));
    const geo = new THREE.LatheGeometry(pts, 72);
    geo.scale(ba, 1, bb);
    mesh(geo, M.bath, g, bx, 0, bz);
    plane(ba * 2.6, bb * 2.4, AO.round, g, bx, 0.0014, bz, -Math.PI / 2);
    // floor-standing filler on the open side
    const fx = bx - ba - 0.14, fz = bz + bb * 0.35;
    cyl(0.05, 0.012, M.metal, g, 'y', fx, 0.006, fz, 32);
    cyl(0.017, 0.92, M.metal, g, 'y', fx, 0.46, fz);
    const spout = new THREE.QuadraticBezierCurve3(V(fx, 0.92, fz), V(fx, 1.08, fz), V(fx + 0.17, 1.0, fz));
    mesh(new THREE.TubeGeometry(spout, 24, 0.017, 12), M.metal, g);
    cyl(0.02, 0.06, M.metal, g, 'y', fx - 0.03, 0.74, fz, 20).rotation.z = 0.0;
    room.add(g);
  }

  function buildDoor(front) {
    const { W } = P, h = walls.front.door, wd = walls.front.wd;
    const g = onWall(wd, (h.s0 + h.s1) / 2, 0, 0);
    box(h.s1 - h.s0 - 0.01, h.y1 - 0.005, 0.04, M.door, g, 0, (h.y1 - 0.005) / 2, -0.07);
    box(0.13, 0.016, 0.016, M.metal, g, (h.s1 - h.s0) / 2 - 0.12, 1.02, -0.035);
    cyl(0.025, 0.02, M.metal, g, 'z', (h.s1 - h.s0) / 2 - 0.06, 1.02, -0.045);
    walls.front.full.add(g);
  }

  function buildCeiling() {
    const { W, L, lit } = P, g = new THREE.Group();
    const c = plane(W, L, M.plaster, g, 0, H, 0, Math.PI / 2);
    c.renderOrder = 0; c.receiveShadow = false;
    spots.forEach((s) => {
      const d = mesh(new THREE.CircleGeometry(0.035, 24), M.downlight, g, s.position.x, H - 0.002, s.position.z, false);
      d.rotation.x = Math.PI / 2;
    });
    if (lit.cove) {
      const inset = 0.04;
      box(W - 2 * inset, 0.006, 0.006, M.strip, g, 0, H - 0.03, -L / 2 + inset, false);
      box(W - 2 * inset, 0.006, 0.006, M.strip, g, 0, H - 0.03, L / 2 - inset, false);
      box(0.006, 0.006, L - 2 * inset, M.strip, g, -W / 2 + inset, H - 0.03, 0, false);
      box(0.006, 0.006, L - 2 * inset, M.strip, g, W / 2 - inset, H - 0.03, 0, false);
    }
    ceiling = g;
    room.add(g);
  }

  function coveWash() {
    if (!P.lit.cove) return;
    Object.keys(walls).forEach((k) => {
      const w = walls[k], g = onWall(w.wd, w.wd.len / 2, 0, 0);
      plane(w.wd.len, 0.62, glowMat(S.down, 0.5), g, 0, H - 0.31, 0.0025);
      w.full.add(g);
    });
  }

  function cornerShade() {
    Object.keys(walls).forEach((k) => {
      const w = walls[k];
      [0, w.wd.len].forEach((s, i) => {
        const g = onWall(w.wd, s, 0, 0), p = plane(H, 0.22, AO.down, g, (i ? -1 : 1) * 0.11, H / 2, 0.0022);
        p.rotation.z = (i ? -1 : 1) * Math.PI / 2;
        p.material = AO.down; w.full.add(g);
      });
      const g = onWall(w.wd, w.wd.len / 2, 0, 0);
      const p = plane(w.wd.len, 0.25, AO.down, g, 0, 0.125, 0.0021); p.rotation.z = Math.PI;
      w.full.add(g);
    });
  }

  function buildLights() {
    spots.forEach((s) => { scene.remove(s, s.target); s.dispose && s.dispose(); });
    spots = [];
    const { W, L, xv, sw, sd, bath, bx, bz, fx0, fx1, fz0, fz1 } = P;
    const at2 = [[xv, -L / 2 + 0.55, true], [W / 2 - sw / 2, -L / 2 + sd / 2, false], [(fx0 + fx1) / 2, (fz0 + fz1) / 2, true]];
    if (bath) at2.push([bx, bz, false]);
    else if (L > 3.2) at2.push([(fx0 + fx1) / 2, L / 2 - 0.6, false]);
    at2.forEach((p) => {
      const s = new THREE.SpotLight(0xffd7a8, 1, 0, 0.9, 0.85, 2);
      s.position.set(p[0], H - 0.02, p[1]);
      s.target.position.set(p[0], 0, p[1]);
      if (p[2]) {
        s.castShadow = true;
        s.shadow.mapSize.set(Q.shadow, Q.shadow);
        s.shadow.bias = -0.0003; s.shadow.normalBias = 0.02;
        s.shadow.camera.near = 0.05; s.shadow.camera.far = 6;
      }
      scene.add(s, s.target);
      spots.push(s);
    });
    applyMood();
  }

  function buildDims() {
    const { W, L } = P, y = -0.118, off = T + 0.32, tick = 0.08, pts = [];
    const seg = (a, b) => pts.push(a, b);
    seg(V(-W / 2, y, L / 2 + off), V(W / 2, y, L / 2 + off));
    seg(V(-W / 2, y, L / 2 + off - tick), V(-W / 2, y, L / 2 + off + tick));
    seg(V(W / 2, y, L / 2 + off - tick), V(W / 2, y, L / 2 + off + tick));
    seg(V(W / 2 + off, y, -L / 2), V(W / 2 + off, y, L / 2));
    seg(V(W / 2 + off - tick, y, -L / 2), V(W / 2 + off + tick, y, -L / 2));
    seg(V(W / 2 + off - tick, y, L / 2), V(W / 2 + off + tick, y, L / 2));
    dims = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.dim);
    dims.userData.w = V(0, y, L / 2 + off + 0.22);
    dims.userData.l = V(W / 2 + off + 0.22, y, 0);
    room.add(dims);
  }

  /* ---------- build or rebuild the room ---------- */
  function disposeRoom() {
    if (!room) return;
    room.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isReflector) { o.getRenderTarget().dispose(); o.material.dispose(); }
    });
    glows.splice(0).forEach((m) => m.dispose());
    scene.remove(room);
    room = null; walls = {}; mirror = null;
  }

  function build() {
    disposeRoom();
    P = layout(st);
    room = new THREE.Group();
    scene.add(room);
    const { W, L, sw, xs, zt, lit } = P, wds = wallsDef(W, L);

    const backHoles = [], leftHoles = [], frontHoles = [];
    let backNiche = null, leftNiche = null;
    if (lit.niche) {
      const nw = Math.min(sw - 0.3, 0.72), cx = W / 2 - sw / 2 + W / 2;
      backNiche = { s0: cx - nw / 2, s1: cx + nw / 2, y0: 1.08, y1: 1.42, depth: 0.1 };
      backHoles.push(backNiche);
      const s = L / 2 - zt;
      leftNiche = { s0: s - 0.15, s1: s + 0.15, y0: 1.22, y1: 2.04, depth: 0.1 };
      leftHoles.push(leftNiche);
    }
    const door = { s0: W - 0.95, s1: W - 0.15, y0: 0, y1: 2.05, through: true };
    frontHoles.push(door);

    buildWall('back', wds.back, backHoles, 11);
    buildWall('right', wds.right, [], 23);
    buildWall('front', wds.front, frontHoles, 37);
    buildWall('left', wds.left, leftHoles, 53);
    walls.back.niche = backNiche; walls.left.niche = leftNiche; walls.front.door = door;

    buildFloor();
    buildLights();
    buildVanity();
    buildShower();
    buildNiches();
    buildToilet();
    buildRail();
    buildBath();
    buildDoor();
    buildCeiling();
    coveWash();
    cornerShade();
    buildDims();
    applyMood();
    built = true;
    dirty = true;
    queueEnv();
  }

  /* ---------- finishes, without rebuilding ---------- */
  function finishes() {
    const m = METALS[st.metal] || METALS.brass;
    [M.metal, M.inlayMetal].forEach((mat) => { mat.color.set(m.color); mat.metalness = m.metalness; mat.roughness = m.roughness; });
    const dark = st.floor === 'black' || st.floor === 'brown';
    M.inlay.color.set(dark ? 0xd9ccb4 : 0x1d1b19);
    M.inlay.roughness = 0.16;
    return Promise.all([
      setMap(M.wall, st.wall, STONE_TINT[st.wall] || 0x777777),
      setMap(M.floor, st.floor, STONE_TINT[st.floor] || 0x777777),
      setMap(M.wood, st.vanity === 'oak' ? 'oak' : 'walnut', st.vanity === 'oak' ? 0x3a2c22 : 0x5a3a22)
    ]).then(() => { dirty = true; queueEnv(); });
  }

  /* ---------- day and evening light ---------- */
  function applyMood() {
    const day = !mood;
    hemi.intensity = day ? 0.55 : 0.06;
    spots.forEach((s) => { s.intensity = day ? 9 : 1.6; });
    const g = day ? 1 : 1.25;
    glows.forEach((m) => m.color.copy(LED).multiplyScalar(m.userData.k * g));
    M.strip.color.copy(LED).multiplyScalar(day ? 6 : 8);
    M.sconce.emissiveIntensity = day ? 2 : 3.4;
    M.downlight.color.setRGB(1, 0.86, 0.66).multiplyScalar(day ? 3 : 1.4);
    bloom.strength = day ? 0.4 : 0.55;
    renderer.toneMappingExposure = day ? 1 : 1.15;
    dirty = true;
  }

  /* ---------- reflections: photograph the room from its centre ---------- */
  let envTimer = 0;
  function queueEnv() { clearTimeout(envTimer); envTimer = setTimeout(captureEnv, 120); }
  function captureEnv() {
    if (!room) return;
    const vis = setInside(true);
    if (mirror) mirror.visible = false;
    if (dims) dims.visible = false;
    cubeCam.position.set(0, 1.35, P.L * 0.1);
    for (let i = 0; i < 2; i++) {
      cubeCam.update(renderer, scene);
      const env = pmrem.fromCubemap(cubeRT.texture);
      if (envRT) envRT.dispose();
      envRT = env;
      scene.environment = env.texture;
    }
    if (mirror) mirror.visible = true;
    vis();
    dirty = true;
  }

  // show the room whole (as from inside) and give back a function that restores the cut-away
  function setInside(all) {
    const keep = Object.keys(walls).map((k) => [walls[k].full.visible, walls[k].stub.visible]);
    const cv = ceiling ? ceiling.visible : false;
    Object.keys(walls).forEach((k) => { walls[k].full.visible = true; walls[k].stub.visible = false; });
    if (ceiling) ceiling.visible = true;
    return () => {
      Object.keys(walls).forEach((k, i) => { walls[k].full.visible = keep[i][0]; walls[k].stub.visible = keep[i][1]; });
      if (ceiling) ceiling.visible = cv;
    };
  }

  /* ---------- cut-away: hide whichever walls are between the camera and the room ---------- */
  const proj = new THREE.Vector3();
  function cutaway() {
    if (!P) return;
    const c = camera.position, { W, L } = P;
    const inside = c.x > -W / 2 + 0.02 && c.x < W / 2 - 0.02 && c.z > -L / 2 + 0.02 && c.z < L / 2 - 0.02 && c.y < H - 0.02;
    const hide = { back: c.z < -L / 2, front: c.z > L / 2, left: c.x < -W / 2, right: c.x > W / 2 };
    Object.keys(walls).forEach((k) => {
      const h = !inside && hide[k];
      walls[k].full.visible = !h; walls[k].stub.visible = h;
    });
    if (ceiling) ceiling.visible = inside;
    if (dims) dims.visible = !inside;
    const lab = opt.labels;
    camera.updateMatrixWorld();
    if (lab) {
      const show = !inside && dims;
      [['w', P.W], ['l', P.L]].forEach(([k, val]) => {
        const el = lab[k];
        if (!el) return;
        if (!show) { el.hidden = true; return; }
        proj.copy(dims.userData[k]).project(camera);
        const ok = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
        el.hidden = !ok;
        if (ok) {
          el.textContent = val.toFixed(1) + ' m';
          el.style.transform = 'translate(' + ((proj.x + 1) / 2 * host.clientWidth).toFixed(1) + 'px,' + ((1 - proj.y) / 2 * host.clientHeight).toFixed(1) + 'px) translate(-50%,-50%)';
        }
      });
    }
  }

  /* ---------- camera views ---------- */
  function views() {
    const { W, L, xv, sw, sd, bath, bx, bz } = P, a = camera.aspect;
    const rad = Math.sqrt(W * W + L * L + H * H) / 2;
    const vf = THREE.MathUtils.degToRad(34), hf = 2 * Math.atan(Math.tan(vf / 2) * a);
    const fit = rad / Math.sin(Math.min(vf, hf) / 2) * 1.0;
    const dir = V(0.58, 0.72, 1).normalize();
    const pf = THREE.MathUtils.degToRad(30), phf = 2 * Math.atan(Math.tan(pf / 2) * a);
    const planD = Math.max((W / 2 + 0.7) / Math.tan(phf / 2), (L / 2 + 0.7) / Math.tan(pf / 2)) + H;
    const inZ = (z) => Math.min(z, L / 2 - 0.12);
    const v = {
      overview: { p: dir.multiplyScalar(fit).add(V(0, 0.6, 0)), t: V(0, 0.75, 0), f: 34 },
      plan: { p: V(0, planD, 0.001), t: V(0, 0, 0), f: 30 },
      vanity: { p: V(xv + Math.min(0.25, W * 0.08), 1.52, inZ(-L / 2 + 2.1)), t: V(xv, 1.08, -L / 2), f: 52 },
      shower: { p: V(Math.max(-W / 2 + 0.3, W / 2 - sw / 2 - 0.8), 1.5, inZ(-L / 2 + sd + 1.5)), t: V(W / 2 - sw / 2 - 0.05, 1.05, -L / 2 + sd * 0.4), f: 52 }
    };
    if (bath) v.bath = { p: V(-W / 2 + 0.3, 1.55, inZ(bz + 1.0)), t: V(bx, 0.45, bz - 0.15), f: 52 };
    return v;
  }
  let viewName = 'overview';
  function flyTo(name, ms) {
    const v = views()[name] || views().overview;
    viewName = views()[name] ? name : 'overview';
    if (reduced || ms === 0) {
      camera.position.copy(v.p); controls.target.copy(v.t); camera.fov = v.f; camera.updateProjectionMatrix();
      tween = null; controls.update(); dirty = true; return;
    }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, v, s: performance.now(), ms: ms || 1100 };
  }
  function stepTween(now) {
    const k = Math.min(1, (now - tween.s) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.v.p, e);
    controls.target.lerpVectors(tween.t0, tween.v.t, e);
    camera.fov = tween.f0 + (tween.v.f - tween.f0) * e;
    camera.updateProjectionMatrix();
    if (k >= 1) tween = null;
  }
  controls.addEventListener('start', () => { tween = null; if (opt.onMove) opt.onMove(); });

  /* ---------- render loop: only draws when something changed ---------- */
  function render() { cutaway(); composer.render(); }
  let raf = 0, first = true, onFirst = opt.onFirstFrame;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!active || !built) return;
    if (tween) stepTween(now);
    const moved = controls.update();
    if (moved || tween || dirty) {
      dirty = false;
      render();
      if (first) { first = false; if (onFirst) onFirst(); }
    }
  }

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { active = es[0].isIntersecting && !document.hidden; }).observe(host);
  document.addEventListener('visibilitychange', () => { active = !document.hidden; dirty = true; });

  /* ---------- public api ---------- */
  let ready;
  const api = {
    set(s) {
      const prev = st;
      st = JSON.parse(JSON.stringify(s));
      const structural = !prev || ['w', 'l', 'layout'].some((k) => prev[k] !== st[k]) ||
        JSON.stringify(prev.lights) !== JSON.stringify(st.lights) || JSON.stringify(prev.extras) !== JSON.stringify(st.extras) ||
        prev.vanity !== st.vanity;
      const p = finishes();
      if (structural) build();
      else dirty = true;
      if (!ready) ready = p;
      return p;
    },
    view(name, ms) { flyTo(name, ms); },
    hasView(name) { return !!(P && views()[name]); },
    get viewName() { return viewName; },
    mood(on) { mood = !!on; applyMood(); queueEnv(); },
    intro() {
      const v = views().overview;
      if (reduced) { flyTo('overview', 0); return; }
      camera.position.copy(v.p.clone().applyAxisAngle(UP, -0.22).multiplyScalar(1.12)); controls.target.copy(v.t);
      camera.fov = v.f; camera.updateProjectionMatrix();
      flyTo('overview', 2400);
    },
    // draw a fresh frame and hand back the canvas, for saving a picture
    snapshot() { render(); return renderer.domElement; },
    ready() { return ready || Promise.resolve(); }
  };
  raf = requestAnimationFrame(loop);
  return api;
}
