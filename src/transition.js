import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import {
  renderDetail, captionFor, stockFor, cameraFor, locationFor,
  enterDetailContent, leaveDetailContent, prepDetailContent,
} from './detail.js';

// Custom ease ported from blenkcode/codrops-demo. The "fast commit →
// settled landing" feel is what makes the transition read as the
// projector advancing one frame, not a generic page swap.
gsap.registerPlugin(CustomEase);
CustomEase.create('pageTransition', 'M0,0 C0.38,0.05 0.48,0.58 0.65,0.82 0.82,1 1,1 1,1');

const EASE = 'pageTransition';
const DUR  = 0.7;
const N    = 22;

// ──────────────────────────────────────────────────────────────────
//  PROJECTION GEOMETRY
// ──────────────────────────────────────────────────────────────────
// On home, the cylinder mesh is sized so its CENTERED SLOT occupies
// roughly 32% of the viewport width (params.stripWidth). On detail,
// we want that same slot to fill the viewport — like a slide projector
// enlarging a 35mm frame onto a movie screen. Same mesh, same shader,
// just scaled so one slot covers the whole rectangle.
//
// Slot is square in world space (slotW = slotH = imgW). To stretch it
// to viewport dims, we scale the mesh non-uniformly:
//
//   scale.x = viewport_world_w / slot_world_w
//   scale.y = viewport_world_h / slot_world_w   (slot is square, so /slot_w)
//
// In the shader, slot height in UV is uSlotH = imgW/ph. After scaling,
// the slot still spans the same UV range — but in screen pixels it now
// fills the viewport. Neighboring slots scale offscreen.
function projectionScaleFor(slider) {
  // Recover the non-bordered image area of the mesh.
  const stripW = slider.viewport().w * 0.32;             // imgW (default stripWidth=0.32)
  // We can't trust params at call time (it may have been resized for
  // mobile). Read uSlotH from the live shader to get current ratio.
  const uSlotH = slider.material.uniforms.uSlotH.value;  // imgW/ph
  // Mesh world dims:
  //   pw = stripW / (1 - 2*borderW)   — slightly wider than slot for sprockets
  //   ph = stripW / uSlotH            — taller than slot by 1/uSlotH slots
  // Slot world width = slot world height = stripW.
  const vp = slider.viewport();
  const slotW = stripW;
  // Read borderW too so x-scale fills viewport WIDTH at the IMAGE area
  // (not including sprocket borders, which fade to 0).
  const sx = vp.w / slotW;
  const sy = vp.h / slotW;
  return { sx, sy, uSlotH };
}

// Snap the slider's scroll math to land frame f exactly under the gate.
// Picks the nearest integer congruent to f (mod N) so we don't unwind
// the scroll across many revolutions.
function _snapToFrame(slider, f) {
  const cur = slider.scroll;
  const k = Math.round((cur - f) / N);
  const target = k * N + f;
  slider.scroll = target;
  slider.scrollTarget = target;
  slider._wheelVel = 0;
}

// Detail scroll listener — wired once. Updates the cylinder mesh's
// projection-shrink based on detail.scrollTop / 100vh, so the projected
// frame retreats from full-viewport into a small corner anchor as the
// user scrolls into the long-form. Keeps the rig persistent.
let _detailScrollWired = false;
let _projectActive = false;        // is the mesh currently in projected mode?
let _projectScale = { sx: 1, sy: 1 }; // remembered fit-to-viewport scale
const CORNER_SCALE_FACTOR = 0.16;  // ratio of corner size to fit-to-viewport size

function _wireDetailScroll(detailRoot, slider) {
  if (_detailScrollWired) return;
  _detailScrollWired = true;
  const onScroll = () => {
    if (!_projectActive || !slider.mesh) return;
    const vh = window.innerHeight;
    const p = Math.min(Math.max(detailRoot.scrollTop / vh, 0), 1);
    // Lerp the mesh between fit-to-viewport (p=0) and corner-anchor (p=1).
    const sx = _projectScale.sx * (1 - (1 - CORNER_SCALE_FACTOR) * p);
    const sy = _projectScale.sy * (1 - (1 - CORNER_SCALE_FACTOR) * p);
    slider.mesh.scale.x = sx;
    slider.mesh.scale.y = sy;
    // Slide the mesh from center toward BR corner. World-space coords:
    // viewport BR pixel offset from center = (vp.w/2 - safe-x - cornerW/2,
    // -(vp.h/2 - safe-y - cornerH/2)). At p=1, mesh translates fully there.
    const vp = slider.viewport();
    const slotW = vp.w * 0.32;
    const cornerW = slotW * CORNER_SCALE_FACTOR; // corner element world width
    const safePx = 28; // matches CSS --safe-x
    const safeWorld = (safePx / window.innerWidth) * vp.w;
    const dx = (vp.w / 2 - safeWorld - cornerW / 2) * p;
    const dy = -(vp.h / 2 - safeWorld - cornerW / 2) * p;
    slider.mesh.position.x = dx;
    slider.mesh.position.y = dy;
  };
  detailRoot.addEventListener('scroll', onScroll, { passive: true });
}

