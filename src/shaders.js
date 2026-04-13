export const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader1 = `
uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform sampler2D texture4;

uniform float uProgress;
uniform float uVelocity;
uniform vec2 uResolution;
uniform vec2 uImageRes;

varying vec2 vUv;

// Get texture based on index
vec4 getTexture(int index, vec2 uv) {
  if (index == 0) return texture2D(texture0, uv);
  if (index == 1) return texture2D(texture1, uv);
  if (index == 2) return texture2D(texture2, uv);
  if (index == 3) return texture2D(texture3, uv);
  if (index == 4) return texture2D(texture4, uv);
  return vec4(0.0);
}

float getLuma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  // Config
  float colWidth = 0.38; // Width of the column (38% of screen)
  float slotHeight = 2.2; // How many images fit vertically
  
  // Velocity-based bulge in the center
  float bulgeAmount = sin(vUv.y * 3.14159) * uVelocity * 0.4;
  
  float colLeft = 0.5 - (colWidth / 2.0) - bulgeAmount;
  float colRight = 0.5 + (colWidth / 2.0) + bulgeAmount;
  
  // Base Column Mask
  float mask = smoothstep(colLeft - 0.002, colLeft, vUv.x) * 
               smoothstep(colRight + 0.002, colRight, vUv.x);
               
  if (mask < 0.01) {
    gl_FragColor = vec4(0.0);
    return;
  }
  
  // Map X inside the column [0, 1]
  float mappedX = (vUv.x - colLeft) / (colRight - colLeft);
  
  // Map Y into scrollable slots
  float virtualY = (0.5 - vUv.y) * slotHeight + 0.5 + uProgress;
  
  int index = int(floor(virtualY));
  float slotUvY = fract(virtualY);
  
  // Out of bounds checking
  if (index < 0 || index > 4) {
    gl_FragColor = vec4(0.0);
    return;
  }
  
  // Gap between images
  float gap = 0.02;
  float gapMask = smoothstep(0.0, gap, slotUvY) * smoothstep(1.0, 1.0 - gap, slotUvY);
  mask *= gapMask;
  
  if (mask < 0.01) {
    gl_FragColor = vec4(0.0);
    return;
  }
  
  // Flip Y for standard image orientation
  slotUvY = 1.0 - slotUvY;
  vec2 slotUv = vec2(mappedX, slotUvY);
  
  // Scale down images that are off-center (distance from uProgress)
  float distFromCenter = abs(uProgress - float(index));
  vec2 center = vec2(0.5);
  // Pinch scale for off-center images
  float scale = 1.0 + smoothstep(0.0, 1.5, distFromCenter) * 0.2;
  slotUv = center + (slotUv - center) * scale;
  
  // Aspect ratio correction (object-fit: cover equivalent)
  vec2 slotRes = vec2(uResolution.x * colWidth, uResolution.y / slotHeight);
  vec2 ratio = vec2(
    min((slotRes.x / slotRes.y) / (uImageRes.x / uImageRes.y), 1.0),
    min((slotRes.y / slotRes.x) / (uImageRes.y / uImageRes.x), 1.0)
  );
  
  vec2 finalUv = vec2(
    slotUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    slotUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );
  
  vec4 color = getTexture(index, finalUv);
  
  // Duotone Effect
  vec3 bg = vec3(0.894, 0.894, 0.894); // #E4E4E4
  vec3 fg = vec3(0.184, 0.180, 0.188); // #2F2E30
  
  float luma = getLuma(color.rgb);
  // Thresholding for high-contrast look
  float threshold = smoothstep(0.4, 0.6, luma);
  vec3 duotone = mix(fg, bg, threshold);
  
  // Mix duotone based on velocity and distance from center
  // If moving fast, or if it's an off-center image, show duotone
  float duotoneMix = clamp(uVelocity * 2.0 + smoothstep(0.1, 0.8, distFromCenter), 0.0, 1.0);
  vec3 finalColor = mix(color.rgb, duotone, duotoneMix);
  
  // Fade out at extreme top and bottom of screen
  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  
  gl_FragColor = vec4(finalColor, mask * edgeFade);
}
`;

