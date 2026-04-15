import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Pane } from 'tweakpane';

const IMAGE_PATHS = Array.from({ length: 8 }, (_, i) => `/images/slide-${i + 1}.png`);
const IMAGE_COUNT = 8;
const FOV = 50;
const CAMERA_Z = 5;

const TITLES = [
  'The Card<br/>Players',
  'The<br/>Reader',
  'Saturn\'s<br/>Table',
  'The<br/>Dreamer',
  'The<br/>Feast',
  'Night<br/>Curtain',
  'Still<br/>Life',
  'Red Moon<br/>Rising',
];


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
  filmStrength: 1.0,
  filmBaseStrength: 0,
  grainAmount: 0.15,
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

uniform sampler2D tex0, tex1, tex2, tex3, tex4, tex5, tex6, tex7;
uniform float uProgress, uBend, uSlotH, uFilmStrength, uFilmBase;
uniform float uShadeExponent, uTime, uGrain, uBorderW, uSprockets, uShutter;
varying vec2 vUv;
varying float vNDotV;

vec4 sampleImage(int i, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  if (i==0) return texture2D(tex0,uv); if (i==1) return texture2D(tex1,uv);
  if (i==2) return texture2D(tex2,uv); if (i==3) return texture2D(tex3,uv);
  if (i==4) return texture2D(tex4,uv); if (i==5) return texture2D(tex5,uv);
  if (i==6) return texture2D(tex6,uv); if (i==7) return texture2D(tex7,uv);
  return vec4(0.0);
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
  float w = mod(scrollV, 8.0);
  int idx = int(floor(w));
  float lv = fract(w);

  vec4 color = sampleImage(idx, vec2(u, 1.0 - lv));
  // Film grade intensifies with scroll velocity
  color.rgb = mix(color.rgb, filmGrade(color.rgb), mix(uFilmBase, uFilmStrength, uBend));
  color.rgb *= cylShade;
  color.rgb += grain - uGrain * 0.5;
  // Shutter flash removed — was causing visible pulsing

  float vx = smoothstep(0.0,0.06,u)*smoothstep(1.0,0.94,u);
  float vy = smoothstep(0.0,0.04,lv)*smoothstep(1.0,0.96,lv);
  color.rgb *= mix(1.0, vx*vy, 0.25);

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
    this.scrollTarget = 0;
    this.smoothBend = 0;
    this.momentum = 0;
    this.dragging = false;
    this.dragVelocity = 0;
    this.introBend = 1;   // 1 = fully cylinder at start
    this.introActive = true;
    this.frame = 0;
    this.lastTooth = 0;
    this.shutterFlash = 0;
    this.lastInputTime = 0;
    this.transitioning = false;
    this.startTime = performance.now();
    this.audio = new AudioKit();

    this.initScene();
    this.loadTextures().then(() => {
      this.createStrip();
      this.listen();
      this.enter();
      this.initGUI();
      this.loop();
    });
  }

  initScene() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100);
    this.camera.position.z = CAMERA_Z;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
  }

  viewport() {
    const h = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 2;
    return { w: h * this.camera.aspect, h };
  }


  async loadTextures() {
    const loader = new THREE.TextureLoader();
    this.textures = await Promise.all(IMAGE_PATHS.map(src =>
      new Promise(r => loader.load(src, t => {
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        r(t);
      }, undefined, () => r(null)))
    ));
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
        tex0: { value: this.textures[0] }, tex1: { value: this.textures[1] },
        tex2: { value: this.textures[2] }, tex3: { value: this.textures[3] },
        tex4: { value: this.textures[4] }, tex5: { value: this.textures[5] },
        tex6: { value: this.textures[6] }, tex7: { value: this.textures[7] },
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
      },
    });

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph, 32, 164),
      this.material
    );
    this.scene.add(this.mesh);
  }

  listen() {
    // ── Wheel: adds to momentum, not directly to target ──
    window.addEventListener('wheel', e => {
      if (this.introActive) return;
      this.audio.start();
      this.momentum += e.deltaY * 0.0009;
      this.momentum = Math.max(-0.3, Math.min(0.3, this.momentum));
      this.lastInputTime = performance.now();
    }, { passive: true });

    // ── Pointer drag (mouse + touch unified) ──
    let lastY = 0, lastTime = 0;

    const startDrag = (y) => {
      if (this.introActive) return;
      this.audio.start();
      this.dragging = true;
      this.momentum = 0;
      this.dragVelocity = 0;
      lastY = y;
      lastTime = performance.now();
      document.body.style.cursor = 'grabbing';
    };

    const moveDrag = (y) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);
      const dy = lastY - y;
      this.scrollTarget += dy * 0.0055;
      this.lastInputTime = performance.now();
      // EMA velocity: smooth & recent-biased
      const v = (dy / dt) * 16;
      this.dragVelocity = this.dragVelocity * 0.4 + v * 0.6;
      lastY = y;
      lastTime = now;
    };

    const endDrag = () => {
      if (!this.dragging) return;
      this.dragging = false;
      document.body.style.cursor = '';
      // Transfer drag velocity → momentum
      this.momentum = this.dragVelocity * 0.0055;
    };

    window.addEventListener('pointerdown', e => startDrag(e.clientY));
    window.addEventListener('pointermove', e => moveDrag(e.clientY));
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    document.getElementById('next-btn').addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) + 1;
    });
    document.getElementById('prev-btn').addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) - 1;
    });

    window.addEventListener('resize', () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      const vp = this.viewport();
      const imgW = vp.w * params.stripWidth;
      const pw = imgW / (1 - 2 * params.borderWidth);
      const ph = vp.h * params.stripHeight;
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(pw, ph, 32, 164);
      this.material.uniforms.uRadius.value = ph / params.wrapAngle;
      this.material.uniforms.uSlotH.value = imgW / ph;
    });
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    // Apply momentum (when not dragging)
    if (!this.dragging && Math.abs(this.momentum) > 0.0002) {
      this.scrollTarget += this.momentum;
      this.momentum *= 0.93; // decay
    } else if (!this.dragging) {
      this.momentum = 0;
    }

    const diff = this.scrollTarget - this.scroll;
    const vel = Math.abs(diff);

    // Snap when idle (no drag, no momentum, low velocity)
    if (!this.dragging && Math.abs(this.momentum) < 0.002 && vel < params.snapThreshold) {
      this.scrollTarget += (Math.round(this.scrollTarget) - this.scrollTarget) * params.snapStrength;
    }

    this.scroll += diff * params.scrollSmoothing;
    this.smoothBend += (Math.min(vel * params.bendSensitivity, 1) - this.smoothBend) * params.bendSmoothing;

    // Combine intro bend (tweened) with interaction bend (velocity-driven)
    const finalBend = Math.max(this.smoothBend, this.introBend);

    // Audio: hum volume tracks interaction energy (velocity + |momentum|)
    const activity = Math.min(vel * 4 + Math.abs(this.momentum) * 4, 1);
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

    this.checkFrame();
    this.renderer.render(this.scene, this.camera);
  }

  // ── Hero load sequence: strip unspools from below ──
  enter() {
    const vp = this.viewport();

    // Start state
    this.mesh.position.y = -vp.h * 0.7;
    this.introBend = 1.0;

    // Initial title
    this.titleEl.innerHTML = TITLES[0];
    this.bgNumEl.textContent = '01';
    this.counterEl.textContent = '001 — 008';
    this.exposureEl.textContent = 'Exposure 001';

    // Hide UI (avoid FOUC — set instantly)
    gsap.set(['.frame__top', '.frame__counter', '.frame__bottom', '.nav-buttons', '#bg-number'], { opacity: 0 });

    const tl = gsap.timeline({
      delay: 0.3,
      onComplete: () => { this.introActive = false; },
    });

    tl.to(this.mesh.position, {
      y: 0,
      duration: 1.9,
      ease: 'power3.out',
    });

    tl.to(this, {
      introBend: 0,
      duration: 1.7,
      ease: 'power2.out',
    }, '<+=0.25');

    tl.to('#bg-number', {
      opacity: 0.05,
      duration: 1.4,
      ease: 'power2.out',
    }, '-=1.4');

    tl.to('.frame__top', {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
    }, '-=0.9');

    tl.to('.frame__counter', {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
    }, '-=0.55');

    tl.to('.frame__bottom', {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
    }, '-=0.5');

    tl.to('.nav-buttons', {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
    }, '-=0.5');
  }

  checkFrame() {
    const raw = ((this.scroll % IMAGE_COUNT) + IMAGE_COUNT) % IMAGE_COUNT;
    const f = Math.round(raw) % IMAGE_COUNT;
    if (f === this.frame || this.transitioning) return;
    this.frame = f;
    this.transitioning = true;

    const num = String(f + 1).padStart(3, '0');

    this.titleEl.innerHTML = TITLES[f];
    this.exposureEl.textContent = `Exposure ${num}`;
    this.counterEl.textContent = `${num} — 008`;
    this.bgNumEl.textContent = String(f + 1).padStart(2, '0');

    this.transitioning = false;
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
