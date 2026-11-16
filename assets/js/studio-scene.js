/* ==========================================================================
   UNICKS custom design studio: the 3D room
   --------------------------------------------------------------------------
   The room is built from code, part by part (walls, floor, vanity, mirror,
   shower screen...). Each part knows which choices it depends on, so when
   one choice changes only the parts it touches are rebuilt, instantly.
   Finishes cross-fade quickly; nothing else animates except the camera.

   Units are metres. x runs across the room (width W), z runs back to front
   (length L), y is up. The back wall sits at z = -L/2.
   Real fittings modelled in Blender can replace any part later: export a
   .glb and load it inside the matching build function.
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const H = 2.4;            // ceiling height
const T = 0.12;           // wall thickness, seen where the model is cut open
const GAP = 0.003;        // joint between stone slabs
const TEX = 2.4;          // one texture covers 2.4m of stone
// layers that sit on top of each other are kept millimetres apart (never on the same plane, and with no
// resolution-dependent depth bias), so nothing flickers or swaps order at any zoom or screen size
const SLAB = 0.002, DECAL = 0.006, INLAY = 0.003;
const UP = new THREE.Vector3(0, 1, 0);
const GOLD = new THREE.Color(0xc6a15b);
const LED_WARM = new THREE.Color(1, 0.7, 0.4), LED_COOL = new THREE.Color(1, 0.9, 0.8);
const SPOT_WARM = new THREE.Color(0xffd7a8), SPOT_COOL = new THREE.Color(0xfff1e2);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (v) => v - Math.floor(v);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

const STONE_TINT = { black: 0x2b2b2c, brown: 0x4b3d33, cream: 0xd8cbb4, travertine: 0x9c8f80 };
const METALS = {
  brass:  { color: 0xd2a865, metalness: 1, roughness: 0.32 },
  black:  { color: 0x1a1a1a, metalness: 0.55, roughness: 0.5 },
  gun:    { color: 0x74767a, metalness: 1, roughness: 0.3 },
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

// flat quads gathered into one geometry
class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  add(o, u, v, n, w, h, uv) {
    const k = this.p.length / 3;
    const a = o, b = o.clone().addScaledVector(u, w), c = b.clone().addScaledVector(v, h), d = o.clone().addScaledVector(v, h);
    const t = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    [a, b, c, d].forEach((p, j) => { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(t[j][0], t[j][1]); });
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
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

// texture coordinates from size, so stone veins and wood grain stay to scale
function planarUV(g, ox = 0, oy = 0, size = TEX) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let a, b;
    if (ay >= ax && ay >= az) { a = p.getX(i); b = p.getZ(i); }
    else if (ax >= az) { a = p.getZ(i); b = p.getY(i); }
    else { a = p.getX(i); b = p.getY(i); }
    uv.setXY(i, a / size + ox, b / size + oy);
  }
  uv.needsUpdate = true;
  return g;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pixels(w, h, fn) {
  return (x) => {
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = fn(i / (w - 1), j / (h - 1)), k = (j * w + i) * 4;
      img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = v[3];
    }
    x.putImageData(img, 0, 0);
  };
}

/* soft light and shadow shapes, drawn once */
const SHAPES = {};
function shapes() {
  if (SHAPES.down) return SHAPES;
  // bright along the top edge, fading down, soft at the sides
  SHAPES.down = canvasTex(64, 256, pixels(64, 256, (u, v) => {
    const side = Math.min(1, Math.min(u, 1 - u) / 0.18), s = side * side * (3 - 2 * side);
    return [255, 255, 255, Math.round(Math.pow(1 - v, 2.2) * s * 255)];
  }));
  // bright at both side edges (light from vertical strips)
  SHAPES.sides = canvasTex(256, 64, pixels(256, 64, (u, v) => {
    const e = Math.pow(1 - Math.min(u, 1 - u) * 2, 2.5), vert = Math.min(1, Math.min(v, 1 - v) / 0.12);
    return [255, 255, 255, Math.round((0.25 + 0.75 * e) * vert * 255)];
  }));
  SHAPES.round = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  SHAPES.pedestal = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#1f1a15'); g.addColorStop(0.55, '#120f0d'); g.addColorStop(1, '#0b0a09');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  // ribbed glass: a normal map of vertical reeds
  SHAPES.reeds = canvasTex(64, 4, pixels(64, 4, (u) => {
    const nx = Math.sin(u * Math.PI * 2) * 0.8, nz = Math.sqrt(1 - nx * nx);
    return [Math.round((nx * 0.5 + 0.5) * 255), 128, Math.round((nz * 0.5 + 0.5) * 255), 255];
  }), false);
  SHAPES.reeds.wrapS = SHAPES.reeds.wrapT = THREE.RepeatWrapping;
  return SHAPES;
}
// glow around a mirror of a given outline
const HALOS = {};
function haloTex(kind, aspect) {
  aspect = Math.round(aspect * 10) / 10;                 // a handful of shapes, shared
  const key = kind + aspect;
  if (HALOS[key]) return HALOS[key];
  const w = 256, h = Math.round(256 / aspect);
  HALOS[key] = canvasTex(w, h, (x) => {
    x.filter = 'blur(14px)'; x.fillStyle = '#fff';
    const ix = w * 0.2, iy = h * 0.2, iw = w * 0.6, ih = h * 0.6;
    x.beginPath();
    if (kind === 'round') x.ellipse(w / 2, h / 2, iw / 2, ih / 2, 0, 0, Math.PI * 2);
    else if (kind === 'arch') { x.moveTo(ix, iy + ih); x.lineTo(ix, iy + iw / 2); x.arc(w / 2, iy + iw / 2, iw / 2, Math.PI, 0); x.lineTo(ix + iw, iy + ih); x.closePath(); }
    else x.rect(ix, iy, iw, ih);
    x.fill();
  });
  return HALOS[key];
}
function mirrorShape(kind, w, h) {
  const s = new THREE.Shape();
  if (kind === 'round') { s.absarc(0, 0, w / 2, 0, Math.PI * 2, false); return s; }
  if (kind === 'arch') {
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2 - w / 2);
    s.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, -h / 2);
    return s;
  }
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  return s;
}

/* a quick cross-fade from one stone or wood to the next (a small addition to the standard material) */
function sweepable(mat) {
  const u = { uMapB: { value: null }, uT: { value: 0 }, uOn: { value: 0 } };
  mat.userData.sw = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = 'uniform sampler2D uMapB;\nuniform float uT, uOn;\n' + sh.fragmentShader.replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      '\tvec4 sampledDiffuseColor = texture2D( map, vMapUv );',
      '\tif ( uOn > 0.5 ) sampledDiffuseColor = mix( sampledDiffuseColor, texture2D( uMapB, vMapUv ), uT );',
      '\tdiffuseColor *= sampledDiffuseColor;',
      '#endif'
    ].join('\n'));
  };
  mat.customProgramCacheKey = () => 'xfade';
  return mat;
}

/* ==========================================================================
   createStudio(host, options) -> api
   ========================================================================== */