// Effect 2: Horizontal wipe with RGB split
export const fragmentShader2 = `
uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform sampler2D texture4;

uniform float uProgress;
uniform float uVelocity;
uniform vec2 uResolution;
uniform vec2 uImageRes;

varying vec2 vUv;

vec4 getTexture(int index, vec2 uv) {
  if (index == 0) return texture2D(texture0, uv);
  if (index == 1) return texture2D(texture1, uv);
  if (index == 2) return texture2D(texture2, uv);
  if (index == 3) return texture2D(texture3, uv);
  if (index == 4) return texture2D(texture4, uv);
  return vec4(0.0);
}

void main() {
  float colWidth = 0.38;
  float slotHeight = 2.2;

  float colLeft = 0.5 - colWidth / 2.0;
  float colRight = 0.5 + colWidth / 2.0;

  float mask = smoothstep(colLeft - 0.002, colLeft, vUv.x) *
               smoothstep(colRight + 0.002, colRight, vUv.x);

  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  float mappedX = (vUv.x - colLeft) / (colRight - colLeft);
  float virtualY = (0.5 - vUv.y) * slotHeight + 0.5 + uProgress;

  int index = int(floor(virtualY));
  float slotUvY = fract(virtualY);

  if (index < 0 || index > 4) { gl_FragColor = vec4(0.0); return; }

  float gap = 0.02;
  float gapMask = smoothstep(0.0, gap, slotUvY) * smoothstep(1.0, 1.0 - gap, slotUvY);
  mask *= gapMask;
  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  slotUvY = 1.0 - slotUvY;
  vec2 slotUv = vec2(mappedX, slotUvY);

  // Aspect ratio correction
  vec2 slotRes = vec2(uResolution.x * colWidth, uResolution.y / slotHeight);
  vec2 ratio = vec2(
    min((slotRes.x / slotRes.y) / (uImageRes.x / uImageRes.y), 1.0),
    min((slotRes.y / slotRes.x) / (uImageRes.y / uImageRes.x), 1.0)
  );
  vec2 finalUv = vec2(
    slotUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    slotUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  // RGB chromatic aberration based on velocity
  float shift = uVelocity * 0.02;
  float r = getTexture(index, finalUv + vec2(shift, 0.0)).r;
  float g = getTexture(index, finalUv).g;
  float b = getTexture(index, finalUv - vec2(shift, 0.0)).b;

  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(r, g, b, mask * edgeFade);
}
`;

// Effect 3: Pixelation dissolve
export const fragmentShader3 = `
uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform sampler2D texture4;

uniform float uProgress;
uniform float uVelocity;
uniform vec2 uResolution;
uniform vec2 uImageRes;

varying vec2 vUv;

vec4 getTexture(int index, vec2 uv) {
  if (index == 0) return texture2D(texture0, uv);
  if (index == 1) return texture2D(texture1, uv);
  if (index == 2) return texture2D(texture2, uv);
  if (index == 3) return texture2D(texture3, uv);
  if (index == 4) return texture2D(texture4, uv);
  return vec4(0.0);
}

void main() {
  float colWidth = 0.38;
  float slotHeight = 2.2;

  float colLeft = 0.5 - colWidth / 2.0;
  float colRight = 0.5 + colWidth / 2.0;

  float mask = smoothstep(colLeft - 0.002, colLeft, vUv.x) *
               smoothstep(colRight + 0.002, colRight, vUv.x);

  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  float mappedX = (vUv.x - colLeft) / (colRight - colLeft);
  float virtualY = (0.5 - vUv.y) * slotHeight + 0.5 + uProgress;

  int index = int(floor(virtualY));
  float slotUvY = fract(virtualY);

  if (index < 0 || index > 4) { gl_FragColor = vec4(0.0); return; }

  float gap = 0.02;
  float gapMask = smoothstep(0.0, gap, slotUvY) * smoothstep(1.0, 1.0 - gap, slotUvY);
  mask *= gapMask;
  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  slotUvY = 1.0 - slotUvY;
  vec2 slotUv = vec2(mappedX, slotUvY);

  // Pixelation based on velocity
  float pixelSize = mix(1.0, 60.0, uVelocity);
  vec2 pixelUv = floor(slotUv * pixelSize) / pixelSize;

  // Aspect ratio correction
  vec2 slotRes = vec2(uResolution.x * colWidth, uResolution.y / slotHeight);
  vec2 ratio = vec2(
    min((slotRes.x / slotRes.y) / (uImageRes.x / uImageRes.y), 1.0),
    min((slotRes.y / slotRes.x) / (uImageRes.y / uImageRes.x), 1.0)
  );
  vec2 finalUv = vec2(
    pixelUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    pixelUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  vec4 color = getTexture(index, finalUv);

  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(color.rgb, mask * edgeFade);
}
`;

