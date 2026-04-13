import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';

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
  stripWidth: 0.26,
  stripHeight: 1.1,
  wrapAngle: 1.6,
  bendSensitivity: 1,
  bendSmoothing: 0.04,
  scrollSpeed: 0.009,
  scrollSmoothing: 0.07,
  snapStrength: 0.048,
  snapThreshold: 0.09,
  filmStrength: 1.0,
  filmBaseStrength: 0.15,
  grainAmount: 0.06,
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

  // Secondary: horizontal barrel (gentler, rounds top/bottom edges)
  float hRadius = uRadius * 2.5;
  float angleH = pos.x / hRadius;
  pos.x = mix(pos.x, hRadius * sin(angleH), uBend);

  // Combined Z depth from both curvatures
  pos.z = mix(0.0, uRadius * (cos(angleV) - 1.0) + hRadius * (cos(angleH) - 1.0), uBend);

  vNDotV = cos(mix(0.0, angleV, uBend));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tex0, tex1, tex2, tex3, tex4, tex5, tex6, tex7;
uniform float uProgress, uBend, uSlotH, uFilmStrength, uFilmBase;
uniform float uShadeExponent, uTime, uGrain, uBorderW, uSprockets;
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
  vec4 color = sampleImage(idx, vec2(u, 1.0-lv));
  color.rgb = mix(color.rgb, filmGrade(color.rgb), mix(uFilmBase, uFilmStrength, uBend));
  color.rgb *= cylShade;
  color.rgb += grain - uGrain*0.5;
  float vx = smoothstep(0.0,0.06,u)*smoothstep(1.0,0.94,u);
  float vy = smoothstep(0.0,0.04,lv)*smoothstep(1.0,0.96,lv);
  color.rgb *= mix(1.0, vx*vy, 0.25);
  gl_FragColor = vec4(color.rgb, alpha);
}
`;

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
    this.frame = 0;
    this.transitioning = false;
    this.clock = new THREE.Clock();

    this.initScene();
    this.loadTextures().then(() => {
      this.createStrip();
      this.listen();
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
      },
    });

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph, 32, 164),
      this.material
    );
    this.scene.add(this.mesh);
  }

  listen() {
    window.addEventListener('wheel', e => {
      this.scrollTarget += e.deltaY * params.scrollSpeed;
    });

    let ty = 0;
    window.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', e => {
      this.scrollTarget += (ty - e.touches[0].clientY) * 0.008;
      ty = e.touches[0].clientY;
    }, { passive: true });

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

    const diff = this.scrollTarget - this.scroll;
    const vel = Math.abs(diff);

    if (vel < params.snapThreshold) {
      this.scrollTarget += (Math.round(this.scrollTarget) - this.scrollTarget) * params.snapStrength;
    }

    this.scroll += diff * params.scrollSmoothing;
    this.smoothBend += (Math.min(vel * params.bendSensitivity, 1) - this.smoothBend) * params.bendSmoothing;

    const u = this.material.uniforms;
    u.uProgress.value = this.scroll;
    u.uBend.value = this.smoothBend;
    u.uTime.value = this.clock.getElapsedTime();

    this.checkFrame();
    this.renderer.render(this.scene, this.camera);
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
}

new WheelSlider();
