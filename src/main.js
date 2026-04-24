import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Pane } from 'tweakpane';
import { Router, parsePath, framePath } from './router.js';
import { forwardSplice, reverseSplice, directLoadDetail, simpleReverse } from './transition.js';

const IMAGE_COUNT = 25;
const ATLAS_COLS = 5;
const ATLAS_ROWS = 5;
const IMAGE_PATHS = Array.from({ length: IMAGE_COUNT }, (_, i) => `/images/slide-${i + 1}.avif`);
const FOV = 50;
const CAMERA_Z = 5;

// Sequenced for contrast — alternating bright/dark, group/solo, chaos/calm
// Titles per slide — dark-humor editorial
const TITLES = [
  'Please<br/>Don\'t Vomit',     // slide-1: rollercoaster + cotton candy
  'Cult<br/>Starter Pack',       // slide-2: red moon, desert, brass bowls
  'Return<br/>to Sender',        // slide-3: tennis balls flying back at you
  'Unsubscribed',                // slide-4: samurai at shrine. opted out.
  'Nobody<br/>Asked',            // slide-5: 3 girls w/ popcorn, main character energy
  'Last Supper<br/>(Casual)',    // slide-6: pizza under Saturn rings
  'Read Receipts<br/>Off',       // slide-7: girl solo, palm tree, aloof
  'Wrong<br/>Platform',          // slide-8: subway platform, alone (dating + transit)
  'Emotional<br/>Support Donut', // slide-9: blonde w/ donut, retro comfort
  'Bad<br/>Hand',                // slide-10: moonlit card game
  'Worth<br/>the Cramps',        // slide-11: couple w/ ice cream, messy, committed
  'Rent Is<br/>Overdue',         // slide-12: Paris café dusk
  'Trust Fund<br/>Puppy',        // slide-13: dog reading in bathtub
  'Stop<br/>Calling',            // slide-14: orange phone, donuts, red eye
  'Add<br/>to Cart',             // slide-15: shopping cart of tennis balls
  'They<br/>Bite',               // slide-16: pink Ferrari + dogs
  'Check Your<br/>Privilege',    // slide-17: chess in fur coat (double meaning)
  'Post-Wedding<br/>Uber',       // slide-18: pink moon over city, family
  'Same<br/>Therapist',          // slide-19: two girls, matching energy
  'My SoundCloud<br/>Era',       // slide-20: DJs w/ fans
  '9 Lives,<br/>1 Outfit',       // slide-21: cat in red puffer + lollipop
  'Higher<br/>Ground',           // slide-22: chess on mountain
  'No One<br/>Tipped',           // slide-23: 4 guys overhead w/ pizza
  'He Left,<br/>I Kept It',      // slide-24: girl w/ pizza in bed
  'Still<br/>in Beta',           // slide-25: synth studio, never shipping
];


// ── Per-frame signatures — the data behind the instrument panel ──
// Each frame has a deterministic fingerprint of AI-generation parameters
// (stylize, chaos, weight, temperature, saturation, seed). Values stay the
// same across reloads (seeded from the frame index) so scrubbing feels
// reproducible. These drive the radar polygon + readout rows.
function _sigHash(i, salt) {
  const x = Math.sin(i * 9301 + salt * 49297) * 43758.5453;
  return x - Math.floor(x);
}
const SIGNATURES = Array.from({ length: IMAGE_COUNT }, (_, i) => {
  const h1 = _sigHash(i, 1);
  const h2 = _sigHash(i, 2);
  const h3 = _sigHash(i, 3);
  const h4 = _sigHash(i, 4);
  const h5 = _sigHash(i, 5);
  const h6 = _sigHash(i, 6);
  return {
    stylize: Math.round(40 + h1 * 960),           // 40–1000
    chaos:   Math.round(h2 * 85),                 // 0–85
    weight:  +(0.35 + h3 * 1.55).toFixed(2),      // 0.35–1.90
    temp:    Math.round(2400 + h4 * 7600),        // 2400–10000 K
    sat:     Math.round(18 + h5 * 78),            // 18–96 %
    seed:    Math.floor(100000 + h6 * 9899999),   // 6–7 digits
  };
});
// Per-frame axis mapping (normalized 0–1) — drives the radar polygon.
const SIG_AXES = SIGNATURES.map(s => [
  s.stylize / 1000,
  s.chaos / 100,
  s.weight / 2,
  (s.temp - 2000) / 8000,
  s.sat / 100,
  (s.seed % 1000) / 1000,
]);

// Deterministic-but-varied per-frame camera metadata — feels like real EXIF.
function techMetaFor(i) {
  const isos = [200, 400, 800, 100, 1600, 320];
  const aps  = ['f/2.8', 'f/4',  'f/2',  'f/5.6', 'f/1.4', 'f/2.8'];
  const shs  = ['1/60', '1/125', '1/250', '1/500', '1/1000', '1/60'];
  const evs  = ['−0.3',  '0',    '+0.7', '−1.3',  '−0.7',  '+0.3'];
  const k = i % isos.length;
  return { iso: isos[k], ap: aps[k], sh: shs[k], ev: evs[k] };
}

function buildFrameState() {
  return {
    titles: TITLES,
    signatures: SIGNATURES,
    tech: Array.from({ length: IMAGE_COUNT }, (_, i) => techMetaFor(i)),
    imagePaths: IMAGE_PATHS,
  };
}

// Viewport-adaptive strip params. Called at boot + on every resize.
function responsiveStripParams() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = h > w;
  if (w <= 480) {
    return {
      stripWidth: portrait ? 0.72 : 0.38,
      stripHeight: portrait ? 3.6 : 2.2,
      wrapAngle: portrait ? 3.2 : 4.4,
      grainAmount: 0.05,
      sprocketsPerImage: portrait ? 2 : 3,
    };
  }
  if (w <= 900) {
    return {
      stripWidth: portrait ? 0.52 : 0.40,
      stripHeight: portrait ? 3.2 : 2.6,
      wrapAngle: 3.8,
      grainAmount: 0.08,
      sprocketsPerImage: 3,
    };
  }
  return { stripWidth: 0.32, stripHeight: 2.8, wrapAngle: 4.4, grainAmount: 0.09, sprocketsPerImage: 3 };
}

const params = {
  stripWidth: 0.32,
  stripHeight: 2.8,
  wrapAngle: 4.4,
  bendSensitivity: 2,
  bendSmoothing: 0.04,
  scrollSpeed: 0.009,
  scrollSmoothing: 0.051,
  snapStrength: 0.048,
  snapThreshold: 0.09,
  filmStrength: 0.85,       // film grade on scroll (slightly pulled back)
  filmBaseStrength: 0.08,   // subtle film hint at rest
  grainAmount: 0.09,        // present but not noisy
  // Image look — a gentle editorial polish at rest
  exposure: 1.02,           // slight overall lift
  brightness: 0.0,
  contrast: 1.1,            // subtle S-curve punch
  saturation: 1.08,         // gentle vibrance
  vignetteStrength: 0.22,
  shadeExponent: 2.0,
  borderWidth: 0.04,
  sprocketsPerImage: 3,
  // Focus differential — centered frame stays bright, neighbors dim/desaturate.
  // Acts as the selection marker without any DOM overlay.
  focusStrength: 0.75,
};

// ── Shaders ──

