import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Pane } from 'tweakpane';

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
  scrollSmoothing: 0.11,
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
    vec3 base = vec3(0.04) + (hash(floor(vUv * 300.0)) - 0.5) * 0.01;
    float bs = (1.0 - vUv.y) * numSlots
      + uProgress * (vUv.x < 0.5 ? 1.12 : 0.88) - numSlots * 0.5 + 0.5;
    float hs = 1.0 / uSprockets;
    float dy = mod(bs + hs*0.5, hs) - hs*0.5;
    float bc = vUv.x < 0.5 ? bw*0.5 : 1.0-bw*0.5;
    float nx = (vUv.x-bc)/(bw*0.42);
    float ca = bw/(hs*uSlotH);
    vec2 hp = vec2(nx, (dy/hs)*2.0/max(ca,0.1));
    float hole = 1.0-smoothstep(-0.06,0.06,sdRoundBox(hp,vec2(0.52,0.45),0.2));
    float mdy = mod(bs,hs)-hs*0.5;
    vec2 mp = vec2(nx,(mdy/hs)*2.0/max(ca,0.1));
    float cross = max(step(abs(mp.x),0.07)*step(abs(mp.y),0.22),
                      step(abs(mp.x),0.22)*step(abs(mp.y),0.07));
    vec3 col = mix(base,vec3(0.15,0.35,0.12),cross*0.7);
    col = col*cylShade + grain - uGrain*0.5;
    gl_FragColor = vec4(col, alpha*(1.0-hole));
    return;
  }

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

  // Film grade intensifies with scroll velocity
  color.rgb = mix(color.rgb, filmGrade(color.rgb), mix(uFilmBase, uFilmStrength, uBend));
  color.rgb *= cylShade;
  color.rgb += grain - uGrain * 0.5;

  float vx = smoothstep(0.0,0.06,u)*smoothstep(1.0,0.94,u);
  float vy = smoothstep(0.0,0.04,lv)*smoothstep(1.0,0.96,lv);
  color.rgb *= mix(1.0, vx*vy, uVignette);

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
    this.counterEl = document.getElementById('frame-counter');
    this.exposureEl = document.getElementById('exposure-label');
    this.bgNumEl = document.getElementById('bg-number');

    this.scroll = 0;
    this.scrollTarget = 0; // free-running float — no snap; arrows re-integer it
    this.smoothBend = 0;
    this.dragging = false;
    this.introBend = 1;   // 1 = fully cylinder at start
    this.introActive = true;
    this.frame = 0;
    this.lastTooth = 0;
    this.shutterFlash = 0;
    this.lastInputTime = 0;
    // Cursor parallax state
    this.mouseX = 0; this.mouseY = 0;
    this.parallaxX = 0; this.parallaxY = 0;
    this.peekOpen = false;
    this.startTime = performance.now();
    this.audio = new AudioKit();
    this.loadPct = 0;

    // Apply viewport-adaptive defaults before creating geometry/camera
    Object.assign(params, responsiveStripParams());
    this.initScene();
    // Wait for textures + loader + the serif font (canvas needs it for crisp text)
    Promise.all([
      this.loadTextures(),
      this._runLoader(),
      document.fonts.load('400 400px "Bulevar"').catch(() => {}),
    ]).then(() => {
      this.createStrip();
      this._createTextPlane();
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

    // Wheel: free-scroll — delta goes straight to target, loop lerps. No snap.
    window.addEventListener('wheel', e => {
      if (this.introActive || this.peekOpen) return;
      this.audio.start();
      const pY = normalizeWheel(e);
      this.scrollTarget += pY * 0.0045;
      this.lastInputTime = performance.now();
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
      if (dx < 10 && dy < 10 && dt < 450 && !this.peekOpen) {
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

        this.openPeek(f);
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

    document.getElementById('next-btn').addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) + 1;
    });
    document.getElementById('prev-btn').addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) - 1;
    });

    // Peek close handlers
    document.getElementById('peek-close')?.addEventListener('click', () => this.closePeek());
    document.querySelector('.peek__backdrop')?.addEventListener('click', () => this.closePeek());
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.peekOpen) this.closePeek();
    });

    const onResize = () => {
      // Re-apply viewport-adaptive params
      Object.assign(params, responsiveStripParams());

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
    const finalBend = Math.max(this.smoothBend, this.introBend);

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

    // Cursor parallax — smoothed tilt based on mouse position
    this.parallaxX += (this.mouseX - this.parallaxX) * 0.06;
    this.parallaxY += (this.mouseY - this.parallaxY) * 0.06;
    if (this.mesh) {
      // Subtle rotation: up to ~3° each axis
      this.mesh.rotation.y = this.parallaxX * 0.05;
      this.mesh.rotation.x = -this.parallaxY * 0.03;
    }

    this.checkFrame();
    this.renderer.render(this.scene, this.camera);
  }

  // ── Hero sequence ──
  // Loader fades → text uniform tweens 0→1 (shader dissolves text in via fbm
  // noise) → hold → uniform 1→2 (shader dissolves text out) → bg brown→beige
  // → film rises → chrome reveals. Text animation lives in GLSL; GSAP only
  // nudges a single uniform value.
  enter() {
    this.introBend = 1.0;

    this.titleEl.innerHTML = TITLES[0];
    this.bgNumEl.textContent = '01';
    this.counterEl.textContent = '001 — 025';
    this.exposureEl.textContent = 'Exposure 001';

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

    // Flip to "daylight" — CSS transition handles the bg + chrome text colors
    // together via a class (more robust than tweening inline style, especially
    // on mobile where backgroundColor tweens can fail to commit visually).
    tl.add(() => document.body.classList.add('daylight'), 'hold');

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
    tl.to('#bg-number',     { opacity: 0.05, duration: 0.6, ease: 'power2.out' }, 'hero+=0.4');
    tl.to('.navbar',        { opacity: 1,    duration: 0.4, ease: 'power2.out' }, 'hero+=0.55');
    // counter is inside navbar now — revealed together
    tl.to('.frame__bottom', { opacity: 1,    duration: 0.4, ease: 'power2.out' }, 'hero+=0.7');
    tl.to('.nav-buttons',   { opacity: 1,    duration: 0.4, ease: 'power2.out' }, 'hero+=0.75');
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

  // Peek — opens a fullscreen projected view of the current centered frame
  // Accepts an explicit frame index (from raycast click). Falls back to
  // the currently-centered frame if not provided.
  openPeek(forceFrame) {
    const peek = document.getElementById('peek');
    if (!peek) return;
    this.peekOpen = true;

    let f;
    if (typeof forceFrame === 'number') {
      f = forceFrame;
    } else {
      // Mirror shader center formula: scrollV at vUv.y=0.5 = scroll + 0.5
      const s = this.scroll + 0.5;
      const raw = ((s % IMAGE_COUNT) + IMAGE_COUNT) % IMAGE_COUNT;
      f = Math.floor(raw) % IMAGE_COUNT;
    }

    document.getElementById('peek-image').src = IMAGE_PATHS[f];
    document.getElementById('peek-title').textContent = TITLES[f].replace(/<br\s*\/?>/gi, ' ');
    document.getElementById('peek-index').textContent =
      `${String(f + 1).padStart(3, '0')} / ${String(IMAGE_COUNT).padStart(3, '0')}`;
    peek.classList.add('open');
    this.audio.snap();
  }

  closePeek() {
    const peek = document.getElementById('peek');
    if (!peek) return;
    this.peekOpen = false;
    peek.classList.remove('open');
  }

  // Title swap: instant — stays readable during fast scroll, no overlap artifacts
  swapTitle(html) {
    this.titleEl.innerHTML = html;
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
    this.swapTitle(TITLES[f]);
    this.exposureEl.textContent = `Exposure ${num}`;
    this.counterEl.textContent = `${num} — ${String(IMAGE_COUNT).padStart(3, '0')}`;
    this.bgNumEl.textContent = String(f + 1).padStart(2, '0');
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

new WheelSlider();
