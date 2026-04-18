import { gsap } from 'gsap';

// Expanded per-frame narrative/credit copy. Tailored to the frame's title.
// Kept deliberately short; the detail page is cinematic, not a blog post.
const CAPTIONS = [
  'A rollercoaster, three-deep, cotton candy and denial. A study in commitment to the bit.',
  'Red moon, brass bowls, a desert about to apologise. The gear is for the vibes.',
  'Every opinion you had returned, at speed, in yellow.',
  'Prayer as exit strategy. You have been marked unavailable.',
  'Popcorn protagonists. The scene is happening because they said so.',
  'The last supper, but everybody ordered the same thing.',
  'Coastline as coping mechanism. The phone is on silent.',
  'Subway platform, wrong line, right outfit. A patient crisis.',
  'Comfort comes sprinkled. A bouquet of carbs for solo dining.',
  'Moonlight poker. You are losing with dignity.',
  'Committed eating. Neither shirt will recover.',
  'Paris as a budgeting problem. The espresso is the only honest thing.',
  'The dog reads finance. The dog does not need your advice.',
  'Incoming call, declined. The receiver weighs four pounds and an apology.',
  'A cart full of motion. Every ball a missed serve.',
  'Pink Ferrari, two dogs, no plan. The teeth are for decoration.',
  'Chess in fur. A power move with maintenance costs.',
  'Bridal suite to backseat. The city is indifferent, as cities are.',
  'Twins by spirit. One appointment, two diagnoses.',
  'Sub-bass sermon. Please do not request the song.',
  'Nine lives, one fit. The lollipop is non-negotiable.',
  'Altitude chess. The weather is a second opponent.',
  'A pizza seen from God. The crusts judge you.',
  'He left, she stayed, the leftovers won.',
  'Still in beta. Forever, probably.',
];

// Kodak stocks rotated to feel artisanal. Not tied to actual film chemistry.
const STOCKS = [
  'Kodak Vision3 250D',  'Kodak Portra 400',    'Kodak Ektar 100',
  'Kodak Tri-X 400',     'Kodak Gold 200',      'Fujifilm Pro 400H',
  'CineStill 800T',      'Ilford HP5 Plus',     'Kodak Ektachrome E100',
];
const CAMERAS = [
  'Leica M6',  'Contax T2',  'Canon AE-1',  'Nikon F3',
  'Mamiya 7',  'Hasselblad 500CM',  'Pentax 67',
];
const LOCATIONS = [
  'Lisbon, PT', 'Tokyo, JP', 'Marfa, TX', 'Mexico City, MX',
  'Marrakesh, MA', 'Reykjavík, IS', 'Seoul, KR', 'Naples, IT',
];

const pad3 = n => String(n).padStart(3, '0');

export function renderDetail({ frame, total, title, signature, tech, imagePath, caption, stock, camera, location, gridImages }) {
  const titleClean = title.replace(/<br\s*\/?>/gi, ' ');
  const titleLines = title.split(/<br\s*\/?>/i);
  const titleHtml = titleLines
    .map(l => `<span class="detail-header__line"><span>${l.trim()}</span></span>`)
    .join('');

  // gridImages is [-2, -1, clicked, +1, +2]. The clicked (center) slot is
  // rendered as an empty 4-col placeholder so the four flanking frames keep
  // their 2c width — the "hole" in the middle is where the slider frame
  // would have lived, conceptually.
  const centerIdx = Math.floor(gridImages.length / 2);
  const gridCells = gridImages
    .map((src, i) => {
      if (i === centerIdx) {
        return `<div class="detail-grid__cell detail-grid__cell--empty" aria-hidden="true"></div>`;
      }
      return `<figure class="detail-grid__cell">
        <img src="${src}" alt="" loading="lazy" />
      </figure>`;
    }).join('');

  return `
    <article class="detail__page" data-frame="${frame}">
      <section class="detail-hero-section">
        <header class="detail-top">
          <a href="/" class="detail-top__back" data-nav="home">
            <span class="detail-top__arrow">←</span>
            <span>Back to reel</span>
          </a>
          <span class="detail-top__idx">${pad3(frame + 1)} / ${pad3(total)}</span>
        </header>

        <div class="detail-header">
          <span class="detail-header__eyebrow">FRAME ${pad3(frame + 1)} · ${stock}</span>
          <h1 class="detail-header__title">${titleHtml}</h1>
          <div class="detail-header__exif">
            <span>ISO ${tech.iso}</span>
            <span class="detail-header__sep">·</span>
            <span>${tech.ap}</span>
            <span class="detail-header__sep">·</span>
            <span>${tech.sh}s</span>
            <span class="detail-header__sep">·</span>
            <span>EV ${tech.ev}</span>
          </div>
        </div>

        <section class="detail-grid" aria-label="Frame spread">
          ${gridCells}
        </section>
      </section>

      <section class="detail-story">
        <div class="detail-story__inner">
          <span class="detail-story__eyebrow">FRAME ${pad3(frame + 1)} · CAPTION</span>
          <p class="detail-story__lead">${caption}</p>
          <div class="detail-story__meta">
            <div class="detail-story__col">
              <span class="detail-story__key">CAMERA</span>
              <span class="detail-story__val">${camera}</span>
            </div>
            <div class="detail-story__col">
              <span class="detail-story__key">LOCATION</span>
              <span class="detail-story__val">${location}</span>
            </div>
            <div class="detail-story__col">
              <span class="detail-story__key">STOCK</span>
              <span class="detail-story__val">${stock}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="detail-sig">
        <div class="detail-sig__inner">
          <span class="detail-sig__eyebrow">SIGNATURE</span>
          <div class="detail-sig__grid">
            <div class="detail-sig__row">
              <span class="detail-sig__key">STYLIZE</span>
              <span class="detail-sig__bar"><i style="width:${(signature.stylize / 1000) * 100}%"></i></span>
              <span class="detail-sig__val">${pad3(signature.stylize)}</span>
            </div>
            <div class="detail-sig__row">
              <span class="detail-sig__key">CHAOS</span>
              <span class="detail-sig__bar"><i style="width:${(signature.chaos / 100) * 100}%"></i></span>
              <span class="detail-sig__val">${String(signature.chaos).padStart(2,'0')}</span>
            </div>
            <div class="detail-sig__row">
              <span class="detail-sig__key">WEIGHT</span>
              <span class="detail-sig__bar"><i style="width:${(signature.weight / 2) * 100}%"></i></span>
              <span class="detail-sig__val">${signature.weight.toFixed(2)}</span>
            </div>
            <div class="detail-sig__row">
              <span class="detail-sig__key">TEMP</span>
              <span class="detail-sig__bar"><i style="width:${((signature.temp - 2000) / 8000) * 100}%"></i></span>
              <span class="detail-sig__val">${Math.round(signature.temp / 10) * 10}K</span>
            </div>
            <div class="detail-sig__row">
              <span class="detail-sig__key">SATURATION</span>
              <span class="detail-sig__bar"><i style="width:${(signature.sat / 100) * 100}%"></i></span>
              <span class="detail-sig__val">${signature.sat}%</span>
            </div>
            <div class="detail-sig__row detail-sig__row--seed">
              <span class="detail-sig__key">SEED</span>
              <span class="detail-sig__val">${signature.seed}</span>
            </div>
          </div>
        </div>
      </section>

      <footer class="detail-foot">
        <span>MAWZE</span>
        <span>${pad3(frame + 1)} / ${pad3(total)}</span>
        <a href="/" class="detail-foot__back" data-nav="home">Return to reel →</a>
      </footer>
    </article>
  `;
}

