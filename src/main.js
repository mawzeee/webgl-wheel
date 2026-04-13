import './style.css';
import * as THREE from 'three';
import GUI from 'lil-gui';

const IMAGE_PATHS = Array.from({ length: 8 }, (_, i) => `/images/slide-${i + 1}.png`);
const IMAGE_COUNT = 8;
const FOV = 50;
const CAMERA_Z = 5;

const params = {
  stripWidth: 0.26,
  stripHeight: 1.1,
  wrapAngle: 1.6,
  bendSensitivity: 1,
  bendSmoothing: 0.04,
  scrollSpeed: 0.009,
  scrollSmoothing: 0.07,
  snapStrength: 0.048,
  snapThreshold: 0.09,
  filmStrength: 1.0,      // how strong the analog color grade is
  filmBaseStrength: 0.15,  // subtle film look even at rest
  grainAmount: 0.06,
  shadeExponent: 2.0,
  borderWidth: 0.04,       // film strip border as fraction of strip
  sprocketsPerImage: 3,
};

// ─── Vertex shader ───
const vertexShader = /* glsl */ `
uniform float uBend;
uniform float uRadius;

varying vec2 vUv;
varying float vNDotV;

void main() {
  vUv = uv;
  vec3 pos = position;

  float angle = pos.y / uRadius;
  float cylY = uRadius * sin(angle);
  float cylZ = uRadius * (cos(angle) - 1.0);

  pos.y = mix(pos.y, cylY, uBend);
  pos.z = mix(0.0, cylZ, uBend);

  float blendedAngle = mix(0.0, angle, uBend);
  vNDotV = cos(blendedAngle);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// ─── Fragment shader: film strip + analog color grade ───
const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tex0, tex1, tex2, tex3, tex4, tex5, tex6, tex7;
uniform float uProgress;
uniform float uBend;
uniform float uSlotH;
uniform float uFilmStrength;
uniform float uFilmBase;
uniform float uShadeExponent;
uniform float uTime;
uniform float uGrain;
uniform float uBorderW;
uniform float uSprockets;

varying vec2 vUv;
varying float vNDotV;

vec4 sampleImage(int idx, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  if (idx == 0) return texture2D(tex0, uv);
  if (idx == 1) return texture2D(tex1, uv);
  if (idx == 2) return texture2D(tex2, uv);
  if (idx == 3) return texture2D(tex3, uv);
  if (idx == 4) return texture2D(tex4, uv);
  if (idx == 5) return texture2D(tex5, uv);
  if (idx == 6) return texture2D(tex6, uv);
  if (idx == 7) return texture2D(tex7, uv);
  return vec4(0.0);
}

// ── Noise ──
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// ── Rounded box SDF ──
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) - r;
}

// ── Analog film color grade ──
// Simulates Kodak warm film stock: lifted warm shadows, amber midtones, cream highlights
vec3 filmGrade(vec3 color) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  // S-curve contrast (characteristic film response)
  float c = luma * luma * (3.0 - 2.0 * luma);

  // Per-channel response curves mimicking film dye layers
  float r = mix(0.13, 0.94, pow(c, 0.78));  // warm, lifted blacks
  float g = mix(0.08, 0.84, pow(c, 0.86));  // slightly less range
  float b = mix(0.04, 0.48, pow(c, 1.20));  // heavily crushed → amber warmth

  vec3 graded = vec3(r, g, b);

  // Preserve some original hue variation so images don't all look identical
  return mix(graded, color * vec3(0.95, 0.80, 0.58), 0.2);
}

void main() {
  // ── Shared coordinates ──
  float numSlots = 1.0 / uSlotH;
  float scrollV = (1.0 - vUv.y) * numSlots + uProgress - numSlots * 0.5 + 0.5;

  // Cylinder shading
  float facing = max(vNDotV, 0.0);
  float shade = pow(facing, uShadeExponent);
  float cylShade = mix(1.0, shade, uBend);
  float edgeAlpha = smoothstep(0.0, 0.12, facing);
  float alpha = mix(1.0, edgeAlpha, uBend);

  // Film grain (animated)
  float grain = hash(vUv * 420.0 + fract(uTime * 7.0)) * uGrain;

  // ── FILM STRIP BORDER ──
  float bw = uBorderW; // border fraction of strip width
  float imageL = bw;
  float imageR = 1.0 - bw;

  if (vUv.x < imageL || vUv.x > imageR) {
    // Film base material — clean black
    vec3 filmBase = vec3(0.04, 0.04, 0.04);
    float baseTex = hash(floor(vUv * 300.0));
    filmBase += (baseTex - 0.5) * 0.01;

    // ── Sprocket holes ──
    float holeSpacing = 1.0 / uSprockets; // spacing in scroll units
    // Distance to nearest hole center
    float dy = mod(scrollV + holeSpacing * 0.5, holeSpacing) - holeSpacing * 0.5;
    // Normalize Y to -0.5..0.5 within hole cell
    float normalDY = dy / holeSpacing;

    // X position normalized within border (-1..1)
    float borderCenter = vUv.x < 0.5 ? bw * 0.5 : 1.0 - bw * 0.5;
    float normalDX = (vUv.x - borderCenter) / (bw * 0.42);

    // Aspect correction: make holes roughly square visually
    float cellAspect = bw / (holeSpacing * uSlotH);
    vec2 holeP = vec2(normalDX, normalDY * 2.0 / max(cellAspect, 0.1));

    // Rounded rectangle sprocket hole
    float holeSDF = sdRoundBox(holeP, vec2(0.52, 0.45), 0.2);
    float inHole = 1.0 - smoothstep(-0.06, 0.06, holeSDF);

    // ── Registration marks (+ crosses between holes) ──
    float markDY = mod(scrollV, holeSpacing) - holeSpacing * 0.5;
    float markNDY = markDY / holeSpacing;
    vec2 markP = vec2(normalDX, markNDY * 2.0 / max(cellAspect, 0.1));
    float crossH = step(abs(markP.x), 0.07) * step(abs(markP.y), 0.22);
    float crossV = step(abs(markP.x), 0.22) * step(abs(markP.y), 0.07);
    float cross = max(crossH, crossV);
    vec3 markColor = vec3(0.15, 0.35, 0.12); // dark green, like real film

    // Compose border
    vec3 borderColor = mix(filmBase, markColor, cross * 0.7);
    borderColor *= cylShade;
    borderColor += grain - uGrain * 0.5;

    // Holes are transparent (show page background through)
    float holeAlpha = 1.0 - inHole;
    gl_FragColor = vec4(borderColor, alpha * holeAlpha);
    return;
  }

  // ── IMAGE AREA ──
  // Remap X to [0,1] within image area
  float imageU = (vUv.x - imageL) / (imageR - imageL);

  // Image tiling
  float wrapped = mod(scrollV, 8.0);
  int idx = int(floor(wrapped));
  float localV = fract(wrapped);

  vec2 imgUV = vec2(imageU, 1.0 - localV);
  vec4 color = sampleImage(idx, imgUV);

  // ── Analog film color grade ──
  // Always apply a subtle base film look, intensify on scroll
  float filmMix = mix(uFilmBase, uFilmStrength, uBend);
  color.rgb = mix(color.rgb, filmGrade(color.rgb), filmMix);

  // Cylinder shading
  color.rgb *= cylShade;

  // Film grain
  color.rgb += grain - uGrain * 0.5;

  // Per-frame vignette (subtle darkening at frame edges)
  float vigX = smoothstep(0.0, 0.06, imageU) * smoothstep(1.0, 0.94, imageU);
  float vigY = smoothstep(0.0, 0.04, localV) * smoothstep(1.0, 0.96, localV);
  color.rgb *= mix(1.0, vigX * vigY, 0.25);

  gl_FragColor = vec4(color.rgb, alpha);
}
`;