// Long-form title slide-up (lives inside .detail-story). Reveals when
// the user crosses ~35% of viewport scroll on detail — the headline
// rises just as the projected frame begins to retreat to the corner.
let _titleRevealed = false;
function _wireTitleReveal(detailRoot) {
  const onScroll = () => {
    if (_titleRevealed) return;
    const vh = window.innerHeight;
    const p = detailRoot.scrollTop / vh;
    if (p > 0.35) {
      _titleRevealed = true;
      const lines = detailRoot.querySelectorAll('.detail-story__title .detail-header__line > span');
      if (lines.length) {
        gsap.to(lines, {
          y: '0%',
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.08,
        });
      }
    }
  };
  detailRoot.addEventListener('scroll', onScroll, { passive: true });
}

function _resetTitleReveal() { _titleRevealed = false; }

// ──────────────────────────────────────────────────────────────────
//  Forward: home → detail
// ──────────────────────────────────────────────────────────────────
//
// The projector enlarges the chosen frame onto the screen.
//
//   1. Snap scroll so the chosen frame is centered in the cylinder's
//      gate (vUv.y = 0.5). The render loop's lerp will already be at
//      this value because we also write slider.scroll directly.
//   2. Lock the slider so velocity-driven bend doesn't fight the tween.
//   3. Tween mesh.scale → fit-to-viewport, uBorderW → 0 (sprockets
//      fade), uBend → 0 (cylinder unfolds — already at 0 because
//      scrollTarget == scroll, so this is belt-and-suspenders).
//   4. The chrome (.frame) recedes as before for the depth contrast.
//      The CANVAS-CONTAINER does NOT recede this time — the projected
//      frame stays at full viewport size.
//   5. Detail rises from y:100% with a transparent hero spacer; the
//      long-form sections sit below it with their own opaque bg.
//
export function forwardSplice({ slider, frame, detailRoot, frameState }) {
  const frameChrome  = document.querySelector('.frame');
  const voidBackdrop = document.getElementById('void-backdrop');

  // Render detail HTML
  detailRoot.innerHTML = renderDetail({
    frame,
    total: N,
    title: frameState.titles[frame],
    signature: frameState.signatures[frame],
    tech: frameState.tech[frame],
    imagePath: frameState.imagePaths[frame],
    caption: captionFor(frame),
    stock: stockFor(frame),
    camera: cameraFor(frame),
    location: locationFor(frame),
  });
  prepDetailContent(detailRoot);
  detailRoot.setAttribute('aria-hidden', 'false');
  detailRoot.classList.add('active');
  document.body.classList.add('route-frame');
  detailRoot.scrollTop = 0;

  _wireDetailScroll(detailRoot, slider);
  _wireTitleReveal(detailRoot);

  // Lock the cylinder on the chosen frame.
  _snapToFrame(slider, frame);
  slider.locked = true;

  // Compute fit-to-viewport scale. Cache for the scroll-driven shrink.
  const { sx, sy } = projectionScaleFor(slider);
  _projectScale = { sx, sy };
  _projectActive = true;

  // Snap the void on so chrome scales into pure black.
  gsap.set(voidBackdrop, { opacity: 1 });

  const tl = gsap.timeline();

  // CHROME RECEDES — same lift+scale+opacity move as before. Only the
  // .frame chrome (corners + title + EXIF + nav). The canvas itself
  // STAYS put; the cylinder mesh inside it is what scales up.
  tl.to(frameChrome, {
    y: '-30vh',
    scale: 0.8,
    opacity: 0.65,
    duration: DUR,
    ease: EASE,
    force3D: true,
    transformOrigin: '50% 50%',
  }, 0);

  // CYLINDER PROJECTS — mesh scale tweens from (1,1) to (sx, sy) so the
  // centered slot fills the viewport. Bend collapses, sprocket borders
  // fade. Other slots are scaled offscreen and dimmed by the focus
  // differential so they don't read as edges.
  tl.to(slider.mesh.scale, {
    x: sx,
    y: sy,
    duration: DUR,
    ease: EASE,
  }, 0);
  tl.to(slider.material.uniforms.uBorderW, {
    value: 0,
    duration: DUR,
    ease: EASE,
  }, 0);
  // Belt-and-suspenders: force smoothBend to 0 in case any residual
  // velocity is still in the air when the click landed.
  tl.to(slider, { smoothBend: 0, duration: DUR * 0.6, ease: EASE }, 0);

  // DETAIL SLIDES UP from below.
  tl.fromTo(detailRoot,
    { y: '100%' },
    { y: '0%', duration: DUR, ease: EASE, force3D: true },
    0
  );

  // Detail content (chrome + long-form prep) enters as the reveal lands.
  tl.add(() => enterDetailContent(detailRoot), 0.28);

  return tl.then();
}