// Effect 4: Noise distortion
export const fragmentShader4 = `
uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform sampler2D texture4;

uniform float uProgress;
uniform float uVelocity;
uniform vec2 uResolution;
uniform vec2 uImageRes;

varying vec2 vUv;

vec4 getTexture(int index, vec2 uv) {
  if (index == 0) return texture2D(texture0, uv);
  if (index == 1) return texture2D(texture1, uv);
  if (index == 2) return texture2D(texture2, uv);
  if (index == 3) return texture2D(texture3, uv);
  if (index == 4) return texture2D(texture4, uv);
  return vec4(0.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float colWidth = 0.38;
  float slotHeight = 2.2;

  float bulge = sin(vUv.y * 3.14159) * uVelocity * 0.3;
  float colLeft = 0.5 - colWidth / 2.0 - bulge;
  float colRight = 0.5 + colWidth / 2.0 + bulge;

  float mask = smoothstep(colLeft - 0.002, colLeft, vUv.x) *
               smoothstep(colRight + 0.002, colRight, vUv.x);

  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  float mappedX = (vUv.x - colLeft) / (colRight - colLeft);
  float virtualY = (0.5 - vUv.y) * slotHeight + 0.5 + uProgress;

  int index = int(floor(virtualY));
  float slotUvY = fract(virtualY);

  if (index < 0 || index > 4) { gl_FragColor = vec4(0.0); return; }

  float gap = 0.02;
  float gapMask = smoothstep(0.0, gap, slotUvY) * smoothstep(1.0, 1.0 - gap, slotUvY);
  mask *= gapMask;
  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  slotUvY = 1.0 - slotUvY;
  vec2 slotUv = vec2(mappedX, slotUvY);

  // Noise-based displacement driven by velocity
  float n = hash(floor(slotUv * 80.0));
  vec2 displacement = vec2(n - 0.5, hash(floor(slotUv.yx * 80.0)) - 0.5) * uVelocity * 0.08;
  slotUv += displacement;

  // Aspect ratio correction
  vec2 slotRes = vec2(uResolution.x * colWidth, uResolution.y / slotHeight);
  vec2 ratio = vec2(
    min((slotRes.x / slotRes.y) / (uImageRes.x / uImageRes.y), 1.0),
    min((slotRes.y / slotRes.x) / (uImageRes.y / uImageRes.x), 1.0)
  );
  vec2 finalUv = vec2(
    slotUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    slotUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  vec4 color = getTexture(index, finalUv);

  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(color.rgb, mask * edgeFade);
}
`;

// Effect 5: Barrel distortion + vignette
export const fragmentShader5 = `
uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform sampler2D texture4;

uniform float uProgress;
uniform float uVelocity;
uniform vec2 uResolution;
uniform vec2 uImageRes;

varying vec2 vUv;

vec4 getTexture(int index, vec2 uv) {
  if (index == 0) return texture2D(texture0, uv);
  if (index == 1) return texture2D(texture1, uv);
  if (index == 2) return texture2D(texture2, uv);
  if (index == 3) return texture2D(texture3, uv);
  if (index == 4) return texture2D(texture4, uv);
  return vec4(0.0);
}

void main() {
  float colWidth = 0.38;
  float slotHeight = 2.2;

  float colLeft = 0.5 - colWidth / 2.0;
  float colRight = 0.5 + colWidth / 2.0;

  float mask = smoothstep(colLeft - 0.002, colLeft, vUv.x) *
               smoothstep(colRight + 0.002, colRight, vUv.x);

  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  float mappedX = (vUv.x - colLeft) / (colRight - colLeft);
  float virtualY = (0.5 - vUv.y) * slotHeight + 0.5 + uProgress;

  int index = int(floor(virtualY));
  float slotUvY = fract(virtualY);

  if (index < 0 || index > 4) { gl_FragColor = vec4(0.0); return; }

  float gap = 0.02;
  float gapMask = smoothstep(0.0, gap, slotUvY) * smoothstep(1.0, 1.0 - gap, slotUvY);
  mask *= gapMask;
  if (mask < 0.01) { gl_FragColor = vec4(0.0); return; }

  slotUvY = 1.0 - slotUvY;
  vec2 slotUv = vec2(mappedX, slotUvY);

  // Barrel distortion driven by velocity
  vec2 center = vec2(0.5);
  vec2 d = slotUv - center;
  float r2 = dot(d, d);
  float barrel = 1.0 + uVelocity * 2.0 * r2;
  slotUv = center + d * barrel;

  // Aspect ratio correction
  vec2 slotRes = vec2(uResolution.x * colWidth, uResolution.y / slotHeight);
  vec2 ratio = vec2(
    min((slotRes.x / slotRes.y) / (uImageRes.x / uImageRes.y), 1.0),
    min((slotRes.y / slotRes.x) / (uImageRes.y / uImageRes.x), 1.0)
  );
  vec2 finalUv = vec2(
    slotUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    slotUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  vec4 color = getTexture(index, finalUv);

  // Vignette
  float vignette = 1.0 - smoothstep(0.3, 0.9, length(d) * 1.5);
  color.rgb *= mix(1.0, vignette, uVelocity);

  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(color.rgb, mask * edgeFade);
}
`;