const vertexShader = /* glsl */ `
uniform float uBend;
uniform float uRadius;
varying vec2 vUv;
varying float vNDotV;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Primary: vertical wheel
  float angleV = pos.y / uRadius;
  pos.y = mix(pos.y, uRadius * sin(angleV), uBend);

  // Remove horizontal barrel: film only bends along one axis when tightly wrapped on a cylinder.
  // The horizontal barrel made it look pinched and balloon-like at the edges.
  pos.z = mix(0.0, uRadius * (cos(angleV) - 1.0), uBend);

  vNDotV = cos(mix(0.0, angleV, uBend));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAtlas;
uniform float uAtlasCols; // e.g. 5 for a 5×5 grid
uniform float uAtlasRows;
uniform float uProgress, uBend, uSlotH, uFilmStrength, uFilmBase;
uniform float uShadeExponent, uTime, uGrain, uBorderW, uSprockets, uShutter;
uniform float uExposure, uBrightness, uContrast, uSaturation, uVignette;
uniform float uFocusStrength;
varying vec2 vUv;
varying float vNDotV;

// Sample the i-th cell of a uniform grid atlas at local UV.
vec4 sampleImage(int i, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  float fi = float(i);
  float col = mod(fi, uAtlasCols);
  float row = floor(fi / uAtlasCols);
  // Clamp UV slightly inside the cell to prevent bilinear bleed from neighbors
  vec2 clamped = clamp(uv, vec2(0.001), vec2(0.999));
  vec2 cellUV = (vec2(col, row) + clamped) / vec2(uAtlasCols, uAtlasRows);
  return texture2D(uAtlas, cellUV);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float hash1(float x) { return fract(sin(x * 12.9898) * 43758.5453); }

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) - r;
}


vec3 filmGrade(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float s = l * l * (3.0 - 2.0 * l);
  return mix(
    vec3(mix(0.13,0.94,pow(s,0.78)), mix(0.08,0.84,pow(s,0.86)), mix(0.04,0.48,pow(s,1.20))),
    c * vec3(0.95, 0.80, 0.58), 0.2
  );
}

// ─── Film imperfections ───
float dust(vec2 uv, float s) {
  vec2 fp = vec2(uv.x, uv.y + s);
  vec2 cell = floor(fp * vec2(180.0, 300.0));
  vec2 f = fract(fp * vec2(180.0, 300.0)) - 0.5;
  float h = hash(cell);
  if (h < 0.988) return 0.0;
  float r = 0.15 + 0.25 * hash(cell + 7.0);
  return smoothstep(r, 0.0, length(f)) * (0.5 + 0.4 * hash(cell + 3.0));
}

float hair(vec2 uv, float s) {
  float seg = floor(s * 0.6);
  if (hash1(seg) < 0.90) return 0.0;
  float y0 = hash1(seg + 1.3);
  float x0 = hash1(seg + 2.7);
  float rot = (hash1(seg + 4.1) - 0.5) * 2.5;
  vec2 p = vec2(uv.x - x0, uv.y + s - y0 - floor(s));
  float curve = p.x - 0.04 * sin(p.y * 18.0 + rot * 6.0) - rot * p.y;
  float len = smoothstep(0.12, 0.08, abs(p.y));
  return smoothstep(0.003, 0.0, abs(curve)) * len;
}

float scratches(vec2 uv, float s) {
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float speed = fi == 0.0 ? 0.02 : (fi == 1.0 ? 0.15 : 0.6);
    float col = floor(hash1(fi * 11.0) * 40.0 + uv.x * 120.0 + s * speed * 30.0);
    float seed = hash1(col + fi * 17.0);
    if (seed < 0.94) continue;
    float jitter = (hash1(col * 3.1) - 0.5) * 0.0008;
    float d = abs(fract(uv.x * 120.0) - 0.5 + jitter);
    total += smoothstep(0.02, 0.0, d) * (0.12 + 0.2 * seed);
  }
  return total;
}

vec3 lightLeak(vec2 uv, float t) {
  float bucket = floor(t * 0.12);
  float life = fract(t * 0.12);
  float env = smoothstep(0.0, 0.3, life) * smoothstep(1.0, 0.7, life);
  if (hash1(bucket) < 0.55) return vec3(0.0);
  vec2 c = vec2(hash1(bucket + 1.3), hash1(bucket + 9.7));
  float r = 0.25 + 0.18 * hash1(bucket + 2.1);
  float falloff = smoothstep(r, 0.0, length(uv - c));
  vec3 warm = vec3(0.85, 0.55, 0.28);
  return warm * falloff * env * 0.08;
}

vec3 dyeShift(vec3 c, float frameIdx) {
  float h = hash1(frameIdx) * 2.0 - 1.0;
  vec3 tint = vec3(
    1.0 + h * 0.04,
    1.0 + (hash1(frameIdx + 1.1) - 0.5) * 0.03,
    1.0 - h * 0.05
  );
  float lift = (hash1(frameIdx + 3.7) - 0.5) * 0.025;
  float gain = 1.0 + (hash1(frameIdx + 5.2) - 0.5) * 0.05;
  return clamp((c + lift) * gain * tint, 0.0, 1.0);
}

void main() {
  float numSlots = 1.0 / uSlotH;
  float scrollV = (1.0 - vUv.y) * numSlots + uProgress - numSlots * 0.5 + 0.5;
  float facing = max(vNDotV, 0.0);
  float cylShade = mix(1.0, pow(facing, uShadeExponent), uBend);
  float alpha = mix(1.0, smoothstep(0.0, 0.12, facing), uBend);
  float grain = hash(vUv * 420.0 + fract(uTime * 7.0)) * uGrain;

  float bw = uBorderW;
  if (vUv.x < bw || vUv.x > 1.0 - bw) {
    // Warm film-base — real negative stock has a slight magenta/brown cast,
    // not neutral gray. Lifted above the page bg-dark (#141414 ≈ 0.078) so
    // the strip reads clearly against the dark cinema background.
    vec3 base = vec3(0.125, 0.108, 0.115);
    // Emulsion noise — very subtle, directional (horizontal streaks mimic
    // film grain on the unexposed base).
    float emul = hash(vec2(vUv.x * 120.0, floor(vUv.y * 900.0))) - 0.5;
    base += emul * 0.018;

    float bs = (1.0 - vUv.y) * numSlots
      + uProgress * (vUv.x < 0.5 ? 1.12 : 0.88) - numSlots * 0.5 + 0.5;
    float hs = 1.0 / uSprockets;
    float dy = mod(bs + hs*0.5, hs) - hs*0.5;
    float bc = vUv.x < 0.5 ? bw*0.5 : 1.0-bw*0.5;
    float nx = (vUv.x-bc)/(bw*0.42);
    float ca = bw/(hs*uSlotH);
    vec2 hp = vec2(nx, (dy/hs)*2.0/max(ca,0.1));

    // Pixel-accurate AA on the sprocket hole edge via fwidth — replaces the
    // hard smoothstep band that was aliasing at small render sizes.
    float sd = sdRoundBox(hp, vec2(0.52, 0.45), 0.18);
    float aa = fwidth(sd) * 1.2;
    float hole = 1.0 - smoothstep(-aa, aa, sd);

    // Inner rim: 1px brighter ring just outside the hole, like light
    // catching the punched edge of the film.
    float rim = smoothstep(aa, aa + fwidth(sd) * 2.5, sd) *
                (1.0 - smoothstep(aa + fwidth(sd) * 2.5, aa + fwidth(sd) * 5.5, sd));

    // Edge-code mark between sprocket holes — softened, monochrome, faint.
    // Replaces the harsh green step() cross that read as vector-art, not
    // film. Now a thin horizontal dash like a DX code bar.
    float mdy = mod(bs, hs) - hs * 0.5;
    float dashX = smoothstep(0.22, 0.18, abs(nx));
    float dashY = smoothstep(0.06, 0.03, abs((mdy/hs) * 2.0 / max(ca, 0.1)));
    float edgeMark = dashX * dashY * 0.35;

    vec3 col = base + vec3(0.08) * edgeMark + vec3(0.09, 0.085, 0.08) * rim * 0.4;
    col = col * cylShade + grain - uGrain * 0.5;
    gl_FragColor = vec4(col, alpha * (1.0 - hole));
    return;
  }

  // Thin frame-line hairline separating the image area from the sprocket
  // border — a detail real 35mm has at the perforation edge. Faint cream.
  float edgeDist = min(vUv.x - bw, (1.0 - bw) - vUv.x);
  float edgeAA = fwidth(edgeDist);
  float frameLine = (1.0 - smoothstep(edgeAA * 0.5, edgeAA * 1.5, edgeDist)) * 0.22;

  float u = (vUv.x-bw)/(1.0-2.0*bw);
  float w = mod(scrollV, 25.0);
  int idx = int(floor(w));
  float lv = fract(w);

  // With flipY=false on the atlas, canvas y=0 (image top) maps to UV.y=0.
  // On the strip, lv=0 is the upper part of the visible slot — so pass lv directly.
  vec4 color = sampleImage(idx, vec2(u, lv));

  // ── Image look adjustments (GUI-controlled) ──
  color.rgb *= uExposure;                                  // exposure (linear gain)
  color.rgb += uBrightness;                                // brightness (additive)
  color.rgb = (color.rgb - 0.5) * uContrast + 0.5;         // contrast around 0.5
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));  // saturation toward luma
  color.rgb = mix(vec3(luma), color.rgb, uSaturation);

  // ── Focus differential: the centered frame reads as "lit", neighbors
  //    pull back ~1 stop, desaturate, and carry more grain. Drives the
  //    "selection marker" without any DOM overlay.
  //    Falloff is tight around the slot boundary (distSlots = 0.5), since
  //    at rest only ~1.77 slots are visible vertically — so the effect has
  //    to punch inside the centered frame's own footprint to read.
  //    Dampened during scroll (cylShade already handles off-axis darkening).
  float distSlots = abs(vUv.y - 0.5) / uSlotH;
  float focusMask = 1.0 - smoothstep(0.3, 0.7, distSlots);
  float focus = mix(1.0, focusMask, uFocusStrength * (1.0 - uBend * 0.7));
  color.rgb *= mix(0.48, 1.0, focus);                      // exposure pull (~-1.1 stops)
  float fLuma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(color.rgb, vec3(fLuma), (1.0 - focus) * 0.35);  // desat

  // Film grade intensifies with scroll velocity
  color.rgb = mix(color.rgb, filmGrade(color.rgb), mix(uFilmBase, uFilmStrength, uBend));
  color.rgb *= cylShade;
  color.rgb += (grain - uGrain * 0.5) * mix(2.0, 1.0, focus);

  float vx = smoothstep(0.0,0.06,u)*smoothstep(1.0,0.94,u);
  float vy = smoothstep(0.0,0.04,lv)*smoothstep(1.0,0.96,lv);
  color.rgb *= mix(1.0, vx*vy, uVignette);

  // Faint cream frame-line at the image/sprocket boundary — reads as the
  // gelatin edge catching light. One hairline, AA-clean.
  color.rgb = mix(color.rgb, vec3(0.92, 0.88, 0.78), frameLine);

  gl_FragColor = vec4(color.rgb, alpha);
}
`;

// ── Audio ──

class AudioKit {
  constructor() {
    this.click = new Audio('/audio/projector-click.mp3');
    this.click.volume = 0.3;
    this.muted = false;
    this.unlocked = false;
  }

  // Call on first user gesture to satisfy browser autoplay policy.
  // No looping audio — just clicks.
  unlock() { this.unlocked = true; }

  start() { this.unlock(); } // alias for existing call sites

  snap() {
    if (!this.unlocked || this.muted) return;
    this.click.currentTime = 0;
    this.click.play().catch(() => {});
  }

  setActivity() { /* no-op — no ambient loops */ }
}

// ── App ──

class WheelSlider {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.titleEl = document.getElementById('slide-title');
    this.viewfinderEl = document.getElementById('viewfinder');
    // Instrument panel DOM
    this.instr = {
      index:   document.getElementById('instrument-index'),
      radar:   document.getElementById('radar-data'),
      points:  document.getElementById('radar-points'),
      stylize: document.getElementById('rd-stylize'),
      chaos:   document.getElementById('rd-chaos'),
      weight:  document.getElementById('rd-weight'),
      temp:    document.getElementById('rd-temp'),
      sat:     document.getElementById('rd-sat'),
      seed:    document.getElementById('rd-seed'),
      barStylize: document.getElementById('bar-stylize'),
      barChaos:   document.getElementById('bar-chaos'),
      barWeight:  document.getElementById('bar-weight'),
      barTemp:    document.getElementById('bar-temp'),
      barSat:     document.getElementById('bar-sat'),
    };
    // Interpolated display state — GSAP tweens into these on frame change.
    this.instrState = { a0: 0, a1: 0, a2: 0, a3: 0, a4: 0, a5: 0,
                        stylize: 0, chaos: 0, weight: 0, temp: 0, sat: 0 };
    // Hero tech annotations
    this.techIdxEl = document.getElementById('hero-tech-idx');
    this.techIsoEl = document.getElementById('hero-tech-iso');
    this.techApEl  = document.getElementById('hero-tech-ap');
    this.techShEl  = document.getElementById('hero-tech-sh');
    this.techEvEl  = document.getElementById('hero-tech-ev');
    this.techPhiEl = document.getElementById('hero-tech-phi');

