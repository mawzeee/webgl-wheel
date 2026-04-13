import './style.css';
import * as THREE from 'three';
import GUI from 'lil-gui';

const IMAGE_PATHS = Array.from({ length: 8 }, (_, i) => `/images/slide-${i + 1}.png`);
const IMAGE_COUNT = 8;
const FOV = 50;
const CAMERA_Z = 5;

// ─── Tunable params (exposed in GUI) ───
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
  duotoneStrength: 1.0,
  shadeExponent: 2.0,
};

// ─── Vertex shader: flat plane → cylinder ───
const vertexShader = /* glsl */ `
uniform float uBend;
uniform float uRadius;

varying vec2 vUv;
varying float vNDotV;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Cylinder axis = X (horizontal). Curvature in Y-Z plane.
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

// ─── Fragment shader: tiling + duotone + shading ───
const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tex0, tex1, tex2, tex3, tex4, tex5, tex6, tex7;
uniform float uProgress;
uniform float uBend;
uniform float uSlotH;
uniform float uDuotoneStrength;
uniform float uShadeExponent;

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

void main() {
  float numSlots = 1.0 / uSlotH;
  float v = (1.0 - vUv.y) * numSlots + uProgress - numSlots * 0.5 + 0.5;

  float wrapped = mod(v, 8.0);
  int idx = int(floor(wrapped));
  float localV = fract(wrapped);

  vec2 imgUV = vec2(vUv.x, 1.0 - localV);
  vec4 color = sampleImage(idx, imgUV);

  // Duotone
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  luma = smoothstep(0.03, 0.78, luma);
  vec3 shadow = vec3(0.055, 0.055, 0.05);
  vec3 highlight = vec3(0.50, 0.48, 0.44);
  vec3 duotone = mix(shadow, highlight, luma);
  float duoMix = uBend * uDuotoneStrength;
  color.rgb = mix(color.rgb, duotone, duoMix);

  // Cylinder shading
  float facing = max(vNDotV, 0.0);
  float shade = pow(facing, uShadeExponent);
  color.rgb *= mix(1.0, shade, uBend);

  // Fade edge-on faces
  float edgeAlpha = smoothstep(0.0, 0.12, facing);
  float alpha = mix(1.0, edgeAlpha, uBend);

  gl_FragColor = vec4(color.rgb, alpha);
}
`;

// ─── Slider ───
class WheelSlider {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scroll = 0;
    this.scrollTarget = 0;
    this.smoothBend = 0;
    this.isSnapping = false;

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
    const planeW = vp.width * params.stripWidth;
    const planeH = vp.height * params.stripHeight;
    const cylinderR = planeH / params.wrapAngle;
    const slotH = planeW / planeH;

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
          uDuotoneStrength: { value: params.duotoneStrength },
          uShadeExponent: { value: params.shadeExponent },
        },
      });
      this.mesh = new THREE.Mesh(geo, this.material);
      this.scene.add(this.mesh);
    }
  }

  bindEvents() {
    window.addEventListener('wheel', e => {
      this.scrollTarget += e.deltaY * params.scrollSpeed;
      this.isSnapping = false; // user is actively scrolling
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) + 1;
      this.isSnapping = false;
    });
    document.getElementById('prev-btn')?.addEventListener('click', () => {
      this.scrollTarget = Math.round(this.scrollTarget) - 1;
      this.isSnapping = false;
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

    gui.add(params, 'stripWidth', 0.15, 0.65, 0.01).name('Strip Width')
      .onChange(() => this.rebuildGeometry());
    gui.add(params, 'stripHeight', 0.5, 2.5, 0.05).name('Strip Height')
      .onChange(() => this.rebuildGeometry());
    gui.add(params, 'wrapAngle', 1.5, 6.0, 0.1).name('Wrap Angle')
      .onChange(() => this.rebuildGeometry());
    gui.add(params, 'bendSensitivity', 0.5, 8.0, 0.1).name('Bend Sensitivity');
    gui.add(params, 'bendSmoothing', 0.01, 0.15, 0.005).name('Bend Smoothing');
    gui.add(params, 'scrollSpeed', 0.001, 0.01, 0.001).name('Scroll Speed');
    gui.add(params, 'snapStrength', 0.002, 0.06, 0.002).name('Snap Strength');
    gui.add(params, 'snapThreshold', 0.02, 0.5, 0.01).name('Snap Threshold');
    gui.add(params, 'duotoneStrength', 0, 1, 0.05).name('Duotone');
    gui.add(params, 'shadeExponent', 0.1, 2.0, 0.05).name('Edge Shading');
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // ── Scroll interpolation ──
    const diff = this.scrollTarget - this.scroll;
    const velocity = Math.abs(diff);

    // Auto-snap: when velocity is low, ease scrollTarget to nearest image
    if (velocity < params.snapThreshold) {
      const nearest = Math.round(this.scrollTarget);
      this.scrollTarget += (nearest - this.scrollTarget) * params.snapStrength;
    }

    this.scroll += diff * params.scrollSmoothing;

    // ── Bend ──
    const targetBend = Math.min(velocity * params.bendSensitivity, 1);
    this.smoothBend += (targetBend - this.smoothBend) * params.bendSmoothing;

    // ── Update uniforms ──
    this.material.uniforms.uProgress.value = this.scroll;
    this.material.uniforms.uBend.value = this.smoothBend;
    this.material.uniforms.uDuotoneStrength.value = params.duotoneStrength;
    this.material.uniforms.uShadeExponent.value = params.shadeExponent;

    this.renderer.render(this.scene, this.camera);
  }
}

new WheelSlider();