export function createStudio(host, opt) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const Q = { dpr: small ? 1.5 : 2, tex: small ? '1k' : '2k', shadow: small ? 1024 : 2048, mirror: small ? 0.45 : 0.7, ao: !small };
  const reduced = !!opt.reduced;

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a09);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.6, zoomSpeed: 0.8,
    minDistance: 0.4, maxDistance: 14, maxPolarAngle: Math.PI * 0.49, minAzimuthAngle: -Math.PI * 0.62, maxAzimuthAngle: Math.PI * 0.62 });

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (Q.ao) {
    // soft shadow in corners and under things; glass, mirrors and light shapes are left out of it
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 1.2, scale: 1, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.85;
    gtao.overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse((o) => {
        cache.set(o, o.visible);
        if (o.isPoints || o.isLine || o.isReflector || (o.material && o.material.transparent)) o.visible = false;
      });
    };
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.4, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 30, cubeRT);
  let envRT = null;

  /* ---------- materials ---------- */
  const S = shapes();
  const M = {
    wall: sweepable(new THREE.MeshStandardMaterial({ roughness: 0.2 })),
    feature: sweepable(new THREE.MeshStandardMaterial({ roughness: 0.2 })),
    floor: sweepable(new THREE.MeshStandardMaterial({ roughness: 0.26 })),
    wood: sweepable(new THREE.MeshStandardMaterial({ roughness: 0.55 })),
    metal: new THREE.MeshStandardMaterial(),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    ceramic2: new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x9cc9c6, roughness: 0.04, transparent: true, opacity: 0.45, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xeef4f2, roughness: 0.02, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }),
    reeded: new THREE.MeshPhysicalMaterial({ color: 0xf1f4f2, roughness: 0.2, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, normalMap: S.reeds, normalScale: new THREE.Vector2(1.4, 1.4) }),
    shelf: new THREE.MeshPhysicalMaterial({ color: 0xeef4f2, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    shell: new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.9 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xe4ded4, roughness: 0.95, emissive: 0x221d17 }),
    door: new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.55 }),
    groove: new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 1 }),
    mirrorBack: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.2, metalness: 0.4 }),
    inlay: new THREE.MeshStandardMaterial({ roughness: 0.16 }),
    inlayMetal: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
    hair: new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.15) }),
    strip: new THREE.MeshBasicMaterial({ color: LED_WARM.clone().multiplyScalar(6) }),
    sconce: new THREE.MeshStandardMaterial({ color: 0xf4e6cf, roughness: 0.6, emissive: LED_WARM.clone(), emissiveIntensity: 2 }),
    downlight: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66).multiplyScalar(3) }),
    bottleA: new THREE.MeshPhysicalMaterial({ color: 0x6b3a12, roughness: 0.1, clearcoat: 1 }),
    bottleB: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
    bottleC: new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.4 }),
    towel: new THREE.MeshStandardMaterial({ color: 0xe9e3d8, roughness: 1 }),
    pedestal: new THREE.MeshBasicMaterial({ map: S.pedestal }),
    dim: new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 })
  };
  const glows = new Set();   // additive light shapes, scaled together for day, evening and LED colour
  const glowMat = (shape, k) => {
    const m = new THREE.MeshBasicMaterial({ map: shape, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.k = k; m.userData.fade = 1; glows.add(m); paintGlow(m); return m;
  };
  const aoMat = (shape, o) => new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shape, transparent: true, opacity: o, depthWrite: false });
  const AO = { down: aoMat(S.down, 0.5), round: aoMat(S.round, 0.55) };

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

  /* ---------- light ---------- */
  const hemi = new THREE.HemisphereLight(0xfff0dd, 0x9a8670, 0.5);
  scene.add(hemi);
  const pedestal = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.pedestal);
  pedestal.rotation.x = -Math.PI / 2; pedestal.position.y = -0.121;
  scene.add(pedestal);
  const LIGHT = { mood: 0, cool: 0 };       // 0..1, animated between day/evening and warm/neutral
  const ledColor = new THREE.Color();
  function paintGlow(m) { m.color.copy(ledColor).multiplyScalar(m.userData.k * (1 + 0.25 * LIGHT.mood) * m.userData.fade); }
  function applyLight() {
    const e = LIGHT.mood;
    ledColor.copy(LED_WARM).lerp(LED_COOL, LIGHT.cool);
    hemi.intensity = 0.55 + (0.06 - 0.55) * e;
    spots.forEach((s) => { s.intensity = 9 + (1.6 - 9) * e; s.color.copy(SPOT_WARM).lerp(SPOT_COOL, LIGHT.cool); });
    glows.forEach(paintGlow);
    M.strip.color.copy(ledColor).multiplyScalar(6 + 2 * e);
    M.sconce.emissive.copy(ledColor); M.sconce.emissiveIntensity = 2 + 1.4 * e;
    M.downlight.color.setRGB(1, 0.86, 0.66).lerp(new THREE.Color(1, 0.96, 0.9), LIGHT.cool).multiplyScalar(3 - 1.6 * e);
    bloom.strength = 0.4 + 0.15 * e;
    renderer.toneMappingExposure = 1 + 0.15 * e;
    dirty = true;
  }

  /* ---------- animation ---------- */
  const anims = new Set();
  function anim(dur, fn, delay, done) {
    if (reduced) { fn(1); if (done) done(); return; }
    anims.add({ t0: performance.now() + (delay || 0), dur, fn, done, started: false });
    dirty = true;
  }
  function stepAnims(now) {
    anims.forEach((a) => {
      if (now < a.t0) { if (!a.started) { a.started = true; a.fn(0); } return; }
      a.started = true;
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) { anims.delete(a); if (a.done) a.done(); }
    });
    if (!anims.size && envAfter) { envAfter = false; queueEnv(); }
  }
  let envAfter = false;

  /* ---------- state ---------- */
  let st = null, P = null, room = new THREE.Group();
  scene.add(room);
  const parts = new Map();                     // key -> { g, sig, wall, kind, ... }
  let spots = [], spotSig = '';
  let dirty = true, tween = null, active = true, built = false, introDone = false, seen = new Set();

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
    const basin = s.basin === 'double' && vw < 1.1 ? 'trough' : (s.basin || 'trough');
    return { W, L, sw, sd, xs, zf, bath, vw, xv, zt, ba, bb, bx, bz, fx0, fx1, fz0, fz1, basin,
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
  let WD = null;
  const at = (wd, s, y, off) => wd.o.clone().addScaledVector(wd.u, s).add(V(0, y, 0)).addScaledVector(wd.n, off || 0);
  // a group on a wall: local x runs along the wall, local z points into the room
  function onWall(wd, s, y, parent) {
    const g = new THREE.Group();
    g.position.copy(at(wd, s, y, 0));
    g.rotation.y = Math.atan2(wd.n.x, wd.n.z);
    if (parent) parent.add(g);
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
  const sbox = (w, h, d, mat, parent, x, y, z, ox, oy) => mesh(planarUV(new THREE.BoxGeometry(w, h, d), ox, oy), mat, parent, x, y, z);
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
    m.renderOrder = glows.has(mat) ? 3 : 1;
    m.userData.noPick = true;
    parent.add(m);
    return m;
  }
  const strip = (w, h, d, parent, x, y, z) => { const m = box(w, h, d, M.strip, parent, x, y, z, false); m.userData.strip = true; m.userData.noPick = true; return m; };

  /* ---------- parts: rebuilt only when what they depend on changes ---------- */
  function part(key, sig, o, make) {
    seen.add(key);
    const s = JSON.stringify(sig), old = parts.get(key);
    if (old && old.sig === s) return old;
    const g = new THREE.Group();
    g.userData.part = key;
    if (o.pick) g.userData.pick = o.pick;
    make(g);
    room.add(g);
    const p = { key, g, sig: s, wall: o.wall || null, kind: o.kind || 'fit' };
    if (p.kind === 'wall') { p.full = g.children[0]; p.stub = g.children[1]; }
    parts.set(key, p);
    if (old) retire(old);
    dirty = true;
    return p;
  }
  function retire(p) {
    if (parts.get(p.key) === p) parts.delete(p.key);
    room.remove(p.g);
    disposeTree(p.g);
    dirty = true;
  }
  function disposeTree(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isReflector) { o.getRenderTarget().dispose(); o.material.dispose(); }
      if (o.material && glows.has(o.material)) { glows.delete(o.material); o.material.dispose(); }
      if (o.material && o.material.userData.own) { if (o.material.normalMap) o.material.normalMap.dispose(); o.material.dispose(); }
    });
  }

  /* ---------- walls ---------- */
  function wallPart(key, holes, featureSpan) {
    const wd = WD[key];
    return part('wall:' + key, [wd.len, wd.o.toArray(), holes, featureSpan], { kind: 'wall' }, (g) => {
      const full = new THREE.Group(), stub = new THREE.Group();
      g.add(full, stub);
      const ry = Math.atan2(wd.n.x, wd.n.z), r = rng(key.length * 97 + Math.round(wd.len * 10));
      // stone slabs, evenly divided; the shower's walls are their own run so joints line up with the glass
      const runs = featureSpan ? [[0, featureSpan[0], false], [featureSpan[0], featureSpan[1], true], [featureSpan[1], wd.len, false]] : [[0, wd.len, false]];
      const qWall = new Quads(), qFeat = new Quads();
      let idx = 0;
      runs.forEach(([a, b, feat]) => {
        if (b - a < 0.01) return;
        const n = Math.max(1, Math.round((b - a) / 1.2)), sw = (b - a) / n, f = sw / TEX, q = feat ? qFeat : qWall;
        for (let i = 0; i < n; i++, idx++) {
          const s0 = a + i * sw, flip = idx % 2 === 1;                    // neighbours mirrored, like book-matched marble
          const off = fract(key.length * 0.137 + (idx >> 1) * 0.381 + r() * 0.05) * (1 - f);
          const uvAt = (s, y) => { let t = (s - s0) / sw; if (flip) t = 1 - t; return [off + t * f, y / TEX]; };
          cut({ s0: s0 + (s0 > 0.001 ? GAP / 2 : 0), s1: s0 + sw - (s0 + sw < wd.len - 0.001 ? GAP / 2 : 0), y0: 0, y1: H }, holes).forEach((c) => {
            const p0 = uvAt(c.s0, c.y0), p1 = uvAt(c.s1, c.y1);
            q.add(at(wd, c.s0, c.y0, SLAB), wd.u, UP, wd.n, c.s1 - c.s0, c.y1 - c.y0, [p0[0], p0[1], p1[0], p1[1]]);
          });
        }
      });
      [[qWall, M.wall, 'wall'], [qFeat, M.feature, 'feature']].forEach(([q, mat, tag]) => {
        if (!q.i.length) return;
        const m = new THREE.Mesh(q.geometry(), mat);
        m.receiveShadow = true; m.userData.pick = tag;
        full.add(m);
      });
      // the wall core, dark, seen at the joints and where the model is cut. Around a niche it stands back by a few
      // millimetres, so its faces never share a plane with the niche lining (that is what made niches flicker)
      const coreHoles = holes.map((h) => (h.depth ? { s0: h.s0 - 0.004, s1: h.s1 + 0.004, y0: h.y0 - 0.004, y1: h.y1 + 0.004 } : h));
      cut({ s0: -T, s1: wd.len + T, y0: 0, y1: H }, coreHoles).forEach((c) => {
        const m = box(c.s1 - c.s0, c.y1 - c.y0, T, M.shell, full, 0, 0, 0, false);
        m.receiveShadow = true;
        m.position.copy(at(wd, (c.s0 + c.s1) / 2, (c.y0 + c.y1) / 2, -T / 2 - 0.001)); m.rotation.y = ry;
        m.userData.pick = 'wall';
      });
      // fine gold line on top of the cut wall
      const line = box(wd.len + 2 * T, 0.006, 0.006, M.hair, full, 0, 0, 0, false);
      line.position.copy(at(wd, wd.len / 2, H + 0.003, -0.005)); line.rotation.y = ry; line.userData.noPick = true;
      // niches
      holes.filter((h) => h.depth).forEach((h) => {
        const d = h.depth, w = h.s1 - h.s0, hh = h.y1 - h.y0, nq = new Quads(), m = wd.n.clone().negate();
        nq.add(at(wd, h.s0, h.y0, -d), wd.u, UP, wd.n, w, hh, [0, 0, w / TEX, hh / TEX]);
        nq.add(at(wd, h.s0, h.y0, SLAB), wd.u, m, UP, w, d + SLAB, [0, 0, w / TEX, d / TEX]);
        nq.add(at(wd, h.s0, h.y1, -d), wd.u, wd.n, UP.clone().negate(), w, d + SLAB, [0, 0, w / TEX, d / TEX]);
        nq.add(at(wd, h.s0, h.y0, SLAB), m, UP, wd.u, d + SLAB, hh, [0, 0, d / TEX, hh / TEX]);
        nq.add(at(wd, h.s1, h.y0, -d), wd.n, UP, wd.u.clone().negate(), d + SLAB, hh, [0, 0, d / TEX, hh / TEX]);
        const nm = new THREE.Mesh(nq.geometry(), h.feature ? M.feature : M.wall);
        nm.receiveShadow = true; nm.userData.pick = h.feature ? 'feature' : 'wall';
        full.add(nm);
        // closes the wall behind the niche, wider than the opening and a few millimetres behind its back face
        const plug = box(w + 0.02, hh + 0.02, T - d - 0.004, M.shell, full, 0, 0, 0, false);
        plug.position.copy(at(wd, (h.s0 + h.s1) / 2, (h.y0 + h.y1) / 2, -d - 0.004 - (T - d - 0.004) / 2 - 0.001)); plug.rotation.y = ry;
      });
      // soft shade in the corners and along the floor
      [0, wd.len].forEach((s, i) => {
        const cg = onWall(wd, s, 0, full);
        const p = plane(H, 0.22, AO.down, cg, (i ? -1 : 1) * 0.11, H / 2, DECAL);
        p.rotation.z = (i ? -1 : 1) * Math.PI / 2;
      });
      const bg = onWall(wd, wd.len / 2, 0, full);
      plane(wd.len, 0.25, AO.down, bg, 0, 0.125, DECAL).rotation.z = Math.PI;
      // low stub shown when the wall is cut away
      const sb = box(wd.len + 2 * T, 0.07, T, M.shell, stub, 0, 0, 0, false);
      sb.position.copy(at(wd, wd.len / 2, 0.035, -T / 2 - 0.001)); sb.rotation.y = ry;
      const sl = box(wd.len + 2 * T, 0.004, 0.004, M.hair, stub, 0, 0, 0, false);
      sl.position.copy(at(wd, wd.len / 2, 0.072, -0.004)); sl.rotation.y = ry;
      stub.visible = false;
    });
  }

  /* ---------- floor ---------- */
  function floorPart() {
    const { W, L } = P, pat = st.pattern || 'large';
    const p = part('floor', [W, L, pat], { kind: 'static', pick: 'floor' }, (g) => {
      const r = rng(7 + Math.round(W * 10) * 31 + Math.round(L * 10));
      const tw = pat === 'square' ? 0.9 : 1.2, td = pat === 'square' ? 0.9 : 0.6, fu = tw / TEX, fv = td / TEX;
      const nz = Math.ceil(L / td) + 1, nx = Math.ceil(W / tw) + 2;
      const z0 = -Math.ceil(L / td) * td / 2;
      const q = new Quads();
      for (let iz = 0; iz < nz; iz++) {
        const shift = pat === 'brick' && iz % 2 ? tw / 2 : 0;
        const x0 = -Math.ceil(W / tw) * tw / 2 - shift;
        for (let ix = 0; ix < nx; ix++) {
          const ax = x0 + ix * tw, az = z0 + iz * td;
          const cx0 = Math.max(ax, -W / 2) + (ax > -W / 2 ? GAP / 2 : 0), cx1 = Math.min(ax + tw, W / 2) - (ax + tw < W / 2 ? GAP / 2 : 0);
          const cz0 = Math.max(az, -L / 2) + (az > -L / 2 ? GAP / 2 : 0), cz1 = Math.min(az + td, L / 2) - (az + td < L / 2 ? GAP / 2 : 0);
          if (cx1 - cx0 < 0.005 || cz1 - cz0 < 0.005) continue;
          const ou = r() * (1 - fu), ov = r() * (1 - fv), rot = r() < 0.5;
          const U = (x) => ou + ((x - ax) / tw) * fu, Vv = (z) => ov + ((z - az) / td) * fv;
          let uv = [U(cx0), Vv(cz1), U(cx1), Vv(cz0)];
          if (rot) uv = [uv[2], uv[3], uv[0], uv[1]];
          q.add(V(cx0, 0, cz1), V(1, 0, 0), V(0, 0, -1), UP, cx1 - cx0, cz1 - cz0, uv);
        }
      }
      const tiles = new THREE.Mesh(q.geometry(), M.floor);
      tiles.receiveShadow = true;
      g.add(tiles);
      // dark bed under the tiles, seen in the joints
      const bed = box(W + 2 * T, 0.12, L + 2 * T, M.shell, g, 0, -0.063, 0, false);
      bed.receiveShadow = true;
      // soft shade along the walls
      const aoF = (w, x, z, ry) => { const m = plane(w, 0.32, AO.down, g, x, DECAL, z, -Math.PI / 2); m.rotation.order = 'YXZ'; m.rotation.y = ry; };
      aoF(W, 0, -L / 2 + 0.16, 0); aoF(W, 0, L / 2 - 0.16, Math.PI); aoF(L, -W / 2 + 0.16, 0, Math.PI / 2); aoF(L, W / 2 - 0.16, 0, -Math.PI / 2);
    });
    return p;
  }
  function inlayPart() {
    const { fx0, fx1, fz0, fz1, ex } = P, fw = fx1 - fx0, fd = fz1 - fz0, cx = (fx0 + fx1) / 2, cz = (fz0 + fz1) / 2;
    if (ex.star && fw > 0.5 && fd > 0.5) {
      part('star', [cx, cz, fw, fd], { kind: 'inlay', pick: 'star' }, (g) => {
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
          const pos = [], uv = [];
          for (let i = 0; i < arr.length; i += 2) { pos.push(arr[i], 0, -arr[i + 1]); uv.push(arr[i] / TEX + 0.3, arr[i + 1] / TEX + 0.3); }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
          geo.computeVertexNormals();
          const m = new THREE.Mesh(geo, mat); m.position.set(cx, INLAY, cz); m.receiveShadow = true; g.add(m);
        };
        tri(a, M.inlayMetal); tri(b, M.inlay);
        const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R * 0.675, 96), M.inlayMetal);
        ring.rotation.x = -Math.PI / 2; ring.position.set(cx, INLAY + 0.0012, cz); g.add(ring);
      });
    }
    if (ex.border && fw > 0.4 && fd > 0.4) {
      part('border', [fx0, fx1, fz0, fz1], { kind: 'inlay', pick: 'border' }, (g) => {
        const bw = 0.03;
        [[cx, fz0, fw + bw, bw], [cx, fz1, fw + bw, bw], [fx0, cz, bw, fd - bw], [fx1, cz, bw, fd - bw]].forEach((s) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(s[2], s[3]), M.inlay);
          m.rotation.x = -Math.PI / 2; m.position.set(s[0], INLAY, s[1]); m.receiveShadow = true; g.add(m);
        });
      });
    }
  }

  /* ---------- vanity ---------- */
  function vanityPart() {
    const { L, vw, xv, basin } = P, z0 = -L / 2;
    const ped = basin === 'pedestal';
    part('vanity', ped ? [xv, L, 'pedestal'] : [vw, xv, L, st.vanity === 'stone', st.front, basin], { kind: 'fit', wall: 'back', pick: 'vanity' }, (g) => {
      if (ped) {
        // freestanding round stone basin, made in his workshop: a column with a bowl carved into the top
        const R = 0.2, Hp = 0.86, zc = z0 + 0.3;
        const col = new THREE.CylinderGeometry(R, R, Hp, 64, 1, true);
        col.translate(0, Hp / 2, 0);
        mesh(col, M.wall, g, xv, 0, zc);
        const rim = new THREE.RingGeometry(0.155, R, 64); rim.rotateX(-Math.PI / 2);
        mesh(rim, M.wall, g, xv, Hp, zc);
        // the bowl's surface must face up and in; build the profile in whichever order gives that
        const prof = [[0, Hp - 0.12], [0.09, Hp - 0.115], [0.135, Hp - 0.085], [0.152, Hp - 0.04], [0.155, Hp]].map((q) => new THREE.Vector2(q[0], q[1]));
        let bowl = new THREE.LatheGeometry(prof, 64);
        if (bowl.attributes.normal.getY(1) < 0) { bowl.dispose(); bowl = new THREE.LatheGeometry(prof.slice().reverse(), 64); }
        mesh(bowl, M.wall, g, xv, 0, zc);
        cyl(0.02, 0.004, M.metal, g, 'y', xv, Hp - 0.118, zc);
        const reach = 0.3;
        cyl(0.03, 0.012, M.metal, g, 'z', xv, Hp + 0.24, z0 + 0.006);
        cyl(0.012, reach, M.metal, g, 'z', xv, Hp + 0.24, z0 + reach / 2);
        cyl(0.014, 0.02, M.metal, g, 'z', xv, Hp + 0.24, z0 + reach);
        [-1, 1].forEach((sgn) => { cyl(0.028, 0.01, M.metal, g, 'z', xv + sgn * 0.12, Hp + 0.24, z0 + 0.005); cyl(0.02, 0.045, M.metal, g, 'z', xv + sgn * 0.12, Hp + 0.24, z0 + 0.03); });
        return;
      }
      const cabMat = st.vanity === 'stone' ? M.wall : M.wood;
      if (st.front === 'fluted') {
        // carcass with a fluted front: rounded reeds across the full width
        sbox(vw, 0.4, 0.44, cabMat, g, xv, 0.58, z0 + 0.22, 0.1, 0.1);
        const sh = new THREE.Shape(), pitch = 0.03, n = Math.max(6, Math.round(vw / pitch)), pw = vw / n;
        sh.moveTo(-vw / 2, 0);
        for (let i = 0; i < n; i++) for (let j = 1; j <= 8; j++) { const x = -vw / 2 + (i + j / 8) * pw; sh.lineTo(x, 0.011 * Math.sin(Math.PI * j / 8)); }
        sh.lineTo(vw / 2, -0.004); sh.lineTo(-vw / 2, -0.004); sh.lineTo(-vw / 2, 0);
        const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.39, bevelEnabled: false, curveSegments: 4 });
        fg.rotateX(Math.PI / 2); fg.translate(0, 0.39, 0);
        planarUV(fg, 0.2, 0.1, 1.2);
        mesh(fg, cabMat, g, xv, 0.385, z0 + 0.444);
      } else {
        const cab = mesh(new RoundedBoxGeometry(vw, 0.4, 0.46, 3, 0.012), cabMat, g, xv, 0.58, z0 + 0.235);
        if (st.vanity === 'stone') planarUV(cab.geometry, 0.2, 0.1);
        box(vw - 0.04, 0.007, 0.004, M.groove, g, xv, 0.58, z0 + 0.466, false);
      }
      const taps = [];
      if (basin === 'vessel') {
        sbox(vw, 0.05, 0.5, M.wall, g, xv, 0.805, z0 + 0.25, 0.1, 0.2);
        const bowl = new THREE.LatheGeometry([[0, 0.004], [0.09, 0.004], [0.15, 0.03], [0.19, 0.09], [0.205, 0.135], [0.19, 0.135], [0.175, 0.095], [0.14, 0.045], [0.07, 0.02], [0, 0.018]]
          .map((q) => new THREE.Vector2(q[0], q[1])), 64);
        mesh(bowl, M.ceramic2, g, xv, 0.83, z0 + 0.26);
        cyl(0.018, 0.004, M.metal, g, 'y', xv, 0.852, z0 + 0.26);
        taps.push([xv, 1.13, 0.25]);
      } else {
        const th = 0.14, y = 0.78 + th / 2;
        const centers = basin === 'double' ? [xv - vw / 4 + 0.03, xv + vw / 4 - 0.03] : [xv];
        const bw = basin === 'double' ? Math.min(0.55, vw / 2 - 0.16) : clamp(vw * 0.62, 0.45, 0.95);
        sbox(vw, th, 0.12, M.wall, g, xv, y, z0 + 0.06, 0.1, 0.2);
        sbox(vw, th, 0.07, M.wall, g, xv, y, z0 + 0.465, 0.1, 0.2);
        const edges = [xv - vw / 2];
        centers.forEach((c) => { edges.push(c - bw / 2, c + bw / 2); });
        edges.push(xv + vw / 2);
        for (let i = 0; i < edges.length; i += 2) {
          const a = edges[i], b = edges[i + 1];
          if (b - a > 0.005) sbox(b - a, th, 0.31, M.wall, g, (a + b) / 2, y, z0 + 0.275, 0.1, 0.2);
        }
        centers.forEach((c) => {
          sbox(bw, 0.03, 0.31, M.wall, g, c, 0.795, z0 + 0.275, 0.1, 0.2);
          cyl(0.022, 0.004, M.metal, g, 'y', c, 0.812, z0 + 0.29);
          taps.push([c, 1.05, 0.19]);
        });
      }
      taps.forEach(([x, ty, reach]) => {
        cyl(0.03, 0.012, M.metal, g, 'z', x, ty, z0 + 0.006);
        cyl(0.012, reach, M.metal, g, 'z', x, ty, z0 + reach / 2);
        cyl(0.014, 0.02, M.metal, g, 'z', x, ty, z0 + reach);
        [-1, 1].forEach((sgn) => {
          cyl(0.028, 0.01, M.metal, g, 'z', x + sgn * 0.12, ty, z0 + 0.005);
          cyl(0.02, 0.045, M.metal, g, 'z', x + sgn * 0.12, ty, z0 + 0.03);
        });
      });
      // a few things on the counter
      if (basin !== 'double' && vw > 0.8) {
        const tx = xv - vw / 2 + 0.11, top = basin === 'vessel' ? 0.83 : 0.92;
        cyl(0.03, 0.17, M.bottleA, g, 'y', tx, top + 0.085, z0 + 0.22, 20);
        cyl(0.008, 0.03, M.metal, g, 'y', tx, top + 0.185, z0 + 0.22, 12);
        cyl(0.035, 0.12, M.bottleC, g, 'y', tx + 0.08, top + 0.06, z0 + 0.16, 20);
      }
    });
    // light under the vanity
    if (ped) {
      if (P.lit.plinth) part('plinthGlow', [xv, L, 'pedestal'], { kind: 'light' }, (g) => {
        const ring = mesh(new THREE.TorusGeometry(0.205, 0.004, 8, 96), M.strip, g, xv, 0.008, z0 + 0.3, false); ring.rotation.x = Math.PI / 2; ring.userData.noPick = true;
        plane(1.1, 1.1, glowMat(S.round, 1.0), g, xv, DECAL, z0 + 0.3, -Math.PI / 2);
      });
      else part('vanityShade', [xv, L, 'pedestal'], { kind: 'static' }, (g) => { plane(0.75, 0.75, AO.round, g, xv, DECAL, z0 + 0.3, -Math.PI / 2); });
    } else if (P.lit.plinth) {
      part('plinthGlow', [vw, xv, L], { kind: 'light' }, (g) => {
        strip(vw - 0.05, 0.006, 0.006, g, xv, 0.37, z0 + 0.39);
        plane(vw + 0.5, 0.9, glowMat(S.down, 0.8), g, xv, DECAL, z0 + 0.46, -Math.PI / 2);
        plane(vw + 0.1, 0.38, glowMat(S.down, 0.7), g, xv, 0.19, z0 + DECAL);
      });
    } else {
      part('vanityShade', [vw, xv, L], { kind: 'static' }, (g) => { plane(vw + 0.1, 0.6, AO.round, g, xv, DECAL, z0 + 0.25, -Math.PI / 2); });
    }
  }

  function mirrorPart() {
    const { L, vw, xv, lit, W, xs, basin } = P, z0 = -L / 2, kind = st.mirror || 'rect';
    const maxW = basin === 'double' ? 1.4 : 1.1;
    const sOff = Math.min(clamp(vw - 0.36, 0.45, maxW) / 2 + 0.17, xs - 0.15 - xv, xv + W / 2 - 0.1);
    let mw = lit.sconce ? Math.min(clamp(vw - 0.36, 0.45, maxW), 2 * (sOff - 0.1)) : clamp(vw * 0.82, 0.45, maxW);
    let mh = 0.82;
    if (kind === 'arch') { mw = Math.min(mw, 0.7); mh = 0.98; }
    if (kind === 'round') { mw = Math.min(mw, 0.78); mh = mw; }
    const my = kind === 'arch' ? 1.6 : 1.56;
    part('mirror', [kind, mw, mh, my, xv, L], { kind: 'fit', wall: 'back', pick: 'mirror' }, (g) => {
      const res = Math.round(1024 * Q.mirror), shape = mirrorShape(kind, mw, mh);
      const glass = new Reflector(new THREE.ShapeGeometry(shape, 48), { clipBias: 0.003, textureWidth: res, textureHeight: Math.round(res * mh / mw), color: new THREE.Color().setRGB(0.47, 0.47, 0.47, THREE.LinearSRGBColorSpace) });
      glass.position.set(xv, my, z0 + 0.034);
      g.add(glass);
      const back = new THREE.ExtrudeGeometry(mirrorShape(kind, mw - 0.02, mh - 0.02), { depth: 0.018, bevelEnabled: false, curveSegments: 32 });
      mesh(back, M.mirrorBack, g, xv, my, z0 + 0.012, false);
    });
    if (lit.mirror) part('mirrorGlow', [kind, mw, mh, my, xv, L], { kind: 'light', wall: 'back' }, (g) => {
      plane(mw + 0.42, mh + 0.42, glowMat(haloTex(kind, (mw + 0.42) / (mh + 0.42)), 1.1), g, xv, my, z0 + DECAL);
    });
    if (lit.sconce) part('sconces', [sOff, xv, L, my], { kind: 'fit', wall: 'back', pick: 'sconce' }, (g) => {
      [-1, 1].forEach((sgn) => {
        const sx = xv + sgn * sOff;
        box(0.06, 0.3, 0.012, M.metal, g, sx, 1.58, z0 + 0.006);
        mesh(new RoundedBoxGeometry(0.1, 0.3, 0.07, 2, 0.01), M.sconce, g, sx, 1.58, z0 + 0.047);
        plane(0.5, 0.95, glowMat(S.round, 0.42), g, sx, 1.58, z0 + DECAL);
      });
    });
  }

  /* ---------- shower ---------- */
  function showerPart() {
    const { W, L, sw, sd, xs, zf, lit, ex } = P, z0 = -L / 2, cx = W / 2 - sw / 2, scr = st.screen || 'framed';
    part('screen', [sw, sd, xs, L, scr], { kind: 'fit', pick: 'screen' }, (g) => {
      const gl = sd - 0.02;
      const glass = box(0.008, 2.0, gl, scr === 'fluted' ? M.reeded : M.glass, g, xs, 1.0, z0 + gl / 2, false);
      glass.renderOrder = 4;
      if (scr === 'fluted') { const t = S.reeds.clone(); t.needsUpdate = true; t.repeat.set(gl / 0.018, 1); glass.material = M.reeded.clone(); glass.material.normalMap = t; glass.material.userData.own = true; }
      box(0.022, 2.0, 0.022, M.metal, g, xs, 1.0, z0 + 0.011);                      // wall channel
      if (scr === 'frameless') {
        cyl(0.008, W / 2 - xs, M.metal, g, 'x', (xs + W / 2) / 2, 1.97, z0 + gl * 0.72);  // support bar to the side wall
        cyl(0.018, 0.02, M.metal, g, 'x', W / 2 - 0.01, 1.97, z0 + gl * 0.72);
      } else {
        box(0.022, 0.022, gl, M.metal, g, xs, 2.0, z0 + gl / 2);
        box(0.022, 2.0, 0.022, M.metal, g, xs, 1.0, z0 + gl);
        box(0.022, 0.012, gl, M.metal, g, xs, 0.006, z0 + gl / 2);
      }
      box(sw - 0.24, 0.004, 0.05, M.metal, g, cx + 0.02, 0.003, zf - 0.09, false);      // linear drain
    });
    if (ex.bench) {
      const bl = sw - 0.04, bxc = xs + 0.02 + bl / 2, mat = st.feature && st.feature !== 'same' ? M.feature : M.wall;
      part('bench', [bl, bxc, L, mat === M.feature], { kind: 'fit', wall: null, pick: 'bench' }, (g) => {
        sbox(bl, 0.05, 0.42, mat, g, bxc, 0.445, z0 + 0.21, 0.3, 0.1);
        sbox(bl, 0.42, 0.36, mat, g, bxc, 0.21, z0 + 0.18, 0.3, 0.1);
      });
      if (lit.plinth) part('benchGlow', [bl, bxc, L], { kind: 'light' }, (g) => {
        strip(bl - 0.02, 0.006, 0.006, g, bxc, 0.414, z0 + 0.4);
        plane(bl, 0.66, glowMat(S.down, 0.75), g, bxc, DECAL, z0 + 0.36 + 0.33, -Math.PI / 2);
        plane(bl, 0.4, glowMat(S.down, 0.7), g, bxc, 0.2, z0 + 0.36 + DECAL);
      });
    }
    if (ex.rain) part('rain', [cx, L], { kind: 'fit', wall: 'back', pick: 'rain' }, (g) => {
      cyl(0.03, 0.012, M.metal, g, 'z', cx, 2.16, z0 + 0.006);
      cyl(0.011, 0.36, M.metal, g, 'z', cx, 2.16, z0 + 0.18);
      cyl(0.16, 0.012, M.metal, g, 'y', cx, 2.14, z0 + 0.38, 48);
    });
    part('controls', [sd, L, W], { kind: 'fit', wall: 'right' }, (g) => {
      const r = WD.right;
      const c = onWall(r, sd * 0.42, 1.12, g);
      cyl(0.075, 0.01, M.metal, c, 'z', 0, 0, 0.005, 40);
      cyl(0.026, 0.05, M.metal, c, 'z', 0, 0, 0.03);
      cyl(0.018, 0.04, M.metal, c, 'z', 0, -0.13, 0.02);
      const rail = onWall(r, sd * 0.78, 0, g);
      cyl(0.01, 0.85, M.metal, rail, 'y', 0, 1.45, 0.04);
      cyl(0.012, 0.04, M.metal, rail, 'z', 0, 1.04, 0.02); cyl(0.012, 0.04, M.metal, rail, 'z', 0, 1.86, 0.02);
      const hs = cyl(0.02, 0.22, M.metal, rail, 'y', 0, 1.62, 0.07); hs.rotation.x = 0.25;
      const hose = new THREE.CatmullRomCurve3([V(0, 1.52, 0.07), V(-0.02, 1.05, 0.12), V(-(sd * 0.36) * 0.6, 0.86, 0.08), V(-(sd * 0.36), 0.99, 0.02)]);
      mesh(new THREE.TubeGeometry(hose, 40, 0.007, 8), M.metal, rail);
    });
  }

  function nichePart(holes) {
    if (!P.lit.niche) return;
    const b = WD.back, h = holes.back, w = h.s1 - h.s0;
    part('nicheShower', [h], { kind: 'light', wall: 'back', pick: 'niche' }, (g) => {
      const n = onWall(b, (h.s0 + h.s1) / 2, 0, g);
      strip(w - 0.02, 0.006, 0.006, n, 0, h.y1 - 0.012, -0.012);
      plane(w, h.y1 - h.y0, glowMat(S.down, 1.3), n, 0, (h.y0 + h.y1) / 2, -h.depth + DECAL);
      plane(w, h.depth, glowMat(S.down, 0.9), n, 0, h.y0 + DECAL, -h.depth / 2, -Math.PI / 2);
      cyl(0.028, 0.19, M.bottleB, n, 'y', -w * 0.25, h.y0 + 0.095, -0.05, 20);
      cyl(0.03, 0.15, M.bottleC, n, 'y', -w * 0.25 + 0.075, h.y0 + 0.075, -0.05, 20);
      cyl(0.024, 0.12, M.bottleA, n, 'y', w * 0.22, h.y0 + 0.06, -0.05, 20);
    });
    const l = WD.left, t = holes.left, tw = t.s1 - t.s0;
    part('nicheTall', [t], { kind: 'light', wall: 'left', pick: 'niche' }, (g) => {
      const n = onWall(l, (t.s0 + t.s1) / 2, 0, g);
      [-1, 1].forEach((sgn) => strip(0.006, t.y1 - t.y0 - 0.02, 0.006, n, sgn * (tw / 2 - 0.012), (t.y0 + t.y1) / 2, -0.012));
      plane(tw, t.y1 - t.y0, glowMat(S.sides, 0.9), n, 0, (t.y0 + t.y1) / 2, -t.depth + DECAL);
      [0.33, 0.66].forEach((k) => box(tw - 0.004, 0.012, t.depth - 0.005, M.shelf, n, 0, t.y0 + (t.y1 - t.y0) * k, -t.depth / 2, false));
      const vase = new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.05, 0.05], [0.045, 0.12], [0.022, 0.19], [0.026, 0.21], [0, 0.21]].map((q) => new THREE.Vector2(q[0], q[1])), 32);
      mesh(vase, M.bottleC, n, 0, t.y0 + 0.006, -0.05);
      [[-0.012, 0.24, -0.2], [0.01, 0.28, 0.15], [0.0, 0.22, 0.02]].forEach((q) => { const s = cyl(0.002, q[1], M.bottleB, n, 'y', q[0], t.y0 + 0.16 + q[1] / 2, -0.05, 6); s.rotation.z = q[2]; });
      cyl(0.03, 0.11, M.bottleB, n, 'y', -0.04, t.y0 + (t.y1 - t.y0) * 0.33 + 0.066, -0.05, 20);
      cyl(0.025, 0.14, M.bottleA, n, 'y', 0.05, t.y0 + (t.y1 - t.y0) * 0.66 + 0.076, -0.05, 20);
    });
  }

  function toiletPart() {
    const { L, zt } = P;
    part('toilet', [zt, L], { kind: 'fit', wall: 'left', pick: 'toilet' }, (g) => {
      const t = onWall(WD.left, L / 2 - zt, 0, g);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.4); sh.lineTo(0.46, 0.4);
      sh.quadraticCurveTo(0.53, 0.4, 0.53, 0.33);
      sh.quadraticCurveTo(0.52, 0.19, 0.34, 0.165);
      sh.lineTo(0, 0.2); sh.lineTo(0, 0.4);
      const pan = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.028, bevelSegments: 6, curveSegments: 24 });
      pan.rotateY(-Math.PI / 2); pan.translate(0.14, 0, 0);
      mesh(pan, M.ceramic, t);
      mesh(new RoundedBoxGeometry(0.355, 0.028, 0.5, 3, 0.012), M.ceramic, t, 0, 0.443, 0.27);
      box(0.24, 0.155, 0.008, M.metal, t, 0, 1.0, 0.004);
      box(0.002, 0.13, 0.004, M.groove, t, 0, 1.0, 0.009, false);
      plane(0.5, 0.75, AO.round, t, 0, DECAL, 0.3, -Math.PI / 2);
    });
  }

  function railPart() {
    if (!P.ex.rail) return;
    part('rail', [P.L], { kind: 'fit', wall: 'left', pick: 'rail' }, (g) => {
      const r = onWall(WD.left, 0.62, 0, g), y0 = 0.7, y1 = 1.7, hw = 0.25;
      [-1, 1].forEach((sgn) => {
        cyl(0.013, y1 - y0, M.metal, r, 'y', sgn * hw, (y0 + y1) / 2, 0.065);
        [y0 + 0.08, y1 - 0.08].forEach((yy) => cyl(0.009, 0.06, M.metal, r, 'z', sgn * hw, yy, 0.03));
      });
      for (let i = 0; i < 9; i++) cyl(0.009, hw * 2, M.metal, r, 'x', 0, y0 + 0.05 + i * ((y1 - y0 - 0.1) / 8), 0.065);
      const towel = mesh(new RoundedBoxGeometry(hw * 1.7, 0.42, 0.03, 2, 0.012), M.towel, r, 0, y1 - 0.32, 0.09);
      towel.rotation.x = -0.05;
    });
  }

  function bathPart() {
    if (!P.bath) return;
    const { ba, bb, bx, bz } = P;
    part('bath', [bx, bz], { kind: 'fit', pick: 'bath' }, (g) => {
      const pts = [[0, 0.07], [0.74, 0.08], [0.86, 0.2], [0.92, 0.5], [0.94, 0.6], [1.0, 0.6], [0.99, 0.42], [0.95, 0.16], [0.88, 0.02], [0.8, 0]].map((p) => new THREE.Vector2(p[0], p[1]));
      const geo = new THREE.LatheGeometry(pts, 72);
      geo.scale(ba, 1, bb);
      mesh(geo, M.ceramic2, g, bx, 0, bz);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), M.water);
      water.rotation.x = -Math.PI / 2; water.scale.set(ba * 0.905, bb * 0.905, 1); water.position.set(bx, 0.46, bz); water.userData.noPick = true; water.renderOrder = 4;
      g.add(water);
      plane(ba * 2.6, bb * 2.4, AO.round, g, bx, DECAL, bz, -Math.PI / 2);
      const fx = bx - ba - 0.14, fz = bz + bb * 0.35;
      cyl(0.05, 0.012, M.metal, g, 'y', fx, 0.006, fz, 32);
      cyl(0.017, 0.92, M.metal, g, 'y', fx, 0.46, fz);
      const spout = new THREE.QuadraticBezierCurve3(V(fx, 0.92, fz), V(fx, 1.08, fz), V(fx + 0.17, 1.0, fz));
      mesh(new THREE.TubeGeometry(spout, 24, 0.017, 12), M.metal, g);
      cyl(0.02, 0.06, M.metal, g, 'y', fx - 0.03, 0.74, fz, 20);
    });
  }

  function doorPart(door) {
    part('door', [P.W, door], { kind: 'fit', wall: 'front' }, (g) => {
      const d = onWall(WD.front, (door.s0 + door.s1) / 2, 0, g), w = door.s1 - door.s0;
      box(w - 0.01, door.y1 - 0.005, 0.04, M.door, d, 0, (door.y1 - 0.005) / 2, -0.07);
      box(0.13, 0.016, 0.016, M.metal, d, w / 2 - 0.12, 1.02, -0.035);
      cyl(0.025, 0.02, M.metal, d, 'z', w / 2 - 0.06, 1.02, -0.045);
    });
  }

  function ceilingPart() {
    const { W, L, lit } = P;
    part('ceiling', [W, L, !!lit.cove, spotSig], { kind: 'static' }, (g) => {
      const c = plane(W, L, M.plaster, g, 0, H, 0, Math.PI / 2);
      c.renderOrder = 0;
      spots.forEach((s) => { const d = mesh(new THREE.CircleGeometry(0.035, 24), M.downlight, g, s.position.x, H - 0.003, s.position.z, false); d.rotation.x = Math.PI / 2; });
      if (lit.cove) {
        const i = 0.04;
        strip(W - 2 * i, 0.006, 0.006, g, 0, H - 0.03, -L / 2 + i); strip(W - 2 * i, 0.006, 0.006, g, 0, H - 0.03, L / 2 - i);
        strip(0.006, 0.006, L - 2 * i, g, -W / 2 + i, H - 0.03, 0); strip(0.006, 0.006, L - 2 * i, g, W / 2 - i, H - 0.03, 0);
        const spill = (w, x, z, ry) => { const m = plane(w, 0.45, glowMat(S.down, 0.45), g, x, H - DECAL, z, Math.PI / 2); m.rotation.order = 'YXZ'; m.rotation.y = ry; };
        spill(W, 0, -L / 2 + 0.225, Math.PI); spill(W, 0, L / 2 - 0.225, 0); spill(L, -W / 2 + 0.225, 0, -Math.PI / 2); spill(L, W / 2 - 0.225, 0, Math.PI / 2);
      }
    });
    if (lit.cove) Object.keys(WD).forEach((k) => {
      const wd = WD[k];
      part('cove:' + k, [wd.len, wd.o.toArray()], { kind: 'light', wall: k, pick: 'cove' }, (g) => {
        const cg = onWall(wd, wd.len / 2, 0, g);
        plane(wd.len, 0.62, glowMat(S.down, 0.5), cg, 0, H - 0.31, DECAL);
      });
    });
  }

  function lightsBuild() {
    const { W, L, xv, sw, sd, bath, bx, bz, fx0, fx1, fz0, fz1 } = P;
    const pts = [[xv, -L / 2 + 0.55, true], [W / 2 - sw / 2, -L / 2 + sd / 2, false], [(fx0 + fx1) / 2, (fz0 + fz1) / 2, true]];
    if (bath) pts.push([bx, bz, false]);
    else if (L > 3.2) pts.push([(fx0 + fx1) / 2, L / 2 - 0.6, false]);
    const sig = JSON.stringify(pts.map((p) => [p[0].toFixed(2), p[1].toFixed(2)]));
    if (sig === spotSig) return;
    spotSig = sig;
    spots.forEach((s) => { scene.remove(s, s.target); s.dispose(); });
    spots = pts.map((p) => {
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
      return s;
    });
    applyLight();
  }

  function dimsPart() {
    const { W, L } = P;
    part('dims', [W, L], { kind: 'static' }, (g) => {
      const y = -0.118, off = T + 0.32, tick = 0.08, pts = [];
      const seg = (a, b) => pts.push(a, b);
      seg(V(-W / 2, y, L / 2 + off), V(W / 2, y, L / 2 + off));
      seg(V(-W / 2, y, L / 2 + off - tick), V(-W / 2, y, L / 2 + off + tick));
      seg(V(W / 2, y, L / 2 + off - tick), V(W / 2, y, L / 2 + off + tick));
      seg(V(W / 2 + off, y, -L / 2), V(W / 2 + off, y, L / 2));
      seg(V(W / 2 + off - tick, y, -L / 2), V(W / 2 + off + tick, y, -L / 2));
      seg(V(W / 2 + off - tick, y, L / 2), V(W / 2 + off + tick, y, L / 2));
      const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.dim);
      l.userData.noPick = true;
      g.add(l);
      g.userData.w = V(0, y, L / 2 + off + 0.22); g.userData.l = V(W / 2 + off + 0.22, y, 0);
    });
  }

  /* ---------- build or rebuild ---------- */
  let buildQueued = false;
  function queueBuild() {
    P = layout(st);
    WD = wallsDef(P.W, P.L);
    if (!built) { build(); return; }
    if (buildQueued) return;                 // several quick changes become one rebuild
    buildQueued = true;
    requestAnimationFrame(() => { buildQueued = false; build(); });
  }
  function build() {
    P = layout(st);
    WD = wallsDef(P.W, P.L);
    seen = new Set();
    const { W, L, sw, sd, zt, lit } = P;
    const feat = !!st.feature;
    const holes = {};
    if (lit.niche) {
      const nw = Math.min(sw - 0.3, 0.72), cx = W - sw / 2;
      holes.back = { s0: cx - nw / 2, s1: cx + nw / 2, y0: 1.08, y1: 1.42, depth: 0.1, feature: feat };
      const s = L / 2 - zt;
      holes.left = { s0: s - 0.15, s1: s + 0.15, y0: 1.22, y1: 2.04, depth: 0.1 };
    }
    const door = { s0: W - 0.95, s1: W - 0.15, y0: 0, y1: 2.05, through: true };
    wallPart('back', holes.back ? [holes.back] : [], [W - sw, W]);
    wallPart('right', [], [0, sd]);
    wallPart('front', [door], null);
    wallPart('left', holes.left ? [holes.left] : [], null);
    lightsBuild();
    floorPart();
    inlayPart();
    vanityPart();
    mirrorPart();
    showerPart();
    nichePart(holes);
    toiletPart();
    railPart();
    bathPart();
    doorPart(door);
    ceilingPart();
    dimsPart();
    // anything not rebuilt this time is no longer wanted
    Array.from(parts.values()).forEach((p) => { if (!seen.has(p.key)) retire(p); });
    built = true;
    dirty = true;
    queueEnv();
  }

  /* ---------- finishes: stone pours in, metal shifts colour ---------- */
  function setStone(mat, name, tint) {
    mat.userData.want = name;
    if (mat.userData.has === name) return Promise.resolve();
    if (!mat.map) { mat.color.set(tint); mat.needsUpdate = true; }
    return tex(name).then((t) => {
      if (mat.userData.want !== name || !t) return;
      mat.userData.has = name;
      const u = mat.userData.sw;
      if (!mat.map || reduced || !introDone) {
        mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; u.uOn.value = 0; return;
      }
      if (u.uOn.value > 0.5 && u.uMapB.value) mat.map = u.uMapB.value;     // finish any fade still running
      u.uMapB.value = t; u.uOn.value = 1; u.uT.value = 0;
      anim(260, (k) => { u.uT.value = k; }, 0, () => { mat.map = t; u.uOn.value = 0; dirty = true; });
      envAfter = true;
    });
  }
  let metalNow = null;
  function setMetal(id) {
    const m = METALS[id] || METALS.brass;
    if (metalNow === id) return;
    const from = { c: M.metal.color.clone(), r: M.metal.roughness, me: M.metal.metalness };
    const to = { c: new THREE.Color(m.color), r: m.roughness, me: m.metalness };
    const first = metalNow === null;
    metalNow = id;
    const apply = (k) => {
      [M.metal, M.inlayMetal].forEach((mat) => { mat.color.copy(from.c).lerp(to.c, k); mat.roughness = from.r + (to.r - from.r) * k; mat.metalness = from.me + (to.me - from.me) * k; });
      dirty = true;
    };
    if (first || !introDone) apply(1); else { anim(260, (k) => apply(easeOut(k))); envAfter = true; }
  }
  function finishes() {
    setMetal(st.metal);
    const dark = st.floor === 'black' || st.floor === 'brown';
    M.inlay.color.set(dark ? 0xd9ccb4 : 0x1d1b19);
    const featName = st.feature && st.feature !== 'same' ? st.feature : st.wall;
    const cool = st.led === 'neutral' ? 1 : 0;
    if (cool !== LIGHT.cool) {
      const from = LIGHT.cool;
      if (!introDone) { LIGHT.cool = cool; applyLight(); }
      else { anim(260, (k) => { LIGHT.cool = from + (cool - from) * easeOut(k); applyLight(); }); envAfter = true; }
    }
    return Promise.all([
      setStone(M.wall, st.wall, STONE_TINT[st.wall] || 0x777777),
      setStone(M.feature, featName, STONE_TINT[featName] || 0x777777),
      setStone(M.floor, st.floor, STONE_TINT[st.floor] || 0x777777),
      setStone(M.wood, st.vanity === 'oak' ? 'oak' : 'walnut', st.vanity === 'oak' ? 0x3a2c22 : 0x5a3a22)
    ]).then(() => { dirty = true; queueEnv(); });
  }

  /* ---------- reflections: photograph the room from its centre ---------- */
  let envTimer = 0;
  function queueEnv() { clearTimeout(envTimer); envTimer = setTimeout(() => { if (anims.size) envAfter = true; else captureEnv(); }, 120); }
  function captureEnv() {
    if (!P) return;
    const keep = [];
    parts.forEach((p) => {
      keep.push([p.g, p.g.visible]);
      p.g.visible = p.kind !== 'static' || p.key === 'ceiling';
      if (p.kind === 'wall') { keep.push([p.full, p.full.visible], [p.stub, p.stub.visible]); p.full.visible = true; p.stub.visible = false; }
      p.g.traverse((o) => { if (o.isReflector) { keep.push([o, o.visible]); o.visible = false; } });
    });
    cubeCam.position.set(0, 1.35, P.L * 0.1);
    for (let i = 0; i < 2; i++) {
      cubeCam.update(renderer, scene);
      const env = pmrem.fromCubemap(cubeRT.texture);
      if (envRT) envRT.dispose();
      envRT = env;
      scene.environment = env.texture;
    }
    keep.forEach(([o, v]) => { o.visible = v; });
    dirty = true;
  }

  /* ---------- cut-away: hide whatever is between the camera and the room ---------- */
  const proj = new THREE.Vector3();
  let isInside = false;
  function cutaway() {
    if (!P) return;
    const c = camera.position, { W, L } = P, m = 0.18;
    const dist = { back: c.z + L / 2, front: L / 2 - c.z, left: c.x + W / 2, right: W / 2 - c.x };
    const hide = {};
    Object.keys(dist).forEach((k) => { hide[k] = dist[k] < m; });
    isInside = !hide.back && !hide.front && !hide.left && !hide.right && c.y < H - 0.12 && c.y > 0.05;
    parts.forEach((p) => {
      if (p.kind === 'wall') { const k = p.key.slice(5); p.g.visible = true; p.full.visible = !hide[k]; p.stub.visible = hide[k]; return; }
      if (p.key === 'ceiling') { p.g.visible = isInside; return; }
      if (p.key === 'dims') { p.g.visible = !isInside; return; }
      p.g.visible = p.wall ? !hide[p.wall] : true;
    });
    labels();
  }
  function labels() {
    const lab = opt.labels, d = parts.get('dims');
    if (!lab) return;
    camera.updateMatrixWorld();
    [['w', P.W], ['l', P.L]].forEach(([k, val]) => {
      const el = lab[k];
      if (!el) return;
      if (isInside || !d) { el.hidden = true; return; }
      proj.copy(d.g.userData[k]).project(camera);
      const ok = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
      el.hidden = !ok;
      if (ok) {
        el.textContent = val.toFixed(1) + ' m';
        el.style.transform = 'translate(' + ((proj.x + 1) / 2 * host.clientWidth).toFixed(1) + 'px,' + ((1 - proj.y) / 2 * host.clientHeight).toFixed(1) + 'px) translate(-50%,-50%)';
      }
    });
  }
  // depth range follows the camera: tight outside the room for crisp layers, short near plane inside it
  const roomBox = new THREE.Box3();
  function fitDepth() {
    if (!P) return;
    roomBox.min.set(-P.W / 2 - T - 0.6, -0.15, -P.L / 2 - T - 0.6);
    roomBox.max.set(P.W / 2 + T + 0.6, H + 0.1, P.L / 2 + T + 0.6);
    const d = roomBox.distanceToPoint(camera.position);
    const near = d <= 0 ? 0.03 : clamp(d * 0.5, 0.05, 2);
    const far = camera.position.length() + 30;
    if (Math.abs(near - camera.near) > 0.005 || Math.abs(far - camera.far) > 1) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
  }

  /* ---------- click or hover a part to edit it ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    if (!P) return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(room.children, true);
    for (const h of hits) {
      let o = h.object, vis = true, tag = null;
      if (o.userData.noPick) continue;
      for (let q = o; q; q = q.parent) { if (!q.visible) { vis = false; break; } if (!tag && q.userData.pick) tag = q.userData.pick; }
      if (!vis) continue;
      return tag;
    }
    return null;
  }
  let down = null, hoverQueued = false, lastMove = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 6 && performance.now() - down.t < 500 && opt.onPick) { const tag = pickAt(e.clientX, e.clientY); if (tag) opt.onPick(tag); }
    down = null;
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || !opt.onHover) return;
    lastMove = e;
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const tag = pickAt(lastMove.clientX, lastMove.clientY);
      renderer.domElement.style.cursor = tag ? 'pointer' : '';
      const r = host.getBoundingClientRect();
      opt.onHover(tag, lastMove.clientX - r.left, lastMove.clientY - r.top);
    });
  });
  renderer.domElement.addEventListener('pointerleave', () => { renderer.domElement.style.cursor = ''; if (opt.onHover) opt.onHover(null); });

  /* ---------- camera views ---------- */
  function views() {
    const { W, L, xv, sw, sd, bath, bx, bz } = P, a = camera.aspect;
    const rad = Math.sqrt(W * W + L * L + H * H) / 2;
    const vf = THREE.MathUtils.degToRad(34), hf = 2 * Math.atan(Math.tan(vf / 2) * a);
    const fit = rad / Math.sin(Math.min(vf, hf) / 2) * 0.93;   // the room fills the view; the cut-away corner may crop a little
    const dir = V(0.58, 0.72, 1).normalize();
    const pf = THREE.MathUtils.degToRad(30), phf = 2 * Math.atan(Math.tan(pf / 2) * a);
    const planD = Math.max((W / 2 + 0.7) / Math.tan(phf / 2), (L / 2 + 0.7) / Math.tan(pf / 2)) + H;
    const inZ = (z) => Math.min(z, L / 2 - 0.3);
    const v = {
      overview: { p: dir.multiplyScalar(fit).add(V(0, 0.6, 0)), t: V(0, 0.75, 0), f: 34 },
      plan: { p: V(0, planD, 0.001), t: V(0, 0, 0), f: 30 },
      vanity: { p: V(xv + Math.min(0.25, W * 0.08), 1.52, inZ(-L / 2 + 2.1)), t: V(xv, 1.08, -L / 2), f: 52 },
      shower: { p: V(Math.max(-W / 2 + 0.35, W / 2 - sw / 2 - 0.8), 1.5, inZ(-L / 2 + sd + 1.5)), t: V(W / 2 - sw / 2 - 0.05, 1.05, -L / 2 + sd * 0.4), f: 52 }
    };
    if (bath) v.bath = { p: V(-W / 2 + 0.35, 1.55, inZ(bz + 1.0)), t: V(bx, 0.45, bz - 0.15), f: 52 };
    return v;
  }
  let viewName = 'overview';
  function flyTo(name, ms) {
    const all = views(), v = all[name] || all.overview;
    viewName = all[name] ? name : 'overview';
    if (reduced || ms === 0) {
      camera.position.copy(v.p); controls.target.copy(v.t); camera.fov = v.f; camera.updateProjectionMatrix();
      tween = null; controls.update(); dirty = true; return;
    }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, v, s: performance.now(), ms: ms || 650 };
  }
  function stepTween(now) {
    const k = Math.min(1, (now - tween.s) / tween.ms), e = easeOut(k);
    camera.position.lerpVectors(tween.p0, tween.v.p, e);
    controls.target.lerpVectors(tween.t0, tween.v.t, e);
    camera.fov = tween.f0 + (tween.v.f - tween.f0) * e;
    camera.updateProjectionMatrix();
    if (k >= 1) tween = null;
  }
  controls.addEventListener('start', () => { tween = null; if (opt.onMove) opt.onMove(); });

  /* ---------- render loop: draws only when something changed ---------- */
  function render() { fitDepth(); cutaway(); composer.render(); }
  // keep it smooth on slower machines: if frames drag while the picture is moving, drop the corner-shadow pass,
  // then the resolution. Checked on real frame times, so a fast machine keeps everything.
  let first = true, lastFrame = 0, slow = 0, fastRun = 0, level = 0;
  function pace(now, busy) {
    const dt = now - lastFrame;
    lastFrame = now;
    if (opt.fixedQuality || !busy || dt > 3000) { fastRun = 0; return; }          // idle, or the tab was away
    if (dt > 50) { slow++; fastRun = 0; } else if (++fastRun > 30) slow = Math.max(0, slow - 1);
    if (slow < (dt > 250 ? 3 : 8) || level >= 2) return;      // very slow frames need less proof
    slow = 0; level++;
    if (level === 1 && gtao) gtao.enabled = false;
    else { level = 2; if (gtao) gtao.enabled = false; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1)); resize(); }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!active || !built) return;
    if (anims.size) { stepAnims(now); dirty = true; }
    if (tween) stepTween(now);
    // inside the room you can look up at the ceiling and the rain shower; from outside the camera stays above the floor
    controls.maxPolarAngle = isInside ? Math.PI * 0.64 : Math.PI * 0.49;
    const moved = controls.update();
    const busy = moved || !!tween || anims.size > 0;
    if (busy || dirty) {
      dirty = false;
      render();
      pace(now, busy);
      if (first) { first = false; if (opt.onFirstFrame) opt.onFirstFrame(); }
    } else lastFrame = now;
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
  new ResizeObserver(resize).observe(host);
  resize();
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { active = es[0].isIntersecting && !document.hidden; dirty = true; }).observe(host);
  document.addEventListener('visibilitychange', () => { active = !document.hidden; dirty = true; });

  /* ---------- public api ---------- */
  let ready;
  const api = {
    set(s) {
      st = JSON.parse(JSON.stringify(s));
      const p = finishes();
      queueBuild();
      if (!ready) ready = p;
      return p;
    },
    view(name, ms) { flyTo(name, ms); },
    hasView(name) { return !!(P && views()[name]); },
    get viewName() { return viewName; },
    mood(on) {
      const to = on ? 1 : 0, from = LIGHT.mood;
      if (to === from) return;
      if (!introDone || reduced) { LIGHT.mood = to; applyLight(); queueEnv(); return; }
      anim(420, (k) => { LIGHT.mood = from + (to - from) * easeOut(k); applyLight(); });
      envAfter = true;
    },
    // first showing: photograph the room for its reflections, then frame it
    intro() {
      captureEnv();
      introDone = true;
      flyTo('overview', 0);
      dirty = true;
    },
    snapshot() { render(); return renderer.domElement; },
    ready() { return ready || Promise.resolve(); }
  };
  function shot(name) {
    const { W, L, xv, sw, sd, xs, fx0, fx1, fz0, fz1, bx, bz } = P, z0 = -L / 2, cx = W / 2 - sw / 2;
    const sx = (fx0 + fx1) / 2, sz = (fz0 + fz1) / 2;
    const F = {
      tap: [[xv + 0.3, 1.16, z0 + 0.62], [xv + 0.02, 1.02, z0 + 0.1], 34],
      basin: [[xv + 0.12, 1.55, z0 + 1.05], [xv, 0.86, z0 + 0.27], 42],
      vanity: [[xv + 0.35, 1.25, z0 + 1.75], [xv, 0.7, z0 + 0.25], 40],
      mirror: [[xv + 0.15, 1.42, z0 + 2.0], [xv, 1.45, z0], 40],
      screen: [[xs - 1.7, 1.2, z0 + sd / 2 + 0.75], [xs, 1.0, z0 + sd / 2], 50],
      rain: [[cx - 0.4, 1.5, z0 + 1.05], [cx, 2.05, z0 + 0.36], 44],
      bench: [[cx - 0.55, 1.15, z0 + 1.7], [cx, 0.38, z0 + 0.2], 44],
      niche: [[cx - 0.25, 1.32, z0 + 1.35], [cx, 1.25, z0], 38],
      plinth: [[xv + 0.35, 0.95, z0 + 1.7], [xv, 0.35, z0 + 0.3], 46],
      cove: [[0.25, 1.35, L / 2 - 0.25], [-0.2, 1.95, z0], 62],
      star: [[sx + 0.05, 1.75, sz + 1.0], [sx, 0, sz], 42],
      border: [[sx + 0.1, 2.25, sz + 1.6], [sx, 0, sz], 52],
      rail: [[-W / 2 + 1.45, 1.35, L / 2 - 0.45], [-W / 2, 1.15, L / 2 - 0.62], 42],
      floor: [[0.0, 2.2, 0.45], [0.0, 0, 0.1], 58],
      bath: [[bx - 1.3, 1.5, bz + 1.0], [bx, 0.4, bz], 48],
      tall: [[-W / 2 + 1.5, 1.5, P.zt + 0.35], [-W / 2, 1.62, P.zt], 40]
    };
    if (F[name]) { const f = F[name]; tween = null; isInside = true; controls.maxPolarAngle = Math.PI * 0.64; camera.position.set(...f[0]); controls.target.set(...f[1]); camera.fov = f[2]; camera.updateProjectionMatrix(); controls.update(); }
    else flyTo(name, 0);
    dirty = true;
  }
  if (opt.debug) window.__studio = { info: () => ({ geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, prog: renderer.info.programs.length, parts: parts.size, anims: anims.size, glows: glows.size, room: room.children.length, sceneKids: scene.children.length, level, calls: renderer.info.render.calls, dpr: renderer.getPixelRatio(), list: Array.from(parts.values()).map((q) => q.key + ':' + (q.g.visible ? 'v' : 'h')).join(' ') }), shot };
  requestAnimationFrame(loop);
  return api;
}