// ──────────────────────────────────────────────────────────────────
//  Reverse: detail → home
// ──────────────────────────────────────────────────────────────────
export function reverseSplice({ slider, frame, detailRoot, frameState }) {
  const frameChrome  = document.querySelector('.frame');
  const voidBackdrop = document.getElementById('void-backdrop');

  const tl = gsap.timeline();

  tl.add(() => leaveDetailContent(detailRoot), 0);

  tl.to(detailRoot, {
    y: '100%',
    duration: DUR,
    ease: EASE,
    force3D: true,
  }, 0);

  // Chrome rises back.
  tl.to(frameChrome, {
    y: 0,
    scale: 1,
    opacity: 1,
    duration: DUR,
    ease: EASE,
    force3D: true,
    transformOrigin: '50% 50%',
  }, 0);

  // Cylinder retracts: mesh.scale back to (1,1), sprocket borders
  // restored, position back to (0,0). This reverses the projection.
  tl.to(slider.mesh.scale, {
    x: 1, y: 1,
    duration: DUR,
    ease: EASE,
  }, 0);
  tl.to(slider.mesh.position, {
    x: 0, y: 0,
    duration: DUR,
    ease: EASE,
  }, 0);
  tl.to(slider.material.uniforms.uBorderW, {
    value: 0.04,
    duration: DUR,
    ease: EASE,
  }, 0);

  tl.add(() => {
    gsap.set(voidBackdrop, { opacity: 0 });
    slider.locked = false;
    _projectActive = false;
  });

  tl.add(() => {
    detailRoot.setAttribute('aria-hidden', 'true');
    detailRoot.classList.remove('active');
    detailRoot.innerHTML = '';
    detailRoot.scrollTop = 0;
    gsap.set(detailRoot, { clearProps: 'transform' });
    document.body.classList.remove('route-frame');
    gsap.set(frameChrome, { clearProps: 'transform,opacity' });
    _resetTitleReveal();
  });

  return tl.then();
}

// ──────────────────────────────────────────────────────────────────
//  Simple reverse: user direct-loaded the detail page (no preceding
//  forward splice). Just fade the detail out and chrome in.
// ──────────────────────────────────────────────────────────────────
export function simpleReverse({ detailRoot, slider }) {
  const frameChrome  = document.querySelector('.frame');
  const canvasEl     = document.getElementById('canvas-container');
  const voidBackdrop = document.getElementById('void-backdrop');

  const tl = gsap.timeline();
  tl.to(detailRoot,  { opacity: 0, duration: 0.4, ease: 'power2.in' }, 0);
  tl.to(canvasEl,    { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0);
  tl.to(frameChrome, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.1);

  // If the slider exists and is in projected mode, retract it.
  if (slider && slider.mesh) {
    tl.to(slider.mesh.scale, { x: 1, y: 1, duration: 0.5, ease: 'power2.out' }, 0);
    tl.to(slider.mesh.position, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' }, 0);
    tl.to(slider.material.uniforms.uBorderW, { value: 0.04, duration: 0.5, ease: 'power2.out' }, 0);
  }

  tl.add(() => { gsap.set(voidBackdrop, { opacity: 0 }); }, 0.5);
  tl.add(() => {
    detailRoot.setAttribute('aria-hidden', 'true');
    detailRoot.classList.remove('active');
    detailRoot.innerHTML = '';
    detailRoot.scrollTop = 0;
    gsap.set(detailRoot, { clearProps: 'transform,opacity' });
    document.body.classList.remove('route-frame');
    if (slider) slider.locked = false;
    _projectActive = false;
    _resetTitleReveal();
  });
  return tl.then();
}

// ──────────────────────────────────────────────────────────────────
//  Direct-load: detail page rendered instantly when the user reloads
//  / pastes a /frame/:id URL. The slider may not have booted yet, so
//  we delay the projection setup until the mesh exists.
// ──────────────────────────────────────────────────────────────────
export function directLoadDetail({ slider, frame, detailRoot, frameState }) {
  detailRoot.innerHTML = renderDetail({
    frame,
    total: N,
    title: frameState.titles[frame],
    signature: frameState.signatures[frame],
    tech: frameState.tech[frame],
    imagePath: frameState.imagePaths[frame],
    caption: captionFor(frame),
    stock: stockFor(frame),
    camera: cameraFor(frame),
    location: locationFor(frame),
  });
  prepDetailContent(detailRoot);
  detailRoot.setAttribute('aria-hidden', 'false');
  detailRoot.classList.add('active');
  gsap.set(detailRoot, { y: '0%' });
  document.body.classList.add('route-frame');
  detailRoot.scrollTop = 0;

  _wireDetailScroll(detailRoot, slider);
  _wireTitleReveal(detailRoot);
  enterDetailContent(detailRoot);

  // If the slider has booted, project immediately. If not, retry once
  // textures are ready (slider.mesh is created in createStrip).
  const tryProject = () => {
    if (!slider || !slider.mesh) {
      setTimeout(tryProject, 80);
      return;
    }
    _snapToFrame(slider, frame);
    slider.locked = true;
    const { sx, sy } = projectionScaleFor(slider);
    _projectScale = { sx, sy };
    _projectActive = true;
    slider.mesh.scale.set(sx, sy, 1);
    slider.material.uniforms.uBorderW.value = 0;
  };
  tryProject();

  const frameChrome = document.querySelector('.frame');
  if (frameChrome) frameChrome.style.opacity = '0';
}