    this.scroll = 0;
    this.scrollTarget = 0; // free-running float — no snap; arrows re-integer it
    this.smoothBend = 0;
    this.dragging = false;
    this.introBend = 1;   // 1 = fully cylinder at start
    this.spliceBend = 0;  // 0 at rest; splice transition tweens toward 1
    this.introActive = true;
    this.frame = 0;
    this.lastTooth = 0;
    this.shutterFlash = 0;
    this.lastInputTime = 0;
    // Cursor parallax state
    this.mouseX = 0; this.mouseY = 0;
    this.parallaxX = 0; this.parallaxY = 0;
    this.peekOpen = false;
    this._snapTween = null;
    this.startTime = performance.now();
    this.audio = new AudioKit();
    this.loadPct = 0;

    // Apply viewport-adaptive defaults before creating geometry/camera
    Object.assign(params, responsiveStripParams());
    this._syncViewfinderSize();
    this.initScene();
    // Wait for textures + loader + the serif font (canvas needs it for crisp text)
    Promise.all([
      this.loadTextures(),
      this._runLoader(),
      document.fonts.load('400 400px "Bulevar"').catch(() => {}),
    ]).then(() => {
      this.createStrip();
      this._createAsciiBg();
      this._createBgCircle();
      this._createGridPlane();
      this._createTextPlane();
      this._buildRadar();
      this.listen();
      this.initGUI();
      this.loop();
      this.enter();
    });
  }

  initScene() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100);
    this.camera.position.z = CAMERA_Z;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // LinearSRGBColorSpace output = no encoding at framebuffer write.
    // Paired with texture.colorSpace=NoColorSpace above: sRGB data flows
    // unmodified from canvas → GPU → screen.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setSize(w, h);
    // Cap DPR lower on small phones for performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 480 ? 1.5 : 2));
    // Explicit z-index above the ASCII backdrop canvas so the film strip
    // always renders on top of the telemetry rail.
    this.renderer.domElement.style.position = 'relative';
    this.renderer.domElement.style.zIndex = '1';
    this.container.appendChild(this.renderer.domElement);
  }

  viewport() {
    const h = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 2;
    return { w: h * this.camera.aspect, h };
  }


  async loadTextures() {
    // Load all 25 as ImageBitmaps (preserves source colorspace, no sRGB clipping),
    // then pack into a single 5×5 atlas texture at native resolution.
    // WebGL has MAX_TEXTURE_IMAGE_UNITS limits (≥16) — a single atlas sidesteps them.
    let done = 0;
    const mark = () => { done++; this.loadPct = done / IMAGE_PATHS.length; };

    const bitmaps = await Promise.all(IMAGE_PATHS.map(async src => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const bm = await createImageBitmap(blob, {
          // 'default' = browser honors the source ICC profile (AVIFs often
          // ship in P3). 'none' drops the profile and reinterprets as sRGB,
          // which visibly darkens wide-gamut images.
          colorSpaceConversion: 'default',
          imageOrientation: 'from-image',
          premultiplyAlpha: 'default',
        });
        mark();
        return bm;
      } catch (e) {
        mark();
        return null;
      }
    }));

    // Use native resolution (1024) so no downscale-softening
    const CELL = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = CELL * ATLAS_COLS;
    canvas.height = CELL * ATLAS_ROWS;
    // Explicit sRGB ctx — avoids any implicit color profile conversion
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    bitmaps.forEach((bm, i) => {
      if (!bm) return;
      const c = i % ATLAS_COLS;
      const r = Math.floor(i / ATLAS_COLS);
      ctx.drawImage(bm, c * CELL, r * CELL, CELL, CELL);
    });

    this.atlas = new THREE.CanvasTexture(canvas);
    // flipY=true (the Three.js default) inverts row 0 ↔ row 4 during upload,
    // so sampling cell (col,0) returned bitmap content from cell (col,4) —
    // images were 20 indices off. Keep canvas orientation as drawn.
    this.atlas.flipY = false;
    this.atlas.minFilter = THREE.LinearFilter;
    this.atlas.magFilter = THREE.LinearFilter;
    this.atlas.generateMipmaps = false;
    // NoColorSpace = no auto-decode on sample. Custom ShaderMaterial doesn't
    // auto re-encode at output, so we keep values flowing through as-is.
    // This preserves the sRGB-correct canvas data end-to-end.
    this.atlas.colorSpace = THREE.NoColorSpace;
    this.atlas.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.images = bitmaps;

    // Precompute a vibrant dominant color per frame, used as the tint for
    // the ASCII backdrop so each frame has its own signature palette
    // (blue for the night-Paris frame, red for the rollercoaster, etc.)
    // without making the image recognizable. Averages each bitmap at 16px
    // then pushes saturation away from its own luminance for punch.
    const small = document.createElement('canvas');
    small.width = 20;
    small.height = 20;
    const sctx = small.getContext('2d');
    this._asciiTints = new Array(IMAGE_COUNT);
    for (let i = 0; i < IMAGE_COUNT; i++) {
      const bm = bitmaps[i];
      if (!bm) { this._asciiTints[i] = new THREE.Vector3(0.6, 0.55, 0.5); continue; }
      sctx.clearRect(0, 0, 20, 20);
      sctx.drawImage(bm, 0, 0, 20, 20);
      const data = sctx.getImageData(0, 0, 20, 20).data;
      let r = 0, g = 0, b = 0;
      const pixels = data.length / 4;
      for (let p = 0; p < data.length; p += 4) {
        r += data[p]; g += data[p + 1]; b += data[p + 2];
      }
      r /= pixels; g /= pixels; b /= pixels;
      // Push chroma away from luminance gray for vibrancy.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const boost = 1.85;
      r = Math.max(0, Math.min(255, lum + (r - lum) * boost));
      g = Math.max(0, Math.min(255, lum + (g - lum) * boost));
      b = Math.max(0, Math.min(255, lum + (b - lum) * boost));
      this._asciiTints[i] = new THREE.Vector3(r / 255, g / 255, b / 255);
    }
  }

  createStrip() {
    const vp = this.viewport();
    const imgW = vp.w * params.stripWidth;
    const pw = imgW / (1 - 2 * params.borderWidth);
    const ph = vp.h * params.stripHeight;

    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      transparent: true, side: THREE.FrontSide,
      uniforms: {
        uAtlas: { value: this.atlas },
        uAtlasCols: { value: ATLAS_COLS },
        uAtlasRows: { value: ATLAS_ROWS },
        uProgress: { value: 0 }, uBend: { value: 0 },
        uRadius: { value: ph / params.wrapAngle },
        uSlotH: { value: imgW / ph },
        uFilmStrength: { value: params.filmStrength },
        uFilmBase: { value: params.filmBaseStrength },
        uShadeExponent: { value: params.shadeExponent },
        uTime: { value: 0 }, uGrain: { value: params.grainAmount },
        uBorderW: { value: params.borderWidth },
        uSprockets: { value: params.sprocketsPerImage },
        uShutter: { value: 0 },
        uExposure: { value: params.exposure },
        uBrightness: { value: params.brightness },
        uContrast: { value: params.contrast },
        uSaturation: { value: params.saturation },
        uVignette: { value: params.vignetteStrength },
        uFocusStrength: { value: params.focusStrength },
      },
    });

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph, 32, 164),
      this.material
    );
    // Fully offscreen below — enter() rises it into the silhouette position
    // (-vp.h * 0.7) right after the loader fades, then later to center.
    this.mesh.position.y = -vp.h * 1.6;
    this.scene.add(this.mesh);
  }

  listen() {
    // ── Wheel: Codrops-idiomatic — normalize delta, push target directly,
    // let the loop's lerp do smoothing, snap to nearest frame 180ms after the
    // last wheel event. No momentum variable, no per-event clamp.
    const normalizeWheel = (e) => {
      let py = e.deltaY;
      if (e.deltaMode === 1) py *= 16;              // LINE mode (Firefox)
      else if (e.deltaMode === 2) py *= window.innerHeight; // PAGE mode
      return py;
    };

    // Wheel: free fractional flow + velocity tracking for predictive landing.
    // scrollTarget grows as the user scrolls; _wheelVel tracks the rate of
    // that growth (scroll units per ms). The loop combines the two to
    // predict the integer the motion would naturally settle on, and a weak
    // magnet pulls toward that prediction — so hard flicks land far ahead
    // and soft scrolls land on the nearest frame. All continuous, no snap.
    this._wheelVel = 0;
    this._wheelLastTime = 0;
    window.addEventListener('wheel', e => {
      if (this.introActive || this.peekOpen) return;
      this.audio.start();
      const now = performance.now();
      const dt = Math.max(now - this._wheelLastTime, 8);
      this._wheelLastTime = now;
      const pY = normalizeWheel(e);
      const delta = pY * 0.00225;
      this.scrollTarget += delta;
      // Velocity in scroll-units per ms, quick EMA so fresh events dominate.
      const instVel = delta / dt;
      this._wheelVel = this._wheelVel * 0.5 + instVel * 0.5;
      this.lastInputTime = now;
    }, { passive: true });

    // ── Pointer drag — free-scroll, fractional target, lerp glides. No snap. ──
    let lastY = 0;

    const startDrag = (y) => {
      if (this.introActive || this.peekOpen) return;
      this.audio.start();
      this.dragging = true;
      lastY = y;
      document.body.style.cursor = 'grabbing';
    };

    // Drag: fractional during drag, free-flows on release. The continuous
    // magnet in the loop pulls scrollTarget to the nearest integer once
    // the motion decays — no release-snap, no discrete commit.
    const moveDrag = (y) => {
      if (!this.dragging) return;
      const dy = lastY - y;
      this.scrollTarget += dy * 0.0055;
      this.lastInputTime = performance.now();
      lastY = y;
    };

    const endDrag = () => {
      if (!this.dragging) return;
      this.dragging = false;
      document.body.style.cursor = '';
    };

    // Distinguish click from drag — threshold tracking
    let downY = 0, downX = 0, downT = 0;
    window.addEventListener('pointerdown', e => {
      downY = e.clientY; downX = e.clientX; downT = performance.now();
      startDrag(e.clientY);
    });
    // Raycaster for click→slot lookup
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    window.addEventListener('pointerup', e => {
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      const dt = performance.now() - downT;
      // If barely moved + quick: treat as click → open peek on THE clicked image
      // Looser threshold accommodates finger taps (bigger contact area, slight jitter)
      if (dx < 10 && dy < 10 && dt < 450 && !this.peekOpen && !this.introActive) {
        const tgt = e.target;
        if (!tgt || tgt.tagName !== 'CANVAS' || !this.mesh) return;

        // Raycast into the strip to find which UV the click hit
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, this.camera);
        const hits = raycaster.intersectObject(this.mesh);
        if (!hits.length || !hits[0].uv) return;

        const uv = hits[0].uv;

        // Skip clicks on the sprocket borders (sides of the strip)
        if (uv.x < params.borderWidth || uv.x > 1 - params.borderWidth) return;

        // Mirror the fragment shader's slot math to find the clicked image index
        const numSlots = 1 / this.material.uniforms.uSlotH.value;
        const scrollV = (1 - uv.y) * numSlots + this.scroll - numSlots * 0.5 + 0.5;
        const wrapped = ((scrollV % IMAGE_COUNT) + IMAGE_COUNT) % IMAGE_COUNT;
        const f = Math.floor(wrapped) % IMAGE_COUNT;

        if (this.onFrameClick) this.onFrameClick(f);
      }
    });
    window.addEventListener('pointermove', e => {
      moveDrag(e.clientY);
      // Track mouse for parallax — normalized -1..1
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Escape returns to home when on a detail route
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.peekOpen) {
        history.back();
      }
    });

    const onResize = () => {
      // Re-apply viewport-adaptive params
      Object.assign(params, responsiveStripParams());
    this._syncViewfinderSize();

      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 480 ? 1.5 : 2));

      const vp = this.viewport();
      const imgW = vp.w * params.stripWidth;
      const pw = imgW / (1 - 2 * params.borderWidth);
      const ph = vp.h * params.stripHeight;
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(pw, ph, 32, 164);
      this.material.uniforms.uRadius.value = ph / params.wrapAngle;
      this.material.uniforms.uSlotH.value = imgW / ph;

      // Resize the contact-sheet grid to the new viewport
      if (this.gridMesh) {
        const z = -2;
        const dist = CAMERA_Z - z;
        const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const visW = visH * this.camera.aspect;
        this.gridMesh.geometry.dispose();
        this.gridMesh.geometry = new THREE.PlaneGeometry(visW, visH);
        this.gridMaterial.uniforms.uResolution.value.set(w, h);
      }
      // Resize the ASCII image plane
      if (this.asciiMesh) {
        const z = -2.5;
        const dist = CAMERA_Z - z;
        const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const visW = visH * this.camera.aspect;
        this.asciiMesh.geometry.dispose();
        this.asciiMesh.geometry = new THREE.PlaneGeometry(visW, visH);
        this.asciiMaterial.uniforms.uResolution.value.set(w, h);
        this._syncBgCircleRadius();
      }
    };
    window.addEventListener('resize', onResize);
    // iOS URL-bar show/hide fires visualViewport resize but not window resize
    window.visualViewport?.addEventListener('resize', onResize);
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    const diff = this.scrollTarget - this.scroll;
    const vel = Math.abs(diff);

    this.scroll += diff * params.scrollSmoothing;
    this.smoothBend += (Math.min(vel * params.bendSensitivity, 1) - this.smoothBend) * params.bendSmoothing;

    // Combine intro bend (tweened) with interaction bend (velocity-driven)
    // and splice-transition bend (tweened during page transition).
    const finalBend = Math.max(this.smoothBend, this.introBend, this.spliceBend);

    // Audio: hum volume tracks interaction energy (lerp velocity only now)
    const activity = Math.min(vel * 4, 1);
    this.audio.setActivity(activity);

    // ── 24fps sprocket tooth gate ──
    // Only fires while user is actively providing input (last 180ms).
    const teeth = params.sprocketsPerImage;
    const currentTooth = Math.floor(this.scroll * teeth);
    const userActive = performance.now() - this.lastInputTime < 180;
    if (currentTooth !== this.lastTooth && !this.introActive && userActive) {
      this.lastTooth = currentTooth;
      this.shutterFlash = 1;
      this.audio.snap();
    } else if (currentTooth !== this.lastTooth) {
      // Silent catch-up during momentum decay — no flash, no click
      this.lastTooth = currentTooth;
    }
    // Fast decay — flash dies to ~zero in 4-5 frames, no hard snap needed
    this.shutterFlash *= 0.55;

    const u = this.material.uniforms;
    u.uProgress.value = this.scroll;
    u.uBend.value = finalBend;
    u.uTime.value = (performance.now() - this.startTime) / 1000;
    u.uShutter.value = this.shutterFlash;
    // Live-bind Tweakpane params
    u.uFilmStrength.value = params.filmStrength;
    u.uFilmBase.value = params.filmBaseStrength;
    u.uGrain.value = params.grainAmount;
    u.uBorderW.value = params.borderWidth;
    u.uSprockets.value = params.sprocketsPerImage;
    u.uExposure.value = params.exposure;
    u.uBrightness.value = params.brightness;
    u.uContrast.value = params.contrast;
    u.uSaturation.value = params.saturation;
    u.uVignette.value = params.vignetteStrength;
    u.uFocusStrength.value = params.focusStrength;

    // Cursor parallax — smoothed tilt based on mouse position
    this.parallaxX += (this.mouseX - this.parallaxX) * 0.06;
    this.parallaxY += (this.mouseY - this.parallaxY) * 0.06;
    if (this.mesh) {
      // Subtle rotation: up to ~3° each axis
      this.mesh.rotation.y = this.parallaxX * 0.05;
      this.mesh.rotation.x = -this.parallaxY * 0.03;
    }

    // Iris: only needs the shared time clock — rotation is self-driven.
    if (this.gridMaterial) {
      this.gridMaterial.uniforms.uTime.value = u.uTime.value;
    }
    if (this.asciiMaterial) {
      const u2 = this.asciiMaterial.uniforms;
      u2.uScroll.value = this.scroll;
      u2.uTime.value = u.uTime.value;

      // Velocity signal — smoothed scroll-delta magnitude used to drive
      // the grain storm, shimmer amplitude, and multi-exposure smear.
      const asciiDelta = Math.abs(this.scroll - (this._asciiPrevScroll ?? this.scroll));
      this._asciiPrevScroll = this.scroll;
      this._asciiVel = (this._asciiVel || 0) * 0.82 + asciiDelta * 0.18;
      const velNorm = Math.min(this._asciiVel * 42, 1);
      u2.uVelocity.value = velNorm;

      // Shutter flash — reuses the main strip's shutterFlash so both
      // layers flash on the exact same beat, punctuating frame landings
      // as a single rig firing.
      u2.uShutter.value = this.shutterFlash || 0;

      // Multi-exposure smear: tint is a Gaussian-weighted blend of the
      // 5 neighbor editions around the current scroll, spread widened
      // by velocity. At rest (vel≈0) the blend collapses to a single
      // continuous interpolation between the two adjacent frames. At
      // speed the tint is a smeared average — photographic long-exposure
      // across editions.
      if (this._asciiTints) {
        const N = IMAGE_COUNT;
        const sMod = ((this.scroll % N) + N) % N;
        const tintAt = (s) => {
          const m = ((s % N) + N) % N;
          const a = Math.floor(m);
          const b = (a + 1) % N;
          const t = m - a;
          const ta = this._asciiTints[a];
          const tb = this._asciiTints[b];
          return [
            ta.x * (1 - t) + tb.x * t,
            ta.y * (1 - t) + tb.y * t,
            ta.z * (1 - t) + tb.z * t,
          ];
        };

        const base = tintAt(sMod);
        // Secondary storm palette (uYellow / uWhite) is fixed at material
        // creation — no per-frame update. Consistent across all scrolling.
        if (velNorm < 0.08) {
          u2.uTint.value.set(base[0], base[1], base[2]);
        } else {
          const spread = 0.25 + velNorm * 2.2;
          let rr = 0, gg = 0, bb = 0, tw = 0;
          for (let k = -2; k <= 2; k++) {
            const w = Math.exp(-(k * k) / (spread * spread));
            const t = tintAt(sMod + k);
            rr += t[0] * w; gg += t[1] * w; bb += t[2] * w;
            tw += w;
          }
          rr /= tw; gg /= tw; bb /= tw;
          const bend = velNorm;
          u2.uTint.value.set(
            base[0] * (1 - bend) + rr * bend,
            base[1] * (1 - bend) + gg * bend,
            base[2] * (1 - bend) + bb * bend,
          );
        }
      }
    }

    this.checkFrame();
    this._updateBgCircle();

    // Viewfinder: acquisition-rig behavior. Brackets stay fixed size — no
    // extending arms. During motion a thin horizontal scanline sweeps
    // top-to-bottom through the frame (CRT/radar-scan aesthetic), speed
    // tied to scroll velocity. The whole rig drifts softly in the scroll
    // direction like a gimbal, and on integer landings emits a tight
    // contraction kick. At rest: clean, frozen brackets. During scroll:
    // a machine actively scanning.
    if (this.viewfinderEl) {
      const vfSigned = this.scroll - (this._vfPrevScroll ?? this.scroll);
      this._vfPrevScroll = this.scroll;
      const vfAbs = Math.abs(vfSigned);
      this._vfVel = (this._vfVel || 0) * 0.84 + vfAbs * 0.16;
      this._vfSigned = (this._vfSigned || 0) * 0.78 + vfSigned * 0.22;
      this._vfLockBeat = (this._vfLockBeat || 0) * 0.72;

      const motion = Math.min(this._vfVel * 48, 1);
      const beat   = this._vfLockBeat;
      const dir    = Math.max(Math.min(this._vfSigned * 60, 1), -1);

      // Scanline phase: advances proportional to motion. At rest the phase
      // stops, scanline fades out via opacity so it literally disappears.
      this._vfScanPhase = ((this._vfScanPhase || 0) + motion * 0.035) % 1;
      const scanY  = (this._vfScanPhase * 100).toFixed(2);
      const scanOp = Math.min(motion * 1.6, 1);

      // Shape mode switch — L brackets → + crosshairs once motion crosses
      // a threshold. Hysteresis so the switch doesn't chatter on a single
      // frame that happens to cross the boundary.
      const crossTarget = motion > (this._vfCross > 0.5 ? 0.38 : 0.52) ? 1 : 0;
      this._vfCross = crossTarget;

      // Gimbal drift + subtle scale hint + lock contraction beat.
      const dy = dir * 12;
      const sx = 1 - beat * 0.01;
      const sy = 1 + beat * 0.018;
      const op = 1 - motion * 0.22;

      this.viewfinderEl.style.transform =
        `translate(-50%, calc(-50% + ${dy.toFixed(2)}px)) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      this.viewfinderEl.style.setProperty('--vf-scan-y', `${scanY}%`);
      this.viewfinderEl.style.setProperty('--vf-scan-opacity', scanOp.toFixed(3));
      this.viewfinderEl.style.setProperty('--vf-motion-opacity', op.toFixed(3));
      this.viewfinderEl.style.setProperty('--vf-cross', this._vfCross);
    }

    // Live scroll readout — φ updates every frame for a continuously-changing
    // mathematical coordinate that plays against the instant title swap.
    if (this.techPhiEl) {
      const phi = ((this.scroll % IMAGE_COUNT) + IMAGE_COUNT) % IMAGE_COUNT;
      this.techPhiEl.textContent = `φ ${phi.toFixed(4)}`;
    }

    // Predictive magnet — target integer is velocity-aware.
    //   predicted = scrollTarget + wheelVel × 400ms
    //   (approx distance scroll would travel with current velocity decaying)
    // Hard flicks → velocity high → predicted lands far ahead.
    // Idle → velocity ~0 → predicted collapses to nearest integer.
    // scrollTarget eases toward that prediction at 2% per frame — weak
    // enough that active scrolling dominates, strong enough to carry the
    // landing once input stops. Wheel velocity decays when no recent input.
    const sinceInput = performance.now() - this.lastInputTime;
    if (sinceInput > 50) {
      this._wheelVel = (this._wheelVel || 0) * 0.88;
      if (Math.abs(this._wheelVel) < 0.00001) this._wheelVel = 0;
    }
    if (!this.dragging && !this.introActive && !this.peekOpen) {
      const predicted = this.scrollTarget + (this._wheelVel || 0) * 400;
      const target = Math.round(predicted);
      this.scrollTarget += (target - this.scrollTarget) * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── Hero sequence ──
  // Loader fades → text uniform tweens 0→1 (shader dissolves text in via fbm
  // noise) → hold → uniform 1→2 (shader dissolves text out) → bg brown→beige
  // → film rises → chrome reveals. Text animation lives in GLSL; GSAP only
  // nudges a single uniform value.
  enter() {
    this.introBend = 1.0;

    this.swapTitle(TITLES[0]);
    // Seed the panel with frame 0's signature (instant, no tween) so the
    // reveal shows real data rather than zeros rolling in.
    const s0 = SIGNATURES[0];
    const a0 = SIG_AXES[0];
    Object.assign(this.instrState, {
      a0: a0[0], a1: a0[1], a2: a0[2], a3: a0[3], a4: a0[4], a5: a0[5],
      stylize: s0.stylize, chaos: s0.chaos, weight: s0.weight,
      temp: s0.temp, sat: s0.sat,
    });
    if (this.instr.index) this.instr.index.textContent = '001';
    if (this.instr.seed) this.instr.seed.textContent = String(s0.seed).padStart(7, '0');
    this._redrawRadar();
    this._redrawReadout();

    const preloaderEl = document.getElementById('pre-loader');

    const tl = gsap.timeline({
      onComplete: () => {
        this.introActive = false;
        // Drop the WebGL text plane after dissolve completes
        if (this.textMesh) {
          this.scene.remove(this.textMesh);
          this.textMesh.geometry.dispose();
          this.textMaterial.uniforms.uTex.value.dispose();
          this.textMaterial.dispose();
          this.textMesh = null;
        }
      },
    });

    // ─────────────────────────────────────────────────────────────────
    //  ACT 0  — loader fades out (bg stays brown)
    // ─────────────────────────────────────────────────────────────────
    tl.to(preloaderEl, { opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => preloaderEl?.remove() });

    // ─────────────────────────────────────────────────────────────────
    //  ACT 1  — ARRIVAL (1.2s, all three motions decelerate together)
    //   silhouette rises · wheel spins 2 frames · text dissolves in
    //   shared ease (power3.out) and shared duration → single landing
    // ─────────────────────────────────────────────────────────────────
    const vp = this.viewport();
    const arriveDur = 1.2;
    const arriveEase = 'power3.out';

    tl.to(this.mesh.position, {
      y: -vp.h * 0.7,
      duration: arriveDur,
      ease: arriveEase,
    }, '-=0.1');

    tl.to(this, {
      scroll: 2,
      scrollTarget: 2,
      duration: arriveDur,
      ease: arriveEase,
    }, '<');

    tl.to(this.textMaterial.uniforms.uProgress, {
      value: 1.0,
      duration: arriveDur,
      ease: arriveEase,
    }, '<');

    // ─────────────────────────────────────────────────────────────────
    //  ACT 2  — HOLD (0.5s breath, generous)
    //   bent silhouette + cream title + brown bg, all still
    // ─────────────────────────────────────────────────────────────────
    tl.addLabel('hold', '+=0.5');

    // ─────────────────────────────────────────────────────────────────
    //  ACT 3  — TRANSITION (0.65s, single visual event)
    //   text fades + bg shifts together, perfectly synchronized
    // ─────────────────────────────────────────────────────────────────
    const fadeDur = 0.65;
    const fadeEase = 'power2.inOut';

    tl.to(this.textMaterial.uniforms.uAlpha, {
      value: 0,
      duration: fadeDur,
      ease: fadeEase,
    }, 'hold');

    // Daylight shift killed — MAWZE stays in immersive-dark throughout.
    // (Previously: `document.body.classList.add('daylight')` faded bg brown→beige.)

    // ─────────────────────────────────────────────────────────────────
    //  ACT 4  — HERO (1.0s, climactic)
    //   silhouette → centered, bend unfolds, chrome reveals on tail
    // ─────────────────────────────────────────────────────────────────
    tl.addLabel('hero', 'hold+=0.55');

    tl.to(this.mesh.position, {
      y: 0,
      duration: 1.0,
      ease: 'power3.out',
    }, 'hero');

    tl.to(this, {
      introBend: 0,
      duration: 0.9,
      ease: 'power2.out',
    }, 'hero+=0.1');

    // Chrome reveals on the wheel's deceleration tail — gentle staircase
    tl.to('.navbar',        { opacity: 1,    duration: 0.4, ease: 'power2.out' }, 'hero+=0.55');
    // counter is inside navbar now — revealed together
    tl.to('.slide-info, .frame__meta, .hero-tech', { opacity: 1, duration: 0.4, ease: 'power2.out' }, 'hero+=0.7');
    tl.to('.viewfinder', { opacity: 1, duration: 0.45, ease: 'power2.out' }, 'hero+=0.9');
    tl.to('.bg-circle-wrap', { opacity: 0.85, duration: 1.2, ease: 'power2.out' }, 'hero+=0.5');
    tl.to('.bg-circle-index', { opacity: 1, duration: 1.0, ease: 'power2.out' }, 'hero+=0.8');
    // Instrument panel fades in on the deceleration tail alongside the rest
    // of the chrome — already pre-seeded with frame 0 so no value roll.
    tl.to('.instrument', { opacity: 1, duration: 0.6, ease: 'power2.out' }, 'hero+=0.75');

    // Contact-sheet grid fades in at the tail — the photographic inspection
    // surface the whole composition sits on.
    if (this.gridMaterial) {
      tl.to(this.gridMaterial.uniforms.uActive, {
        value: 1,
        duration: 1.2,
        ease: 'power2.out',
      }, 'hero+=0.3');
    }
    // ASCII image backdrop fades in — a colored ghost of the reel rendered
    // as ASCII glyphs, living behind everything.
    if (this.asciiMaterial) {
      tl.to(this.asciiMaterial.uniforms.uActive, {
        value: 1,
        duration: 1.2,
        ease: 'power2.out',
      }, 'hero+=0.35');
    }
    // .nav-buttons removed — drag + keyboard + click are enough to navigate
  }

  // ── Iris mechanism: a full-viewport plane behind everything that draws
  //    an 8-blade aperture diaphragm rotating one revolution per ~60
  // ── ASCII image shader: the current frame's atlas image is rendered as
  //    colored ASCII art filling the background. Each cell samples the
  //    image at its center, picks a glyph from a density ramp (' '→'@')
  //    based on luminance, and colors it with the image's actual pixel
  //    color. Fills the black negative space around the cylinder with a
  //    living, colored ghost of the reel. Advances with scroll. ──
  _createAsciiBg() {
    // Build a character atlas — 10 glyphs in increasing density order.
    const CHARS = ' .:-=+*#%@';
    const GLYPH = 48;
    const charCanvas = document.createElement('canvas');
    charCanvas.width = GLYPH * CHARS.length;
    charCanvas.height = GLYPH;
    const cctx = charCanvas.getContext('2d');
    cctx.fillStyle = '#ffffff';
    cctx.font = `700 ${Math.floor(GLYPH * 0.78)}px "Space Mono", ui-monospace, monospace`;
    cctx.textBaseline = 'middle';
    cctx.textAlign = 'center';
    for (let i = 0; i < CHARS.length; i++) {
      cctx.fillText(CHARS[i], i * GLYPH + GLYPH / 2, GLYPH / 2 + GLYPH * 0.02);
    }
    this.charAtlas = new THREE.CanvasTexture(charCanvas);
    this.charAtlas.minFilter = THREE.LinearFilter;
    this.charAtlas.magFilter = THREE.LinearFilter;
    this.charAtlas.generateMipmaps = false;

    this.asciiMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uAtlas:      { value: this.atlas },
        uCharAtlas:  { value: this.charAtlas },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uScroll:     { value: 0 },
        uActive:     { value: 0 },
        uCellSize:   { value: 14 },
        uNumChars:   { value: CHARS.length },
        uTime:       { value: 0 },
        uTint:       { value: new THREE.Vector3(0.7, 0.7, 0.8) },
        // Fixed MAWZE chromatic-storm palette — warm film yellow + cream
        // white. Always the same, regardless of which edition you're on.
        // The yellow tonally rhymes with the cream text / film-base color
        // elsewhere on the page, so the storm reads as "the rig speaking"
        // rather than arbitrary decoration. Tamed down so peak-velocity
        // doesn't blow out the composition.
        uYellow:     { value: new THREE.Vector3(0.72, 0.58, 0.30) },
        uWhite:      { value: new THREE.Vector3(0.82, 0.78, 0.72) },
        uVelocity:   { value: 0 },
        uShutter:    { value: 0 },
        // Circle aperture: ASCII backdrop masks to zero alpha inside the
        // lens ring so the circle reads as a clean viewing porthole.
        uCircleR:    { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uAtlas;
        uniform sampler2D uCharAtlas;
        uniform vec2 uResolution;
        uniform float uScroll;
        uniform float uActive;
        uniform float uCellSize;
        uniform float uNumChars;
        uniform float uTime;
        uniform vec3 uTint;
        uniform vec3 uYellow;
        uniform vec3 uWhite;
        uniform float uVelocity;
        uniform float uShutter;
        uniform float uCircleR;
        varying vec2 vUv;

        #define COLS 5.0
        #define ROWS 5.0
        #define N 25.0

        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          // Cell layout on screen.
          vec2 px = vUv * uResolution;
          vec2 cellIdx = floor(px / uCellSize);
          vec2 cellCenterPx = (cellIdx + 0.5) * uCellSize;
          vec2 imgUV = cellCenterPx / uResolution;

          float sMod = mod(uScroll, N);
          if (sMod < 0.0) sMod += N;
          float fA = floor(sMod);
          float fB = mod(fA + 1.0, N);
          float mixT = fract(sMod);

          float aCol = mod(fA, COLS), aRow = floor(fA / COLS);
          float bCol = mod(fB, COLS), bRow = floor(fB / COLS);
          vec2 uvA = vec2((aCol + imgUV.x) / COLS, (aRow + (1.0 - imgUV.y)) / ROWS);
          vec2 uvB = vec2((bCol + imgUV.x) / COLS, (bRow + (1.0 - imgUV.y)) / ROWS);
          vec4 cA = texture2D(uAtlas, uvA);
          vec4 cB = texture2D(uAtlas, uvB);
          vec4 imgColor = mix(cA, cB, mixT);

          float lum = dot(imgColor.rgb, vec3(0.299, 0.587, 0.114));
          lum = pow(lum, 0.78);

          // ── IDLE + VELOCITY-REACTIVE ANIMATION ───────────────────────
          float phase = hash12(cellIdx) * 6.2831;
          float shimAmp = 0.032 + uVelocity * 0.09;
          float shimFreq = 1.1 + uVelocity * 2.4;
          float shimmer = sin(uTime * shimFreq + phase) * shimAmp;
          float grainPulse = (hash12(cellIdx + fract(uTime * 3.1)) - 0.5) * uVelocity * 0.18;
          float scanPos = fract(uTime * (0.08 + uVelocity * 0.35));
          float scan = exp(-pow((vUv.y - (1.0 - scanPos)) * 5.8, 2.0)) * (0.1 + uVelocity * 0.1);
          lum = clamp(lum + shimmer + scan + grainPulse, 0.0, 1.0);

          float charIdx = floor(lum * (uNumChars - 0.001));

          // Sample glyph atlas at cell-local UV.
          vec2 localUV = fract(px / uCellSize);
          vec2 charUV = vec2((charIdx + localUV.x) / uNumChars, localUV.y);
          float glyph = texture2D(uCharAtlas, charUV).r;

          // ── DUOTONE + CHROMATIC STORM ────────────────────────────────
          // At rest: each cell renders in the current edition's dominant
          // tint. During scroll: cells dither into a hard-split yellow /
          // cream palette (constant across all editions so the storm
          // always reads the same). Mix capped so the frame tint keeps
          // presence even at peak velocity — never fully dominated.
          float cellHash = hash12(cellIdx * 0.73 + 11.3);
          vec3 stormTint = mix(uYellow, uWhite, step(0.5, cellHash));
          float stormMix = clamp(uVelocity, 0.0, 1.0) * 0.55;
          vec3 cellTint  = mix(uTint, stormTint, stormMix);

          vec3 shadow    = cellTint * 0.08;
          vec3 highlight = mix(cellTint, vec3(1.0), 0.14);
          vec3 rgb = mix(shadow, highlight, lum);

          // ── SHUTTER FLASH ───────────────────────────────────────────
          // Fires with the main strip's shutter — same uniform value, so
          // foreground and background flash together on each frame land.
          float shutter = uShutter;
          rgb += vec3(1.0, 0.94, 0.84) * shutter * 0.4;

          // Overall alpha eases down during motion so the storm never
          // shouts louder than the rest state — fast-scroll the grid
          // fades slightly, settle brings it back. Shutter adds a small
          // bloom kick that decays with the shutter itself.
          float motionFade = 1.0 - uVelocity * 0.4;
          float alpha = glyph * uActive * 0.26 * motionFade * (1.0 + shutter * 0.15);

          // Lens aperture mask — ASCII fades to zero inside the circle,
          // leaving the aperture a clean viewing porthole for the cylinder.
          // The mask is soft (18px feather) so the edge reads as optical,
          // not a hard cutout.
          vec2 cenPx = uResolution * 0.5;
          float distFromCenter = distance(vUv * uResolution, cenPx);
          float apertureMask = smoothstep(uCircleR - 28.0, uCircleR + 4.0, distFromCenter);
          alpha *= apertureMask;

          gl_FragColor = vec4(rgb, alpha);
        }
      `,
    });

    // Full-viewport plane behind every other background layer.
    const z = -2.5;
    const dist = CAMERA_Z - z;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visW = visH * this.camera.aspect;

    this.asciiMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(visW, visH),
      this.asciiMaterial
    );
    this.asciiMesh.position.z = z;
    this.asciiMesh.renderOrder = -7;
    this.scene.add(this.asciiMesh);
  }

  // ── Lens-aperture circle: generates 25 tick marks (one per edition)
  //    on the SVG rim, then wires scroll-driven rotation and active-tick
  //    highlighting in the render loop (via updateBgCircle). Major ticks
  //    every 5 frames. Rotates so the current frame's tick sits at top. ──
  _createBgCircle() {
    this.bgCircleWrap = document.getElementById('bg-circle-wrap');
    const ticksEl = document.getElementById('bg-circle-ticks');
    if (!this.bgCircleWrap || !ticksEl) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    this.bgCircleTicks = [];
    for (let i = 0; i < IMAGE_COUNT; i++) {
      // Start at top (-90° in SVG coords = -PI/2) and go clockwise.
      const angle = -Math.PI / 2 + (i / IMAGE_COUNT) * Math.PI * 2;
      const major = i % 5 === 0;
      const rIn   = major ? 91 : 94;
      const rOut  = 98;
      const x1 = Math.cos(angle) * rIn;
      const y1 = Math.sin(angle) * rIn;
      const x2 = Math.cos(angle) * rOut;
      const y2 = Math.sin(angle) * rOut;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x1.toFixed(3));
      line.setAttribute('y1', y1.toFixed(3));
      line.setAttribute('x2', x2.toFixed(3));
      line.setAttribute('y2', y2.toFixed(3));
      if (major) line.classList.add('bg-circle__tick--major');
      ticksEl.appendChild(line);
      this.bgCircleTicks.push(line);
    }
    this._bgCircleActiveTick = -1;
    this._syncBgCircleRadius();
  }

  // Sync the ASCII shader's aperture radius with the CSS circle size.
  _syncBgCircleRadius() {
    if (!this.asciiMaterial) return;
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    // min(82vh, 82vw) / 2 — matches CSS. Subtract a pixel so the mask
    // bleeds just under the SVG stroke instead of bleeding through it.
    const radius = minDim * 0.41 - 1;
    this.asciiMaterial.uniforms.uCircleR.value = radius;
  }

  // Per-frame update: rotate the circle so the current frame's tick is
  // at 12 o'clock, and mark that tick "active" (warm-yellow highlight).
  _updateBgCircle() {
    if (!this.bgCircleWrap || !this.bgCircleTicks) return;
    const N = IMAGE_COUNT;
    // Smoothly map continuous scroll → rotation. Negative so the circle
    // rotates against scroll direction — giving the top position its
    // natural "current frame" anchoring.
    const rot = -(this.scroll / N) * 360;
    this.bgCircleWrap.style.transform =
      `translate(-50%, -50%) rotate(${rot.toFixed(3)}deg)`;

    const cur = ((Math.round(this.scroll) % N) + N) % N;
    if (cur !== this._bgCircleActiveTick) {
      if (this._bgCircleActiveTick >= 0) {
        const prev = this.bgCircleTicks[this._bgCircleActiveTick];
        prev.classList.remove('bg-circle__tick--active');
        // Clear any pulse residue so inactive ticks return to base.
        prev.style.strokeWidth = '';
        prev.style.filter = '';
      }
      this.bgCircleTicks[cur].classList.add('bg-circle__tick--active');
      this._bgCircleActiveTick = cur;
    }

    // Shutter pulse on the active tick — fires in lockstep with the
    // main strip's shutterFlash, so the index blooms alongside the
    // cylinder on every frame landing. Mutations only when active
    // (no per-frame writes when shutter is ~zero).
    const activeTick = this.bgCircleTicks[this._bgCircleActiveTick];
    const s = this.shutterFlash || 0;
    if (activeTick) {
      if (s > 0.02) {
        activeTick.style.strokeWidth = (0.45 + s * 0.55).toFixed(3);
        activeTick.style.filter =
          `drop-shadow(0 0 ${(s * 2.8).toFixed(2)}px rgba(221, 183, 104, 0.95))`;
      } else if (this._bgTickPulseActive) {
        activeTick.style.strokeWidth = '';
        activeTick.style.filter = '';
      }
      this._bgTickPulseActive = s > 0.02;
    }
  }

  // ── Graph-paper dot lattice plane behind the cylinder — a photographic
  //    inspection surface. Static dots at ultra-low alpha, WebGL-native. ──
  _createGridPlane() {
    this.gridMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uActive:     { value: 0 },
        uTime:       { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec2 uResolution;
        uniform float uActive;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          // Graph-paper measurement surface — a static dot lattice. Lives
          // behind every other layer at ultra-low alpha so it reads as a
          // technical background, not decoration. The per-frame data
          // graphs drawn on top are what make it feel alive.
          vec2 px = vUv * uResolution;
          const float SP = 28.0;
          vec2 g = mod(px + SP * 0.5, SP) - SP * 0.5;
          float r = length(g);
          float core = smoothstep(1.0, 0.45, r);
          float halo = smoothstep(2.0, 1.0, r) * 0.08;
          float dotA = max(core, halo);

          vec3 ink = vec3(0.08, 0.07, 0.06);
          float a = dotA * 0.075 * uActive;

          gl_FragColor = vec4(ink, a);
        }
      `,
    });

    // Size the plane to exactly fill the viewport at a fixed depth behind
    // the text plane (z=-1) so transparent sorting (back-to-front) composites
    // grid → text → film in that order.
    const z = -2;
    const dist = CAMERA_Z - z;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visW = visH * this.camera.aspect;

    this.gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(visW, visH),
      this.gridMaterial
    );
    this.gridMesh.position.z = z;
    this.gridMesh.renderOrder = -5;
    this.scene.add(this.gridMesh);
  }

  // ── WebGL text plane: serif "Film / Wheel" rendered to a high-res 2D
  //    canvas, used as the texture on a plane in front of the scene with an
  //    fbm-dissolve shader. The text animation is done entirely in GLSL. ──
  _createTextPlane() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = 4096, H = 1400;          // sized for 1100px Bulevar
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#EFE6D6';
    ctx.font = 'normal 400 1100px "Bulevar", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAWZE', W / 2, H / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.textMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: tex },
        uProgress: { value: 0 }, // dissolve-in driver (0 → 1)
        uAlpha: { value: 1.0 },  // global opacity for clean fade-with-bg exit
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uTex;
        uniform float uProgress;
        uniform float uAlpha;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p *= 2.02;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec4 t = texture2D(uTex, vUv);
          // Organic dissolve mask — multi-octave noise field
          float n = fbm(vUv * vec2(3.5, 5.0) + vec2(0.0, vUv.x * 1.5));
          // Single-phase reveal: 0 → 1. Exit is just uAlpha → 0 (clean fade).
          float alpha = 1.0 - smoothstep(uProgress - 0.18, uProgress + 0.06, n);
          gl_FragColor = vec4(t.rgb, t.a * alpha * uAlpha);
        }
      `,
    });

    // Behind the film: z=-1 (further from camera than film at z=0). Three.js
    // sorts transparents back-to-front, so film draws over the text where
    // they overlap. Plane sized for that depth so text reads at ~65% viewport.
    const z = -1;
    const dist = CAMERA_Z - z;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visW = visH * this.camera.aspect;
    const planeW = visW * 1.25;   // bleeds slightly past viewport — huge
    const planeH = planeW * (H / W);

    this.textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      this.textMaterial
    );
    this.textMesh.position.z = z;
    this.textMesh.renderOrder = -1;   // explicitly behind the film
    this.scene.add(this.textMesh);
  }

  // ── Loader ticker: animates % from 0→100 over min duration, clamped to
  //    actual texture load. Resolves only when BOTH are complete (honest). ──
  _runLoader() {
    const pctEl = document.getElementById('pre-loader-pct');
    const loaderEl = document.getElementById('pre-loader');

    // ── DEBUG: log every angle on the loader's color so we can see exactly
    //    what the browser is computing. Check the browser console.
    if (loaderEl && pctEl) {
      const cs1 = window.getComputedStyle(loaderEl);
      const cs2 = window.getComputedStyle(pctEl);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);

      console.groupCollapsed('%c[LOADER COLOR DEBUG]', 'color: #EFE6D6; background: #000; padding: 4px 8px; font-weight: bold;');
      console.log('--ink (root var):', rootStyle.getPropertyValue('--ink').trim() || '(not set)');
      console.log('body computed color:', bodyStyle.color);
      console.log('body computed background:', bodyStyle.backgroundColor);
      console.log('.pre-loader computed color:', cs1.color);
      console.log('.pre-loader computed opacity:', cs1.opacity);
      console.log('.pre-loader computed background:', cs1.backgroundColor);
      console.log('#pre-loader-pct computed color:', cs2.color);
      console.log('#pre-loader-pct computed opacity:', cs2.opacity);
      console.log('#pre-loader-pct inline style.color:', pctEl.style.color || '(none)');
      console.log('loaderEl inline style.color:', loaderEl.style.color || '(none)');
      console.log('loaderEl classList:', Array.from(loaderEl.classList));
      console.log('pctEl parent:', pctEl.parentElement?.id, pctEl.parentElement?.className);
      console.log('pctEl innerHTML:', pctEl.innerHTML);

      // Dump every CSS rule that matches .pre-loader
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText && /pre-loader/.test(rule.selectorText)) {
              rules.push({ selector: rule.selectorText, color: rule.style.color, opacity: rule.style.opacity });
            }
          }
        } catch (e) { /* cross-origin */ }
      }
      console.log('Matching CSS rules:', rules);

      // Check for any filter, mix-blend, or compositing trickery
      console.log('.pre-loader filter:', cs1.filter);
      console.log('.pre-loader mixBlendMode:', cs1.mixBlendMode);
      console.log('#pre-loader-pct filter:', cs2.filter);
      console.log('#pre-loader-pct mixBlendMode:', cs2.mixBlendMode);
      console.groupEnd();
    }

    const MIN_LOAD_MS = 350;
    const t0 = performance.now();
    return new Promise(resolve => {
      const tick = () => {
        const elapsed = performance.now() - t0;
        const animated = Math.min(elapsed / MIN_LOAD_MS, 1);
        const actual = this.loadPct || 0;
        const effective = Math.min(animated, actual);
        if (pctEl) pctEl.textContent = String(Math.floor(effective * 100)).padStart(3, '0');
        if (effective < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }

  // Snapshot of per-frame data the transition module needs.
  getFrameState() { return buildFrameState(); }

  // Keep the viewfinder CSS size in lockstep with the current stripWidth so
  // the brackets always hug the image exactly (stripWidth changes on resize
  // via responsiveStripParams). Written as a vw value so it scales fluidly.
  _syncViewfinderSize() {
    const vfSize = `${(params.stripWidth * 100).toFixed(2)}vw`;
    document.documentElement.style.setProperty('--vf-size', vfSize);
  }

  // Title swap: instant — stays readable during fast scroll, no overlap artifacts.
  // Structured as .line-wrap > .line per line so spine/slate layouts can collapse
  // to inline and other layouts can render as stacked blocks.
  swapTitle(html) {
    const lines = html.split(/<br\s*\/?>/i);
    const structured = lines
      .map(l => `<span class="line-wrap"><span class="line">${l}</span></span>`)
      .join('');
    this.titleEl.innerHTML = structured;
  }

  checkFrame() {
    // Match the fragment shader's centered-frame formula exactly:
    //   at vUv.y=0.5, scrollV = scroll + 0.5 → floor gives the centered cell
    const s = this.scroll + 0.5;
    const raw = ((s % IMAGE_COUNT) + IMAGE_COUNT) % IMAGE_COUNT;
    const f = Math.floor(raw) % IMAGE_COUNT;
    if (f === this.frame) return;
    this.frame = f;

    const num = String(f + 1).padStart(3, '0');
    const total = String(IMAGE_COUNT).padStart(3, '0');
    this.swapTitle(TITLES[f]);
    this._updateInstrument(f);

    // Hero tech metadata (per-frame EXIF-style annotations)
    const t = techMetaFor(f);
    if (this.techIdxEl) this.techIdxEl.textContent = `${num}/${total}`;
    if (this.techIsoEl) this.techIsoEl.textContent = `ISO ${t.iso}`;
    if (this.techApEl)  this.techApEl.textContent  = t.ap;
    if (this.techShEl)  this.techShEl.innerHTML    = `${t.sh}<i>s</i>`;
    if (this.techEvEl)  this.techEvEl.textContent  = `EV ${t.ev}`;

    // Frame-lock beat — a small velocity spike that the continuous
    // viewfinder animation picks up, giving a subtle snap on every
    // integer landing without the instant CSS pulse fighting the
    // velocity-driven transform.
    this._vfLockBeat = 1;
  }

  // ── Instrument panel: build static radar scaffold (grids + axes + labels). ──
  _buildRadar() {
    const R = 92;                                    // outer radius in SVG units
    const axes = ['STY', 'CHA', 'WGT', 'TMP', 'SAT', 'SD'];
    const N = axes.length;
    // For each axis k, angle = -π/2 + k * 2π/N (first axis points up)
    const angleFor = (k) => -Math.PI / 2 + (k * Math.PI * 2) / N;

    const ringPts = (scale) => {
      const pts = [];
      for (let k = 0; k < N; k++) {
        const a = angleFor(k);
        pts.push(`${(Math.cos(a) * R * scale).toFixed(2)},${(Math.sin(a) * R * scale).toFixed(2)}`);
      }
      return pts.join(' ');
    };

    // Concentric rings — 33%, 66%, 100%
    document.getElementById('radar-grid-1').setAttribute('points', ringPts(1.0));
    document.getElementById('radar-grid-2').setAttribute('points', ringPts(0.66));
    document.getElementById('radar-grid-3').setAttribute('points', ringPts(0.33));

    // Axis lines from center to each vertex
    const axesG = document.getElementById('radar-axes');
    axesG.innerHTML = '';
    for (let k = 0; k < N; k++) {
      const a = angleFor(k);
      const x = (Math.cos(a) * R).toFixed(2);
      const y = (Math.sin(a) * R).toFixed(2);
      axesG.innerHTML += `<line x1="0" y1="0" x2="${x}" y2="${y}"></line>`;
    }

    // Axis labels — pushed slightly past the outer ring
    const labelsG = document.getElementById('radar-labels');
    labelsG.innerHTML = '';
    for (let k = 0; k < N; k++) {
      const a = angleFor(k);
      const x = (Math.cos(a) * (R + 12)).toFixed(2);
      const y = (Math.sin(a) * (R + 12) + 2.3).toFixed(2);
      const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      labelsG.innerHTML += `<text x="${x}" y="${y}" text-anchor="${anchor}">${axes[k]}</text>`;
    }

    // Pre-create the 6 data-point circles (positions set per-frame)
    const pointsG = document.getElementById('radar-points');
    pointsG.innerHTML = '';
    for (let k = 0; k < N; k++) {
      pointsG.innerHTML += `<circle r="1.8" cx="0" cy="0"></circle>`;
    }

    this._radarR = R;
    this._radarAngles = Array.from({ length: N }, (_, k) => angleFor(k));
  }

  // ── Redraw the radar polygon + data points from the current interpolated
  //    axis values (instrState.a0..a5). Called on every GSAP tick while
  //    morphing between frames so it animates smoothly.
  _redrawRadar() {
    if (!this._radarAngles) return;
    const R = this._radarR;
    const vals = [
      this.instrState.a0, this.instrState.a1, this.instrState.a2,
      this.instrState.a3, this.instrState.a4, this.instrState.a5,
    ];
    const pts = [];
    const circles = this.instr.points.children;
    for (let k = 0; k < 6; k++) {
      const a = this._radarAngles[k];
      // Small floor so the polygon never fully collapses — keeps the shape readable
      const v = Math.max(vals[k], 0.06);
      const x = Math.cos(a) * R * v;
      const y = Math.sin(a) * R * v;
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      circles[k].setAttribute('cx', x.toFixed(2));
      circles[k].setAttribute('cy', y.toFixed(2));
    }
    this.instr.radar.setAttribute('points', pts.join(' '));
  }

  // Update readout text + bar widths from the interpolated state.
  _redrawReadout() {
    const s = this.instrState;
    this.instr.stylize.textContent = String(Math.round(s.stylize)).padStart(3, '0');
    this.instr.chaos.textContent   = String(Math.round(s.chaos)).padStart(2, '0');
    this.instr.weight.textContent  = s.weight.toFixed(2);
    this.instr.temp.textContent    = `${Math.round(s.temp / 10) * 10}K`;
    this.instr.sat.textContent     = `${Math.round(s.sat)}%`;

    this.instr.barStylize.style.width = `${(s.stylize / 1000) * 100}%`;
    this.instr.barChaos.style.width   = `${(s.chaos / 100) * 100}%`;
    this.instr.barWeight.style.width  = `${(s.weight / 2) * 100}%`;
    this.instr.barTemp.style.width    = `${((s.temp - 2000) / 8000) * 100}%`;
    this.instr.barSat.style.width     = `${(s.sat / 100) * 100}%`;
  }

  // Frame change → GSAP tweens every numeric value + the 6 radar axes over
  // the same duration with a shared ease, so the polygon morphs in lock-step
  // with the digits rolling and the bars sliding. Seed just snaps.
  _updateInstrument(f) {
    const sig = SIGNATURES[f];
    const axes = SIG_AXES[f];
    if (!sig) return;

    if (this.instr.index) {
      this.instr.index.textContent = String(f + 1).padStart(3, '0');
    }
    if (this.instr.seed) this.instr.seed.textContent = String(sig.seed).padStart(7, '0');

    gsap.to(this.instrState, {
      a0: axes[0], a1: axes[1], a2: axes[2], a3: axes[3], a4: axes[4], a5: axes[5],
      stylize: sig.stylize, chaos: sig.chaos, weight: sig.weight,
      temp: sig.temp, sat: sig.sat,
      duration: 0.75,
      ease: 'power3.out',
      onUpdate: () => {
        this._redrawRadar();
        this._redrawReadout();
      },
    });
  }

  // ── Tweakpane (hidden by default, toggle with D) ──
  initGUI() {
    const pane = new Pane({ title: 'Debug' });
    const strip = pane.addFolder({ title: 'Strip' });
    strip.addBinding(params, 'stripWidth', { min: 0.15, max: 0.65, step: 0.01 })
      .on('change', () => this.rebuildStrip());
    strip.addBinding(params, 'stripHeight', { min: 0.5, max: 5.0, step: 0.05 })
      .on('change', () => this.rebuildStrip());
    strip.addBinding(params, 'wrapAngle', { min: 1.0, max: 6.0, step: 0.1 })
      .on('change', () => this.rebuildStrip());

    const look = pane.addFolder({ title: 'Image look' });
    look.addBinding(params, 'exposure',   { min: 0.5, max: 2.0, step: 0.01 });
    look.addBinding(params, 'brightness', { min: -0.3, max: 0.3, step: 0.005 });
    look.addBinding(params, 'contrast',   { min: 0.5, max: 1.6, step: 0.01 });
    look.addBinding(params, 'saturation', { min: 0, max: 2.0, step: 0.01 });
    look.addBinding(params, 'vignetteStrength', { min: 0, max: 0.6, step: 0.01 });
    look.addBinding(params, 'focusStrength', { min: 0, max: 1, step: 0.01 });

    const film = pane.addFolder({ title: 'Film' });
    film.addBinding(params, 'filmStrength', { min: 0, max: 1, step: 0.05 });
    film.addBinding(params, 'filmBaseStrength', { min: 0, max: 0.5, step: 0.01 });
    film.addBinding(params, 'grainAmount', { min: 0, max: 0.15, step: 0.005 });
    film.addBinding(params, 'borderWidth', { min: 0, max: 0.12, step: 0.005 });
    film.addBinding(params, 'sprocketsPerImage', { min: 1, max: 6, step: 1 });

    const audio = pane.addFolder({ title: 'Audio' });
    audio.addBinding(this.audio, 'muted');

    // Toggle pane visibility with 'D'
    const paneEl = document.querySelector('.tp-dfwv');
    window.addEventListener('keydown', e => {
      if (e.key === 'd' || e.key === 'D') {
        paneEl?.classList.toggle('visible');
      }
    });
  }

  // ── Helper for Tweakpane strip rebinding ──
  rebuildStrip() {
    if (!this.mesh) return;
    const vp = this.viewport();
    const imgW = vp.w * params.stripWidth;
    const pw = imgW / (1 - 2 * params.borderWidth);
    const ph = vp.h * params.stripHeight;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(pw, ph, 32, 164);
    this.material.uniforms.uRadius.value = ph / params.wrapAngle;
    this.material.uniforms.uSlotH.value = imgW / ph;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────

const slider = new WheelSlider();
const detailRoot = document.getElementById('detail');

// Tracks whether the current detail route was reached via forwardSplice.
// If not (direct URL load / reload), back-nav runs simpleReverse since the
// slider may still be booting and the FLIP shard has no valid source rect.
let spliceEngaged = false;

const router = new Router({
  onLeave: async (prev, next, direction) => {
    if (prev.name === 'frame' && next.name === 'home') {
      if (spliceEngaged && slider.mesh && !slider.introActive) {
        await reverseSplice({ slider, frame: prev.frame, detailRoot, frameState: buildFrameState() });
      } else {
        await simpleReverse({ detailRoot });
      }
      spliceEngaged = false;
      slider.peekOpen = false;
    }
  },
  onEnter: async (next, prev, direction) => {
    if (next.name === 'frame') {
      // Can't splice before textures + mesh exist. If boot isn't done yet, direct-load.
      if (!slider.mesh || slider.introActive) {
        directLoadDetail({ frame: next.frame, detailRoot, frameState: buildFrameState() });
        slider.peekOpen = true;
        spliceEngaged = false;
        return;
      }
      slider.peekOpen = true;
      spliceEngaged = true;
      await forwardSplice({ slider, frame: next.frame, detailRoot, frameState: buildFrameState() });
    }
  },
});

// Wire slider → router
slider.onFrameClick = (f) => {
  router.navigate({ name: 'frame', frame: f });
};

router.init();

// Delegate clicks on in-app links (detail page back button, footer)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-nav="home"]');
  if (!link) return;
  e.preventDefault();
  router.navigate({ name: 'home' });
});

// Handle direct load on /frame/:id — render detail immediately (doesn't need slider mesh).
// Slider still boots in the background but its chrome stays hidden via the
// route-frame body class. When the user hits back, reverseSplice runs the
// "rise" animation on whatever state the slider has landed in.
(function handleInitialRoute() {
  const initial = parsePath(location.pathname);
  if (initial.name !== 'frame') return;
  slider.peekOpen = true;
  directLoadDetail({ frame: initial.frame, detailRoot, frameState: buildFrameState() });
  router.current = initial;
})();
