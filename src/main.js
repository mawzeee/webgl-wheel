import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';

const IMAGE_COUNT = 22;
const ATLAS_COLS = 5;
const ATLAS_ROWS = 5;
const IMAGE_PATHS = Array.from({ length: IMAGE_COUNT }, (_, i) => `/images/slide-${i + 1}.avif`);
const FOV = 50;
const CAMERA_Z = 5;
const DEBUG_UI = new URLSearchParams(window.location.search).has('debug');

const TITLES = [
  'Courtyard<br/>Audit',       // slide-1
  'Departures<br/>Lounge',     // slide-2
  'Ring<br/>Girls',            // slide-3
  'Desert<br/>Witness',        // slide-4
  'Soft<br/>Violence',         // slide-5
  'Round<br/>One',             // slide-6
  'Lipstick<br/>Weather',      // slide-7
  'Court<br/>Evidence',        // slide-8
  'Elevator<br/>Pitch',        // slide-9
  'Crash<br/>Landing',         // slide-10
  'Double<br/>Booked',         // slide-11
  'Power<br/>Surge',           // slide-12
  'Carry-On<br/>Altitude',     // slide-13
  'Green<br/>Room',            // slide-14
  'Moonrise<br/>Tailoring',    // slide-15
  'Lunar<br/>Errand',          // slide-16
  'Open<br/>Plan',             // slide-17
  'Ringside<br/>Bride',        // slide-18
  'Dust<br/>Protocol',         // slide-19
  'Afterparty<br/>Suite',      // slide-20
  'Dune<br/>Circuit',          // slide-21
  'Sound<br/>Wall',            // slide-22
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

// ── Click animation parameters ───────────────────────────────────────
//   Every knob in playFrameClickAnim reads from this object. When the
//   debug pane is enabled with ?debug, changes affect the next animation.
//   Defaults are tuned for a longer, cinematic helix recede.
const clickParams = {
  livePreview: false,

  // Phase 1 — Roll
  rollFrames: 1,             // how many frames the cylinder rolls forward
  rollDuration: 0.45,        // seconds

  // Phase 2 — Unspool (helix forms)
  bendPeak: 1.20,            // spliceBend at peak — how tight the cylinder curls
  twistPeak: 0.95,           // uTwist at peak — how many helix turns (higher = more)
  unspoolDuration: 1.50,     // how long the helix takes to form

  // Phase 2b — 3D angle (the helix tilts to show its depth)
  rotationY: 0.55,           // radians — Y rotation of the mesh (~31°)
  rotationX: -0.22,          // radians — X tilt (~-13°)

  // Phase 2c — Recede into scene
  positionZ: -2.8,           // negative = away from camera
  positionY: 0.30,           // upward drift
  positionX: -0.18,          // sideways drift
  scaleEnd: 0.55,            // final scale before fade
  recedeDuration: 1.70,      // length of the recede phase

  // Phase 3 — Fade out
  fadeOutStart: 1.40,        // when the fade begins (relative to t=0)
  fadeOutDuration: 0.80,

  // Phase 4 — Hold + reform
  reformDelay: 0.30,         // invisible beat after fade ends
  reformDuration: 0.70,      // fade-in duration
};

// ── Shaders ──

const vertexShader = /* glsl */ `
uniform float uBend;
uniform float uRadius;
uniform float uTwist;     // radians per world unit of Y — turns the cylinder into a helix
varying vec2 vUv;
varying float vNDotV;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Primary: vertical wheel bend (Y-axis cylinder wrap)
  float angleV = pos.y / uRadius;
  pos.y = mix(pos.y, uRadius * sin(angleV), uBend);
  pos.z = mix(0.0, uRadius * (cos(angleV) - 1.0), uBend);

  vNDotV = cos(mix(0.0, angleV, uBend));

  // ── HELIX TWIST ───────────────────────────────────────────────────
  //   Rotate (x, z) around the Y axis by an angle proportional to the
  //   vertex's Y position. As pos.y traverses the strip's height, each
  //   slice is rotated more — the result is a corkscrew / helical
  //   spiral. At uTwist=0 this is a no-op (bypassed for performance).
  if (uTwist > 0.001) {
    float twistAngle = pos.y * uTwist;
    float c = cos(twistAngle);
    float s = sin(twistAngle);
    vec2 xz = vec2(pos.x, pos.z);
    xz = vec2(xz.x * c - xz.y * s, xz.x * s + xz.y * c);
    pos.x = xz.x;
    pos.z = xz.y;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAtlas;
uniform float uAtlasCols; // e.g. 5 for a 5×5 grid
uniform float uAtlasRows;
uniform float uProgress, uBend, uSlotH, uFilmStrength, uFilmBase;
uniform float uShadeExponent, uTime, uGrain, uBorderW, uSprockets;
uniform float uExposure, uBrightness, uContrast, uSaturation, uVignette;
uniform float uFocusStrength;
uniform float uOpacity;
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
    gl_FragColor = vec4(col, alpha * (1.0 - hole) * uOpacity);
    return;
  }

  // Thin frame-line hairline separating the image area from the sprocket
  // border — a detail real 35mm has at the perforation edge. Faint cream.
  float edgeDist = min(vUv.x - bw, (1.0 - bw) - vUv.x);
  float edgeAA = fwidth(edgeDist);
  float frameLine = (1.0 - smoothstep(edgeAA * 0.5, edgeAA * 1.5, edgeDist)) * 0.22;

  float u = (vUv.x-bw)/(1.0-2.0*bw);
  float w = mod(scrollV, ${IMAGE_COUNT}.0);
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

  gl_FragColor = vec4(color.rgb, alpha * uOpacity);
}
`;

// ── Audio ──

// Web Audio kit: one short projector-tick buffer, retriggered per sprocket
// tooth. Each trigger spawns a fresh BufferSource so consecutive ticks can
// overlap freely — at fast scroll they pile up into the "trrrrr" ratchet
// of a real running projector. Slight pitch + gain jitter per hit avoids
// the robotic sound of a looping sample.
class AudioKit {
  constructor() {
    this.muted = false;
    this.unlocked = false;
    this.ctx = null;
    this.tickBuffer = null;
    this._lastTrigger = 0;
    this._bufferBytes = this._preload();
  }

  async _preload() {
    try {
      const res = await fetch('/audio/projector-tick.mp3');
      return await res.arrayBuffer();
    } catch { return null; }
  }

  // Call on first user gesture to satisfy browser autoplay policy.
  async unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('[audio] no AudioContext support'); return; }
      this.ctx = new AC();
      // Some browsers start the context suspended even after a user
      // gesture. Resume explicitly.
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const bytes = await this._bufferBytes;
      if (!bytes) { console.warn('[audio] preload returned null'); return; }
      this.tickBuffer = await this.ctx.decodeAudioData(bytes.slice(0));
      this.unlocked = true;
    } catch (e) {
      console.warn('[audio] unlock failed', e);
    }
  }

  start() { this.unlock(); } // alias for existing call sites

  snap() {
    if (!this.unlocked || this.muted || !this.tickBuffer || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Rate cap — max ~28 Hz (36 ms between hits). Keeps the ratchet
    // audible without piling up into a continuous hum at fast scroll.
    if (now - this._lastTrigger < 0.036) return;
    this._lastTrigger = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.tickBuffer;
    // Darker playback pitch — real projector motor territory. Mild jitter
    // keeps the mechanical unevenness without feeling robotic.
    src.playbackRate.value = 0.70 + Math.random() * 0.14;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07 + Math.random() * 0.03;
    src.connect(gain).connect(this.ctx.destination);
    src.start(now);
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
    // Locked = a scripted reel performance is running. Suspends the
    // bend-velocity update + predictive magnet so the cylinder does not
    // fight GSAP while the selected frame is being performed.
    this.locked = false;
    this.frame = 0;
    this.lastTooth = 0;
    this.lastInputTime = 0;
    // Cursor parallax state
    this.mouseX = 0; this.mouseY = 0;
    this.parallaxX = 0; this.parallaxY = 0;
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
      this._createPond();
      this._createTextPlane();
      this._buildRadar();
      this.listen();
      if (DEBUG_UI) this.initGUI();
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
    // Load all 22 as ImageBitmaps (preserves source colorspace, no sRGB clipping),
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

    // Precompute a vibrant dominant color per frame, used as the ambient
    // tint for the ASCII pond. Each frame has its own signature palette
    // (warm for sunsets, cool for night frames, green for the tennis
    // courts, etc.) without making the image recognizable. Averages each
    // bitmap at 20px then pushes saturation away from luminance for punch.
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
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Saturation boost dialled back — Codrops-restrained editorial color.
      // 1.7 was too vibrant on warm/red frames; 1.05 keeps subtle hue
      // identity per frame without ever shouting.
      const boost = 1.05;
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
        uExposure: { value: params.exposure },
        uBrightness: { value: params.brightness },
        uContrast: { value: params.contrast },
        uSaturation: { value: params.saturation },
        uVignette: { value: params.vignetteStrength },
        uFocusStrength: { value: params.focusStrength },
        uOpacity: { value: 1.0 },
        uTwist: { value: 0.0 },
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
      if (this.introActive || this.locked) return;
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
      if (this.introActive || this.locked) return;
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
      // If barely moved + quick: treat as frame selection.
      // Looser threshold accommodates finger taps (bigger contact area, slight jitter)
      if (dx < 10 && dy < 10 && dt < 450 && !this.locked && !this.introActive) {
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

    // Escape cancels the reel run.
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._autoplayActive) {
        this._stopAutoplay();
      }
      // ── DISCOVERED SECOND-STATE: SPACEBAR — auto-scroll the reel ──
      //   Hold/tap SPACE to fly through the entire 22-frame catalog
      //   in 3.5s. Velocity stays high during autoplay so the cinematic
      //   ASCII stripes fire continuously — the rig "running" at full
      //   tilt, end to end. Press SPACE again or ESC to cancel.
      if (e.code === 'Space' && !this.locked && !this.introActive
          && !this._autoplayActive && !this.dragging) {
        e.preventDefault();
        this._startAutoplay();
      } else if (e.code === 'Space' && this._autoplayActive) {
        e.preventDefault();
        this._stopAutoplay();
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

      // Resize The Pond plane to match the viewport. uCellSize stays
      // fixed at 14px so glyph density reads consistently across sizes.
      if (this.asciiMesh) {
        const z = -2.5;
        const dist = CAMERA_Z - z;
        const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const visW = visH * this.camera.aspect;
        this.asciiMesh.geometry.dispose();
        this.asciiMesh.geometry = new THREE.PlaneGeometry(visW, visH);
        this.asciiMaterial.uniforms.uResolution.value.set(w, h);
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
    if (this.locked) {
      // Detail is open — fast-decay any residual bend so the cylinder
      // visibly freezes flat. GSAP also tweens smoothBend to 0 in the
      // splice; this fast-decay is the safety net for the frames
      // before the GSAP tween catches up.
      this.smoothBend *= 0.78;
      if (this.smoothBend < 0.001) this.smoothBend = 0;
    } else {
      this.smoothBend += (Math.min(vel * params.bendSensitivity, 1) - this.smoothBend) * params.bendSmoothing;
    }

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
      this.audio.snap();
    } else if (currentTooth !== this.lastTooth) {
      // Silent catch-up during momentum decay — no flash, no click
      this.lastTooth = currentTooth;
    }
    const u = this.material.uniforms;
    u.uProgress.value = this.scroll;
    u.uBend.value = finalBend;
    u.uTime.value = (performance.now() - this.startTime) / 1000;
    // Live-bind look params so debug changes apply immediately.
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

    // ── THE POND — sync time, velocity, and tint ───────────────────
    //   Pure shader system; just feeds uniforms each frame.
    //   uVelocity drives wave amplitude, ripple speed, and glitch noise.
    //   uTint lerps between adjacent frames' dominant colors during scroll.
    if (this.asciiMaterial) {
      const u2 = this.asciiMaterial.uniforms;
      u2.uScroll.value = this.scroll;
      u2.uTime.value = u.uTime.value;

      // Velocity signal — smoothed scroll-delta magnitude.
      const asciiDelta = Math.abs(this.scroll - (this._asciiPrevScroll ?? this.scroll));
      this._asciiPrevScroll = this.scroll;
      this._asciiVel = (this._asciiVel || 0) * 0.82 + asciiDelta * 0.18;
      const velNorm = Math.min(this._asciiVel * 42, 1);
      u2.uVelocity.value = velNorm;

      // ── Resolution arc — the only animation in this layer.
      //   Photograph holds at rest; scroll loosens it slightly toward
      //   chaos (subtle character flicker), stillness recovers it.
      const resolvedTarget = Math.max(0.45, 1 - Math.min(velNorm * 1.0, 0.55));
      this._asciiResolved = (this._asciiResolved ?? 1)
                          + (resolvedTarget - (this._asciiResolved ?? 1)) * 0.10;
      u2.uResolved.value = this._asciiResolved;

      // Multi-exposure smear: tint is a Gaussian-weighted blend of the
      // 5 neighbor editions around the current scroll, spread widened
      // by velocity. At rest (vel≈0) the blend collapses to a single
      // continuous interpolation between the two adjacent frames.
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
    if (!this.dragging && !this.introActive && !this.locked) {
      const predicted = this.scrollTarget + (this._wheelVel || 0) * 400;
      const target = Math.round(predicted);
      this.scrollTarget += (target - this.scrollTarget) * 0.02;
    }

    // ── LIVE CLICK-ANIM PREVIEW ──────────────────────────────────────
    //   When clickParams.livePreview is on, the render loop applies the
    //   GUI's tuning values DIRECTLY to the cylinder mesh + uniforms
    //   every frame. The user drags a slider → cylinder morphs in
    //   real time. Toggle off to return to idle.
    if (clickParams.livePreview && !this._clickAnimating) {
      this.spliceBend = clickParams.bendPeak;
      this.material.uniforms.uTwist.value = clickParams.twistPeak;
      this.mesh.rotation.x = clickParams.rotationX;
      this.mesh.rotation.y = clickParams.rotationY;
      this.mesh.position.x = clickParams.positionX;
      this.mesh.position.y = clickParams.positionY;
      this.mesh.position.z = clickParams.positionZ;
      this.mesh.scale.x   = clickParams.scaleEnd;
      this.mesh.scale.y   = clickParams.scaleEnd;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── DISCOVERED SECOND-STATE: SPACE-driven autoplay ──────────────────
  //  Holding/tapping SPACE flies the cylinder through the entire 22-frame
  //  catalog in 3.5s. The cinematic ASCII stripes fire continuously
  //  during the run because we keep _asciiVel pegged high, so the rig
  //  visibly "runs the reel" end-to-end. On completion, it eases back
  //  to where the user was — no permanent state change. ESC or SPACE
  //  again cancels mid-flight. Easter-egg discoverable, dramatic when
  //  found.
  _startAutoplay() {
    if (this._autoplayActive) return;
    this._autoplayActive = true;
    const startScroll = this.scrollTarget;
    const target = startScroll + IMAGE_COUNT;
    this._autoplayTween = gsap.to(this, {
      scrollTarget: target,
      scroll: target,
      duration: 3.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        // Force the ASCII velocity high so the cinematic stripes burn
        // continuously through the reel — peak 'film passing' read.
        this._asciiVel = 0.022;
        this.lastInputTime = performance.now();
      },
      onComplete: () => {
        this._autoplayActive = false;
        this._autoplayTween = null;
      },
    });
  }
  _stopAutoplay() {
    if (!this._autoplayActive) return;
    if (this._autoplayTween) this._autoplayTween.kill();
    this._autoplayTween = null;
    this._autoplayActive = false;
    // Snap to the nearest integer frame so the rig settles cleanly.
    this.scrollTarget = Math.round(this.scrollTarget);
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
    //   silhouette rises · wheel spins 3 frames into place · text
    //   dissolves in. Shared ease + duration → single landing. The
    //   spin starts at scroll=-3 (centered on frame 22) and lands at
    //   scroll=0 (centered on frame 0, "Slow Burn"). Frames 22→23→24
    //   pass under the gate during the spin and each gets its Conway
    //   pattern stamped on the cellular field as it goes by — so the
    //   field is already populated by the time the cylinder lands.
    // ─────────────────────────────────────────────────────────────────
    const vp = this.viewport();
    const arriveDur = 1.2;
    const arriveEase = 'power3.out';

    // Pre-rotate before the timeline runs. checkFrame() will catch up
    // on the very first render-loop tick, stamping the starting frame.
    this.scroll = -3;
    this.scrollTarget = -3;

    tl.to(this.mesh.position, {
      y: -vp.h * 0.7,
      duration: arriveDur,
      ease: arriveEase,
    }, '-=0.1');

    tl.to(this, {
      scroll: 0,
      scrollTarget: 0,
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

    // ── INTRO HIT ──────────────────────────────────────────────────
    //   The moment the cylinder lands at center, fire a synchronized
    //   beat: cinematic ASCII stripe burst + a louder audio click.
    //   ~0.3s, locked. Sets the rig's tone
    //   in the first impression — "this thing is alive."
    tl.add(() => {
      // Spike the ASCII velocity so the cinematic film stripes
      // burst across the layer for one brief moment, then fade out
      // naturally as the spike decays.
      this._asciiVel = 0.18;
      // Audio sting — only fires after the user gesture has unlocked
      // the audio context. On first-load this may be silent until the
      // user clicks; after that, every reload's intro hit lands.
      this.audio.snap();
    }, 'hero+=0.95');

    // Chrome reveals on the wheel's deceleration tail — gentle staircase
    tl.to('.navbar',        { opacity: 1,    duration: 0.4, ease: 'power2.out' }, 'hero+=0.55');
    // counter is inside navbar now — revealed together
    tl.to('.slide-info, .frame__meta, .hero-tech', { opacity: 1, duration: 0.4, ease: 'power2.out' }, 'hero+=0.7');
    tl.to('.viewfinder', { opacity: 1, duration: 0.45, ease: 'power2.out' }, 'hero+=0.9');
    // Instrument panel fades in on the deceleration tail alongside the rest
    // of the chrome — already pre-seeded with frame 0 so no value roll.
    tl.to('.instrument', { opacity: 1, duration: 0.6, ease: 'power2.out' }, 'hero+=0.75');

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

  // ── THE GRAIN ─────────────────────────────────────────────────────
  //  Sparse `·` glyphs scattered across the viewport on an 18px grid.
  //  Hash-selected so ~45% of cells are empty — irregular distribution,
  //  not a wallpaper. Renders in the current frame's dominant color.
  //
  //  AT REST: completely static. No drift, no shimmer, no waves. Just
  //  scattered dots at low alpha, almost subliminal. The film is the
  //  focal point; the grain is texture.
  //
  //  ON SCROLL: the field doesn't wave. It CRACKLES. Cells near the
  //  center start flickering — some go dark (dropouts), some pop into
  //  a denser '+' for one frame (glitch sparks). Chaos peaks at the
  //  center and falls off exponentially toward the edges. No periodic
  //  motion, no clean math — pure noise-driven turbulence localized
  //  where the projector gate sits.
  // ─────────────────────────────────────────────────────────────────────
  _createPond() {
    // 10-glyph density ramp — original ASCII palette from the last
    // committed version. Characters increase in density left-to-right.
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
        // white. Consistent across all editions; the storm reads as
        // "the rig speaking" rather than arbitrary decoration.
        uYellow:     { value: new THREE.Vector3(0.72, 0.58, 0.30) },
        uWhite:      { value: new THREE.Vector3(0.82, 0.78, 0.72) },
        uVelocity:   { value: 0 },
        // 0 = chaos, 1 = crystallized photograph. Lerps gently with velocity.
        uResolved:   { value: 1 },
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
        uniform float uResolved;     // 0 = chaos, 1 = photograph crystallized
        varying vec2 vUv;

        #define COLS ${ATLAS_COLS}.0
        #define ROWS ${ATLAS_ROWS}.0
        #define N ${IMAGE_COUNT}.0

        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          // ─── CELL LAYOUT ────────────────────────────────────────────
          vec2 px = vUv * uResolution;
          vec2 cellIdx = floor(px / uCellSize);
          vec2 cellCenterPx = (cellIdx + 0.5) * uCellSize;
          vec2 imgUV = cellCenterPx / uResolution;

          // ─── ATLAS SAMPLE: photograph at this cell ──────────────────
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

          // Resolution arc only — no wave, no shape, no shockwave.
          // The photograph holds at rest; scroll loosens it slightly
          // toward chaos. That's the entire effect.
          float resolved = uResolved;
          float chaos = 1.0 - resolved;

          // ─── IDLE BREATH + CHAOS-MODULATED ANIMATION ────────────────
          //   Shimmer / grain / scanline ride on chaos so they vanish
          //   when the field is fully resolved (still photograph) and
          //   surge during chaos (scroll).
          float phase = hash12(cellIdx) * 6.2831;
          float shimAmp = 0.024 + chaos * 0.10;
          float shimmer = sin(uTime * (1.1 + chaos * 1.8) + phase) * shimAmp;
          float grainPulse = (hash12(cellIdx + fract(uTime * 3.1)) - 0.5) * chaos * 0.22;
          float scanPos = fract(uTime * (0.06 + chaos * 0.30));
          float scan = exp(-pow((vUv.y - (1.0 - scanPos)) * 5.8, 2.0)) * (0.10 + chaos * 0.16);
          lum = clamp(lum + shimmer + scan + grainPulse, 0.0, 1.0);

          // Luminance → glyph index along the density ramp.
          float resolvedGlyph = floor(lum * (uNumChars - 0.001));

          // ─── CHARACTER COLLAPSE ─────────────────────────────────────
          //   During chaos, cells swap their luminance glyph for a
          //   random one from the density ramp. The fraction of cells
          //   that scramble scales with chaos. Wave-band cells are
          //   pulled BACK toward their resolved glyph so the wave
          //   visibly clears chaos as it passes.
          float gTick = floor(uTime * 18.0);
          float chaosGlyph = floor(hash12(cellIdx + vec2(gTick, 13.0)) * uNumChars);
          float swapSeed = hash12(cellIdx + vec2(gTick, 0.0));
          float swapAmount = chaos * 0.65;
          float useChaos = step(1.0 - swapAmount, swapSeed);
          float charIdx = mix(resolvedGlyph, chaosGlyph, useChaos);

          // Sample glyph atlas at cell-local UV.
          vec2 localUV = fract(px / uCellSize);
          vec2 charUV = vec2((charIdx + localUV.x) / uNumChars, localUV.y);
          float glyph = texture2D(uCharAtlas, charUV).r;

          // ─── COLOR ──────────────────────────────────────────────────
          //   Per-frame tint, slight chaos-driven drift toward the
          //   storm palette. No wave-band brightening.
          //   bloom. Just a calm photograph in characters.
          float cellHash = hash12(cellIdx * 0.73 + 11.3);
          vec3 stormTint = mix(uYellow, uWhite, step(0.5, cellHash));
          float stormMix = chaos * 0.20;
          vec3 cellTint  = mix(uTint, stormTint, stormMix);

          vec3 shadow    = cellTint * 0.10;
          vec3 highlight = mix(cellTint, vec3(1.0), 0.14);
          vec3 rgb = mix(shadow, highlight, lum);

          // ─── FILM PASSING — cinematic scale ─────────────────────────
          //   Big slow stripes of light scrolling upward through the
          //   ASCII layer. Reads as frames of light passing through the
          //   projector gate, not a technical scanline pattern. Layered:
          //
          //   1. ONLY ~1.4 STRIPES per viewport so each stripe is
          //      enormous — a deliberate beam, not a comb.
          //
          //   2. SLOW DELIBERATE RATE — half the previous speed. Real
          //      film moves slowly through the gate; the eye should
          //      track each stripe as it climbs.
          //
          //   3. SOFT FALLOFF — wide Gaussian band so stripes bleed
          //      into each other at the edges. Halation, not hard
          //      lines.
          //
          //   4. DRAMATIC BRIGHTNESS — per-stripe intensity range
          //      0.10 – 1.00. Some stripes are nearly black (under-
          //      exposed frames), others glow (light leaks). Real
          //      cinema lives in this contrast.
          //
          //   5. CENTER VIGNETTE — stripes are brightest in the middle
          //      of the viewport, fade toward top/bottom edges. The
          //      projector beam is focused; the edges fall to shadow.
          //
          //   6. WARM/COOL DRIFT — each stripe shifts the tint slightly
          //      warmer or cooler. Color temperature variation between
          //      film stock frames. Subtle, atmospheric.
          //
          //   7. GATE WEAVE — mechanical horizontal wobble, kept small.
          //
          //   8. RATE BREATH — slow sinusoidal speed variation.

          float filmGate = smoothstep(0.30, 0.75, uVelocity);

          // Slow rate with breath — half the previous speed.
          float filmRate = uTime * (0.42 + sin(uTime * 0.23) * 0.06);
          float stripeF = vUv.y * 1.4 - filmRate;
          float stripeIdx = floor(stripeF);
          float filmPos = fract(stripeF);

          // Per-stripe brightness — dramatic range. Some stripes nearly
          // dark, some glowing.
          float stripeBright = 0.10 + hash12(vec2(stripeIdx, 11.0)) * 0.90;

          // Per-stripe color temperature drift — warmer or cooler hue
          // shift. Range −0.20 (cool) to +0.20 (warm) on the R/B axis.
          float stripeTemp = (hash12(vec2(stripeIdx, 23.0)) - 0.5) * 0.40;
          vec3 tempShift = vec3(stripeTemp * 0.8, stripeTemp * 0.1, -stripeTemp * 0.7);

          // Small mechanical weave.
          float weave = sin(stripeIdx * 7.3 + uTime * 4.0) * 0.03;
          float peak = 0.5 + weave;

          // Wide soft Gaussian — stripes bleed into one another.
          float filmStripe = exp(-pow((filmPos - peak) * 2.4, 2.0));

          // Center vignette — brightest in the vertical middle of the
          // viewport, fades toward top/bottom edges.
          float vignette = 1.0 - smoothstep(0.0, 0.55, abs(vUv.y - 0.5));
          vignette = pow(vignette, 0.85);

          float filmAmt = filmStripe * filmGate * stripeBright * vignette;
          // Brightness lift + color temperature drift.
          rgb += (uTint + tempShift) * filmAmt * 0.55;

          // Halation — the brightest stripes glow softly into neighbors.
          // A wider, dimmer Gaussian on top of the main stripe carries
          // the bloom past the stripe's edge.
          float halation = exp(-pow((filmPos - peak) * 1.1, 2.0));
          rgb += uTint * halation * filmGate * stripeBright * 0.18 * vignette;

          // Frame line — thin DARK seam where stripes meet. Subtle —
          // anchors the rhythm.
          float frameLineDist = min(filmPos, 1.0 - filmPos);
          float frameLine = exp(-pow(frameLineDist * 60.0, 2.0)) * filmGate * vignette;
          rgb -= cellTint * frameLine * 0.55;

          // ─── ALPHA ──────────────────────────────────────────────────
          //   Quiet at rest. Film stripes lift alpha in their bands —
          //   the bright frame is visibly more present than the dim
          //   stripes around it. Halation contributes to neighboring
          //   alpha so the bloom reads soft, not stamped.
          float alpha = glyph * uActive *
                        (0.22 + filmAmt * 0.55 + halation * filmGate * stripeBright * 0.18 * vignette);

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

  // ── Debug pane: opt-in with ?debug ────────────────────────────────
  async initGUI() {
    const { Pane } = await import('tweakpane');
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

    // ── CLICK ANIMATION CONTROLS ─────────────────────────────────────
    //   Live preview: drag sliders → cylinder morphs in real time.
    //   Trigger: fires the animation on the centered frame.
    const clickFold = pane.addFolder({ title: 'Click anim', expanded: true });
    clickFold.addBinding(clickParams, 'livePreview', { label: '⚡ live preview' })
      .on('change', (e) => {
        if (!e.value) {
          // Snap back to idle when preview is turned off.
          this.spliceBend = 0;
          this.material.uniforms.uTwist.value = 0;
          this.mesh.rotation.set(0, 0, 0);
          this.mesh.position.set(0, 0, 0);
          this.mesh.scale.set(1, 1, 1);
          this.material.uniforms.uOpacity.value = 1;
        }
      });
    clickFold.addBlade({ view: 'separator' });
    clickFold.addBinding(clickParams, 'rollFrames',      { min: 0, max: 5,    step: 0.5,  label: 'roll frames' });
    clickFold.addBinding(clickParams, 'rollDuration',    { min: 0, max: 2,    step: 0.05, label: 'roll dur (s)' });
    clickFold.addBlade({ view: 'separator' });
    clickFold.addBinding(clickParams, 'bendPeak',        { min: 0, max: 2,    step: 0.05, label: 'bend peak' });
    clickFold.addBinding(clickParams, 'twistPeak',       { min: 0, max: 2.5,  step: 0.05, label: 'twist peak' });
    clickFold.addBinding(clickParams, 'unspoolDuration', { min: 0.2, max: 4,  step: 0.1,  label: 'unspool dur' });
    clickFold.addBlade({ view: 'separator' });
    clickFold.addBinding(clickParams, 'rotationY',       { min: -2, max: 2,   step: 0.05, label: 'rotation Y' });
    clickFold.addBinding(clickParams, 'rotationX',       { min: -1.5, max: 1.5, step: 0.05, label: 'rotation X' });
    clickFold.addBlade({ view: 'separator' });
    clickFold.addBinding(clickParams, 'positionZ',       { min: -6, max: 4,   step: 0.1,  label: 'position Z' });
    clickFold.addBinding(clickParams, 'positionY',       { min: -2, max: 2,   step: 0.05, label: 'position Y' });
    clickFold.addBinding(clickParams, 'positionX',       { min: -2, max: 2,   step: 0.05, label: 'position X' });
    clickFold.addBinding(clickParams, 'scaleEnd',        { min: 0.05, max: 2, step: 0.05, label: 'scale end' });
    clickFold.addBinding(clickParams, 'recedeDuration',  { min: 0.2, max: 4,  step: 0.1,  label: 'recede dur' });
    clickFold.addBlade({ view: 'separator' });
    clickFold.addBinding(clickParams, 'fadeOutStart',    { min: 0, max: 4,    step: 0.05, label: 'fade start' });
    clickFold.addBinding(clickParams, 'fadeOutDuration', { min: 0.05, max: 2, step: 0.05, label: 'fade dur' });
    clickFold.addBinding(clickParams, 'reformDelay',     { min: 0, max: 2,    step: 0.05, label: 'reform delay' });
    clickFold.addBinding(clickParams, 'reformDuration',  { min: 0.05, max: 2, step: 0.05, label: 'reform dur' });
    clickFold.addBlade({ view: 'separator' });

    // Trigger button — fires the animation on the currently-centered
    // frame. Won't double-fire if one's already running.
    clickFold.addButton({ title: 'Trigger animation' }).on('click', () => {
      if (this._clickAnimating) return;
      const f = this.frame;
      playFrameClickAnim(this, f);
    });

    // Toggle pane visibility with 'D' when the debug pane is enabled.
    const paneEl = document.querySelector('.tp-dfwv');
    window.addEventListener('keydown', e => {
      if (e.key === 'd' || e.key === 'D') {
        paneEl?.classList.toggle('hidden');
      }
    });
  }

  // ── Helper for debug strip rebinding ──
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

// ── FRAME-CLICK ANIMATION (in place — film unspools as a helix) ───────
//   All values read from clickParams so live GUI changes affect the
//   next click immediately. The strip is film: it bends, twists into
//   a helix, tilts to show 3D depth, recedes into the scene, fades,
//   then reforms.
function playFrameClickAnim(slider, frame) {
  if (slider._clickAnimating) return;
  slider._clickAnimating = true;
  slider.locked = true;
  slider._wheelVel = 0;

  const cp = clickParams;
  const N = IMAGE_COUNT;
  const cur = slider.scroll;
  const k = Math.round((cur - frame) / N);
  const targetScroll = k * N + frame;

  // Phase timing math — derived from clickParams so the GUI sliders
  // affect everything coherently.
  const tRoll       = 0;
  const tUnspool    = cp.rollDuration * 0.50;        // overlaps with roll
  const tRecede     = tUnspool + 0.10;
  const tFadeOut    = cp.fadeOutStart;
  const tFadeEnd    = tFadeOut + cp.fadeOutDuration;
  const tReform     = tFadeEnd + cp.reformDelay;

  const tl = gsap.timeline({
    onComplete: () => {
      slider._clickAnimating = false;
      slider.locked = false;
    },
  });

  // ─── PHASE 1: ROLL ──────────────────────────────────────────────
  tl.to(slider, {
    scroll: targetScroll + cp.rollFrames,
    scrollTarget: targetScroll + cp.rollFrames,
    duration: cp.rollDuration,
    ease: 'power2.out',
  }, tRoll);

  // ─── PHASE 2: UNSPOOL — bend + twist climb ─────────────────────
  tl.to(slider, {
    spliceBend: cp.bendPeak,
    duration: cp.unspoolDuration,
    ease: 'power2.in',
  }, tUnspool);
  tl.to(slider.material.uniforms.uTwist, {
    value: cp.twistPeak,
    duration: cp.unspoolDuration,
    ease: 'power2.in',
  }, tUnspool);

  // ─── PHASE 2b: 3D angle ────────────────────────────────────────
  tl.to(slider.mesh.rotation, {
    y: cp.rotationY,
    x: cp.rotationX,
    duration: cp.unspoolDuration + 0.20,
    ease: 'power2.in',
  }, tUnspool);

  // ─── PHASE 2c: Recede into depth ───────────────────────────────
  tl.to(slider.mesh.position, {
    z: cp.positionZ,
    y: cp.positionY,
    x: cp.positionX,
    duration: cp.recedeDuration,
    ease: 'power2.in',
  }, tRecede);
  tl.to(slider.mesh.scale, {
    x: cp.scaleEnd,
    y: cp.scaleEnd,
    duration: cp.recedeDuration,
    ease: 'power2.in',
  }, tRecede);

  // ─── PHASE 3: FADE OUT ─────────────────────────────────────────
  tl.to(slider.material.uniforms.uOpacity, {
    value: 0,
    duration: cp.fadeOutDuration,
    ease: 'power2.in',
  }, tFadeOut);

  // ─── PHASE 4: REFORM ───────────────────────────────────────────
  tl.add(() => {
    slider.scroll = targetScroll;
    slider.scrollTarget = targetScroll;
    slider.spliceBend = 0;
    slider.material.uniforms.uTwist.value = 0;
    slider.mesh.rotation.set(0, 0, 0);
    slider.mesh.position.set(0, 0, 0);
    slider.mesh.scale.set(1, 1, 1);
  }, tReform);
  tl.to(slider.material.uniforms.uOpacity, {
    value: 1,
    duration: cp.reformDuration,
    ease: 'power2.out',
  }, tReform);
}

// ── Bootstrap ────────────────────────────────────────────────────

const slider = new WheelSlider();

// Frame selection is a brand-showroom gesture: the reel acknowledges the
// picked image physically, then reforms around it.
slider.onFrameClick = (f) => {
  if (slider._clickAnimating) return;
  playFrameClickAnim(slider, f);
};

// ── STUDIO SLATE wiring ─────────────────────────────────────────────
//   Reel → fires the SPACE-style autoplay through the reel
//   Studio → opens the MAWZE studio thesis / waitlist slate
//   ESC + click outside the inner column + close button all close it.
const slate = document.getElementById('about-slate');
const slateInner = slate?.querySelector('.slate__inner');
const slateClose = document.getElementById('slate-close');
function openSlate() {
  if (!slate) return;
  slate.setAttribute('aria-hidden', 'false');
  slate.classList.add('open');
}
function closeSlate() {
  if (!slate) return;
  slate.setAttribute('aria-hidden', 'true');
  slate.classList.remove('open');
}
document.addEventListener('click', (e) => {
  const studioLink = e.target.closest('[data-action="studio"]');
  const reelLink = e.target.closest('[data-action="autoplay"]');
  if (studioLink) {
    e.preventDefault();
    openSlate();
    return;
  }
  if (reelLink) {
    e.preventDefault();
    if (slider.locked) return;
    slider._startAutoplay();
    return;
  }
});
slateClose?.addEventListener('click', closeSlate);
slate?.addEventListener('click', (e) => {
  if (slateInner && !slateInner.contains(e.target) && e.target !== slateClose) {
    closeSlate();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && slate?.classList.contains('open')) {
    closeSlate();
  }
});

// Retire old frame deep links cleanly now that the reel is the primary page.
if (/^\/frame\/\d{1,2}\/?$/.test(location.pathname)) {
  history.replaceState({}, '', '/');
}
