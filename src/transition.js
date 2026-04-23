import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import {
  renderDetail, captionFor, stockFor, cameraFor, locationFor,
  enterDetailContent, leaveDetailContent, prepDetailContent, gridImagesFor,
} from './detail.js';

// Register once — ported verbatim from blenkcode/codrops-demo src/lib/index.js.
// This is the load-bearing detail in the Codrops reference: the ease is what
// gives the transition its "fast commit → settled landing" feel. A generic
// power3.inOut will never match.
gsap.registerPlugin(CustomEase);
CustomEase.create('pageTransition', 'M0,0 C0.38,0.05 0.48,0.58 0.65,0.82 0.82,1 1,1 1,1');

const EASE = 'pageTransition';
const DUR  = 0.7;

// ── Forward: click on frame → detail page ──────────────────────

export function forwardSplice({ slider, frame, detailRoot, frameState }) {
  const frameChrome = document.querySelector('.frame');
  const canvasEl    = document.getElementById('canvas-container');
  const voidBackdrop = document.getElementById('void-backdrop');

  // Render detail page HTML
  const total = 25;
  detailRoot.innerHTML = renderDetail({
    frame,
    total,
    title: frameState.titles[frame],
    signature: frameState.signatures[frame],
    tech: frameState.tech[frame],
    imagePath: frameState.imagePaths[frame],
    gridImages: gridImagesFor(frame, frameState.imagePaths, 4),
    caption: captionFor(frame),
    stock: stockFor(frame),
    camera: cameraFor(frame),
    location: locationFor(frame),
  });
  // Park every animated element in its "from" state the same frame the
  // HTML lands — otherwise there's a frame where the browser paints them
  // at full opacity before GSAP's fromTo catches up, which reads as a blink.
  prepDetailContent(detailRoot);
  detailRoot.setAttribute('aria-hidden', 'false');
  detailRoot.classList.add('active');
  document.body.classList.add('route-frame');

  // Snap the black backdrop on so the home — which has its own beige bg
  // via CSS — scales into black emptiness the moment it starts moving.
  gsap.set(voidBackdrop, { opacity: 1 });

  const tl = gsap.timeline();

  // HOME LAYER RECEDES — scale + translate from Codrops demo. Opacity lifted
  // from the Codrops 0.4 → 0.65 because our card is DARK on a black void —
  // at 0.4 the card disappears into the void with no depth contrast. 0.65
  // keeps the card visibly present as it recedes (our equivalent of 40%
  // white-on-black in the reference).
  const homeLayer = [canvasEl, frameChrome];
  tl.to(homeLayer, {
    y: '-30vh',
    scale: 0.8,
    opacity: 0.65,
    duration: DUR,
    ease: EASE,
    force3D: true,
    transformOrigin: '50% 50%',
  }, 0);

  // DETAIL SLIDES UP from below the viewport — a real sheet landing on the
  // stack, not a mask unmasking static content. This is the thing that
  // separates "felt like a real new page" from "looks like a clip reveal".
  tl.fromTo(detailRoot,
    { y: '100%' },
    { y: '0%', duration: DUR, ease: EASE, force3D: true },
    0
  );

  // Detail content (head, title, foot) enters as the reveal lands.
  tl.add(() => enterDetailContent(detailRoot), 0.28);

  tl.add(() => { detailRoot.scrollTop = 0; });

  return tl.then();
}

// ── Reverse: back to home ───────────────────────────────────────

export function reverseSplice({ slider, frame, detailRoot, frameState }) {
  const frameChrome = document.querySelector('.frame');
  const canvasEl    = document.getElementById('canvas-container');
  const voidBackdrop = document.getElementById('void-backdrop');

  const tl = gsap.timeline();

  // Detail content (head, title, foot) leaves first.
  tl.add(() => leaveDetailContent(detailRoot), 0);

  // Detail slides back down out of the viewport.
  tl.to(detailRoot, {
    y: '100%',
    duration: DUR,
    ease: EASE,
    force3D: true,
  }, 0);

  // HOME LAYER RISES BACK — mirror of forward. Once it lands at scale 1 it
  // covers the viewport again, so the backdrop will no longer be visible.
  const homeLayer = [canvasEl, frameChrome];
  tl.to(homeLayer, {
    y: 0,
    scale: 1,
    opacity: 1,
    duration: DUR,
    ease: EASE,
    force3D: true,
    transformOrigin: '50% 50%',
  }, 0);

  // Snap the void off at the end (no animation — home covers it fully by now).
  tl.add(() => { gsap.set(voidBackdrop, { opacity: 0 }); });

  tl.add(() => {
    detailRoot.setAttribute('aria-hidden', 'true');
    detailRoot.classList.remove('active');
    detailRoot.innerHTML = '';
    // Reset detail to CSS-default off-screen position.
    gsap.set(detailRoot, { clearProps: 'transform' });
    document.body.classList.remove('route-frame');
    gsap.set(homeLayer, { clearProps: 'transform,opacity' });
  });

  return tl.then();
}

// Simple reverse used when the user direct-loaded the detail page (no preceding
// forward splice). We just fade the detail out and chrome in — no transform rise
// since the home never scaled away in the first place.
export function simpleReverse({ detailRoot }) {
  const frameChrome  = document.querySelector('.frame');
  const canvasEl     = document.getElementById('canvas-container');
  const voidBackdrop = document.getElementById('void-backdrop');

  const tl = gsap.timeline();
  tl.to(detailRoot,  { opacity: 0, duration: 0.4, ease: 'power2.in' }, 0);
  tl.to(canvasEl,    { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0);
  tl.to(frameChrome, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.1);
  tl.add(() => { gsap.set(voidBackdrop, { opacity: 0 }); }, 0.5);
  tl.add(() => {
    detailRoot.setAttribute('aria-hidden', 'true');
    detailRoot.classList.remove('active');
    detailRoot.innerHTML = '';
    gsap.set(detailRoot, { clearProps: 'transform,opacity' });
    document.body.classList.remove('route-frame');
  });
  return tl.then();
}

// Direct-load: detail page rendered instantly when the user reloads / pastes a
// /frame/:id URL. No reveal, no depth — just pin the detail open and keep the
// home hidden underneath.
export function directLoadDetail({ frame, detailRoot, frameState }) {
  const total = 25;
  detailRoot.innerHTML = renderDetail({
    frame,
    total,
    title: frameState.titles[frame],
    signature: frameState.signatures[frame],
    tech: frameState.tech[frame],
    imagePath: frameState.imagePaths[frame],
    gridImages: gridImagesFor(frame, frameState.imagePaths, 4),
    caption: captionFor(frame),
    stock: stockFor(frame),
    camera: cameraFor(frame),
    location: locationFor(frame),
  });
  prepDetailContent(detailRoot);
  detailRoot.setAttribute('aria-hidden', 'false');
  detailRoot.classList.add('active');
  // Pin detail on-screen (CSS default is translateY(100%) to keep it parked
  // below the viewport at rest).
  gsap.set(detailRoot, { y: '0%' });
  document.body.classList.add('route-frame');

  enterDetailContent(detailRoot);

  const frameChrome = document.querySelector('.frame');
  if (frameChrome) frameChrome.style.opacity = '0';
}