// ─── Slider class ───
class WheelSlider {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scroll = 0;
    this.scrollTarget = 0;
    this.smoothBend = 0;
    this.clock = new THREE.Clock();

    this.init();
    this.loadTextures().then(() => {
      this.createMesh();
      this.bindEvents();
      this.initGUI();
      this.animate();
    });
  }

  init() {
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

  getViewport() {
    const halfH = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfW = halfH * this.camera.aspect;
    return { width: halfW * 2, height: halfH * 2 };
  }

  async loadTextures() {
    const loader = new THREE.TextureLoader();
    this.textures = await Promise.all(
      IMAGE_PATHS.map(
        src =>
          new Promise(resolve => {
            loader.load(src, tex => {
              tex.minFilter = THREE.LinearFilter;
              tex.generateMipmaps = false;
              resolve(tex);
            }, undefined, () => resolve(null));
          })
      )
    );
  }

  createMesh() {
    this.rebuildGeometry();
  }

  rebuildGeometry() {
    const vp = this.getViewport();
    // Image area = stripWidth of viewport. Borders are extra on top.
    const imageW = vp.width * params.stripWidth;
    const planeW = imageW / (1 - 2 * params.borderWidth);
    const planeH = vp.height * params.stripHeight;
    const cylinderR = planeH / params.wrapAngle;
    // Slot height based on image area width (keeps images square)
    const slotH = imageW / planeH;

    const geo = new THREE.PlaneGeometry(planeW, planeH, 1, 164);

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
      this.material.uniforms.uRadius.value = cylinderR;
      this.material.uniforms.uSlotH.value = slotH;
    } else {
      this.material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          tex0: { value: this.textures[0] },
          tex1: { value: this.textures[1] },
          tex2: { value: this.textures[2] },
          tex3: { value: this.textures[3] },
          tex4: { value: this.textures[4] },
          tex5: { value: this.textures[5] },
          tex6: { value: this.textures[6] },
          tex7: { value: this.textures[7] },
          uProgress: { value: 0 },
          uBend: { value: 0 },
          uRadius: { value: cylinderR },
          uSlotH: { value: slotH },
          uFilmStrength: { value: params.filmStrength },
          uFilmBase: { value: params.filmBaseStrength },
          uShadeExponent: { value: params.shadeExponent },
          uTime: { value: 0 },
          uGrain: { value: params.grainAmount },
          uBorderW: { value: params.borderWidth },
          uSprockets: { value: params.sprocketsPerImage },
        },
      });
      this.mesh = new THREE.Mesh(geo, this.material);
      this.scene.add(this.mesh);
    }
  }

  bindEvents() {
    window.addEventListener('wheel', e => {
      this.scrollTarget += e.deltaY * params.scrollSpeed;
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) + 1;
    });
    document.getElementById('prev-btn')?.addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) - 1;
    });

    window.addEventListener('resize', () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.rebuildGeometry();
    });
  }

  initGUI() {
    const gui = new GUI({ title: 'Wheel Controls' });

    const strip = gui.addFolder('Strip');
    strip.add(params, 'stripWidth', 0.15, 0.65, 0.01).name('Width').onChange(() => this.rebuildGeometry());
    strip.add(params, 'stripHeight', 0.5, 2.5, 0.05).name('Height').onChange(() => this.rebuildGeometry());
    strip.add(params, 'wrapAngle', 1.0, 6.0, 0.1).name('Wrap Angle').onChange(() => this.rebuildGeometry());

    const scroll = gui.addFolder('Scroll');
    scroll.add(params, 'bendSensitivity', 0.2, 8.0, 0.1).name('Bend Sensitivity');
    scroll.add(params, 'bendSmoothing', 0.01, 0.15, 0.005).name('Bend Smoothing');
    scroll.add(params, 'scrollSpeed', 0.001, 0.02, 0.001).name('Scroll Speed');
    scroll.add(params, 'snapStrength', 0.002, 0.08, 0.002).name('Snap Strength');
    scroll.add(params, 'snapThreshold', 0.02, 0.5, 0.01).name('Snap Threshold');

    const film = gui.addFolder('Film');
    film.add(params, 'filmStrength', 0, 1, 0.05).name('Grade Strength');
    film.add(params, 'filmBaseStrength', 0, 0.5, 0.01).name('Base Grade');
    film.add(params, 'grainAmount', 0, 0.15, 0.005).name('Grain');
    film.add(params, 'shadeExponent', 0.1, 4.0, 0.05).name('Edge Shading');
    film.add(params, 'borderWidth', 0, 0.15, 0.005).name('Border Width');
    film.add(params, 'sprocketsPerImage', 1, 6, 1).name('Sprockets/Image');
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const diff = this.scrollTarget - this.scroll;
    const velocity = Math.abs(diff);

    // Auto-snap to nearest image center
    if (velocity < params.snapThreshold) {
      const nearest = Math.round(this.scrollTarget);
      this.scrollTarget += (nearest - this.scrollTarget) * params.snapStrength;
    }

    this.scroll += diff * params.scrollSmoothing;

    const targetBend = Math.min(velocity * params.bendSensitivity, 1);
    this.smoothBend += (targetBend - this.smoothBend) * params.bendSmoothing;

    // Update uniforms
    const u = this.material.uniforms;
    u.uProgress.value = this.scroll;
    u.uBend.value = this.smoothBend;
    u.uTime.value = this.clock.getElapsedTime();
    u.uFilmStrength.value = params.filmStrength;
    u.uFilmBase.value = params.filmBaseStrength;
    u.uShadeExponent.value = params.shadeExponent;
    u.uGrain.value = params.grainAmount;
    u.uBorderW.value = params.borderWidth;
    u.uSprockets.value = params.sprocketsPerImage;

    this.renderer.render(this.scene, this.camera);
  }
}

new WheelSlider();
