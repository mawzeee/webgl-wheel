import './style.css';
import * as THREE from 'three';

const IMAGE_PATHS = Array.from({ length: 8 }, (_, i) => `/images/slide-${i + 1}.png`);
const IMAGE_COUNT = 8;
const FOV = 50;
const CAMERA_Z = 5;
const STRIP_RATIO = 0.38; // % of viewport width — adjust this to control cylinder width

// ─── Vertex shader: morph flat plane → cylinder ───
const vertexShader = /* glsl */ `
uniform float uBend;
uniform float uRadius;

varying vec2 vUv;
varying float vNDotV;

void main() {
  vUv = uv;

  vec3 pos = position;

  // Cylinder axis = X (horizontal). Curvature in Y-Z plane (vertical wheel).
  // Map flat Y position to angle on the cylinder.
  float angle = pos.y / uRadius;

  // Cylinder surface position
  float cylY = uRadius * sin(angle);
  float cylZ = uRadius * (cos(angle) - 1.0); // offset so center stays at z=0

  // Morph between flat and cylinder
  pos.y = mix(pos.y, cylY, uBend);
  pos.z = mix(0.0, cylZ, uBend);

  // Surface normal: how much this vertex faces the camera (along Z)
  float blendedAngle = mix(0.0, angle, uBend);
  vNDotV = cos(blendedAngle);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// ─── Fragment shader: image tiling + duotone + shading ───
const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tex0, tex1, tex2, tex3, tex4, tex5, tex6, tex7;
uniform float uProgress;
uniform float uBend;
uniform float uSlotH; // UV height of one square image slot

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
  // ── Image tiling ──
  float numSlots = 1.0 / uSlotH;

  // Map UV to continuous image strip
  // vUv.y=1 is top, =0 is bottom. Scroll via uProgress.
  float v = (1.0 - vUv.y) * numSlots + uProgress - numSlots * 0.5;

  // Infinite wrap
  float wrapped = mod(v, 8.0);
  int idx = int(floor(wrapped));
  float localV = fract(wrapped);

  vec2 imgUV = vec2(vUv.x, 1.0 - localV);
  vec4 color = sampleImage(idx, imgUV);

  // ── Duotone treatment (velocity-driven) ──
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  // High contrast remap
  luma = smoothstep(0.03, 0.78, luma);
  // Dark charcoal → warm mid-gray
  vec3 shadow  = vec3(0.055, 0.055, 0.05);
  vec3 highlight = vec3(0.50, 0.48, 0.44);
  vec3 duotone = mix(shadow, highlight, luma);
  color.rgb = mix(color.rgb, duotone, uBend);

  // ── Cylinder shading ──
  float facing = max(vNDotV, 0.0);
  float shade = pow(facing, 0.5);
  color.rgb *= mix(1.0, shade, uBend);

  // Fade out faces nearly edge-on (approaching 90°)
  float edgeAlpha = smoothstep(0.0, 0.12, facing);
  float alpha = mix(1.0, edgeAlpha, uBend);

  gl_FragColor = vec4(color.rgb, alpha);
}
`;

// ─── Main slider class ───
class WheelSlider {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scroll = 0;
    this.scrollTarget = 0;
    this.smoothBend = 0;

    this.init();
    this.loadTextures().then(() => {
      this.createMesh();
      this.bindEvents();
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

  // Get world-space dimensions visible at z=0
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
            loader.load(
              src,
              tex => {
                tex.minFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                resolve(tex);
              },
              undefined,
              () => resolve(null)
            );
          })
      )
    );
  }

  createMesh() {
    const vp = this.getViewport();
    const planeW = vp.width * STRIP_RATIO;
    const planeH = vp.height; // 100vh

    // Cylinder radius: planeH / totalAngle
    // ~210° wrap → 3.665 radians
    const cylinderR = planeH / 3.6;

    // UV height of one square image slot
    const slotH = planeW / planeH;

    // High segment count for smooth curvature
    const geo = new THREE.PlaneGeometry(planeW, planeH, 1, 164);

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
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);
  }

  bindEvents() {
    window.addEventListener('wheel', e => {
      this.scrollTarget += e.deltaY * 0.004;
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
      this.scrollTarget += 1;
    });
    document.getElementById('prev-btn')?.addEventListener('click', () => {
      this.scrollTarget -= 1;
    });

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    // Rebuild geometry to match new viewport
    if (this.mesh) {
      const vp = this.getViewport();
      const planeW = vp.width * STRIP_RATIO;
      const planeH = vp.height;

      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(planeW, planeH, 1, 164);

      this.material.uniforms.uRadius.value = planeH / 3.6;
      this.material.uniforms.uSlotH.value = planeW / planeH;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Smooth scroll interpolation
    const diff = this.scrollTarget - this.scroll;
    this.scroll += diff * 0.07;

    // Velocity → bend (0 = flat, 1 = full cylinder)
    const velocity = Math.abs(diff);
    const targetBend = Math.min(velocity * 6, 1);
    this.smoothBend += (targetBend - this.smoothBend) * 0.05;

    this.material.uniforms.uProgress.value = this.scroll;
    this.material.uniforms.uBend.value = this.smoothBend;

    this.renderer.render(this.scene, this.camera);
  }
}

new WheelSlider();