export function captionFor(i)  { return CAPTIONS[i] || ''; }
export function stockFor(i)    { return STOCKS[i % STOCKS.length]; }
export function cameraFor(i)   { return CAMERAS[i % CAMERAS.length]; }
export function locationFor(i) { return LOCATIONS[i % LOCATIONS.length]; }

// Call immediately after inserting detail HTML — parks every animated element
// in its "from" state synchronously so no frame ever paints them at their
// final opacity before the timeline gets a chance to run.
export function prepDetailContent(root) {
  const top   = root.querySelector('.detail-top');
  const cells = root.querySelectorAll('.detail-grid__cell:not(.detail-grid__cell--empty)');
  const title = root.querySelectorAll('.detail-header__line > span');
  const eye   = root.querySelector('.detail-header__eyebrow');
  const exif  = root.querySelector('.detail-header__exif');

  gsap.set(top,   { y: -14, opacity: 0 });
  gsap.set(cells, { y: 24, opacity: 0 });
  gsap.set(eye,   { y: 10, opacity: 0 });
  gsap.set(title, { y: '115%' });
  gsap.set(exif,  { y: 10, opacity: 0 });
}

// Intro animation: top bar fades in, grid cells rise with a stagger, then
// the title lines slide up and the exif row lands.
export function enterDetailContent(root) {
  const top   = root.querySelector('.detail-top');
  const cells = root.querySelectorAll('.detail-grid__cell:not(.detail-grid__cell--empty)');
  const title = root.querySelectorAll('.detail-header__line > span');
  const eye   = root.querySelector('.detail-header__eyebrow');
  const exif  = root.querySelector('.detail-header__exif');

  const tl = gsap.timeline();
  tl.to(top,   { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out' }, 0);
  tl.to(cells, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, 0.05);
  tl.to(eye,   { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.35);
  tl.to(title, { y: '0%', duration: 0.85, ease: 'power3.out', stagger: 0.06 }, 0.4);
  tl.to(exif,  { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.55);
  return tl;
}

export function leaveDetailContent(root) {
  const top   = root.querySelector('.detail-top');
  const cells = root.querySelectorAll('.detail-grid__cell:not(.detail-grid__cell--empty)');
  const title = root.querySelectorAll('.detail-header__line > span');
  const header = root.querySelector('.detail-header');

  const tl = gsap.timeline();
  tl.to([top, header], { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
  tl.to(title, { y: '115%', duration: 0.35, ease: 'power2.in', stagger: 0.03 }, 0);
  tl.to(cells, { y: 12, opacity: 0, duration: 0.3, ease: 'power2.in', stagger: 0.03 }, 0);
  return tl;
}

// Builds the 5-cell grid for a given frame: [frame-2, frame-1, frame, frame+1, frame+2]
// (all wrapped mod IMAGE_COUNT). The clicked frame lives dead-center at a
// larger span, flanked by its two nearest neighbours on each side.
export function gridImagesFor(frame, imagePaths) {
  const total = imagePaths.length;
  const arr = [];
  for (let i = -2; i <= 2; i++) {
    arr.push(imagePaths[((frame + i) % total + total) % total]);
  }
  return arr;
}
