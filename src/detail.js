import { gsap } from 'gsap';

// Expanded per-frame narrative/credit copy. Tailored to the frame's title.
// Kept deliberately short; the detail page is cinematic, not a blog post.
// Caption per frame. The image roster has been replaced; lines below
// hold their old slot order and may not narratively match the new
// photographs — Karim will rewrite per-slide as he curates.
const CAPTIONS = [
  'Suit, smoke, sand, horse. The car has been still longer than he has.',                       // 1
  'A rollercoaster, three-deep, cotton candy and denial. A study in commitment to the bit.',     // 2
  'Red moon, brass bowls, a desert about to apologise. The gear is for the vibes.',              // 3
  'Every opinion you had returned, at speed, in yellow.',                                        // 4
  'Prayer as exit strategy. You have been marked unavailable.',                                  // 5
  'Popcorn protagonists. The scene is happening because they said so.',                          // 6
  'The last supper, but everybody ordered the same thing.',                                      // 7
  'Coastline as coping mechanism. The phone is on silent.',                                      // 8
  'Subway platform, wrong line, right outfit. A patient crisis.',                                // 9
  'Comfort comes sprinkled. A bouquet of carbs for solo dining.',                                // 10
  'Moonlight poker. You are losing with dignity.',                                               // 11
  'Committed eating. Neither shirt will recover.',                                               // 12
  'Paris as a budgeting problem. The espresso is the only honest thing.',                        // 13
  'The dog reads finance. The dog does not need your advice.',                                   // 14
  'Incoming call, declined. The receiver weighs four pounds and an apology.',                    // 15
  'A cart full of motion. Every ball a missed serve.',                                           // 16
  'Pink Ferrari, two dogs, no plan. The teeth are for decoration.',                              // 17
  'Chess in fur. A power move with maintenance costs.',                                          // 18
  'Bridal suite to backseat. The city is indifferent, as cities are.',                           // 19
  'Twins by spirit. One appointment, two diagnoses.',                                            // 20
  'Sub-bass sermon. Please do not request the song.',                                            // 21
  'Nine lives, one fit. The lollipop is non-negotiable.',                                        // 22
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

export function renderDetail({ frame, total, title, signature, tech, imagePath, caption, stock, camera, location }) {
  const titleLines = title.split(/<br\s*\/?>/i);
  const titleHtml = titleLines
    .map(l => `<span class="detail-header__line"><span>${l.trim()}</span></span>`)
    .join('');

  return `
    <article class="detail__page" data-frame="${frame}">
      <!-- HERO — transparent 100vh spacer. The cylinder mesh on the canvas
           below (z:10) is scaled to fill the viewport during the route
           transition; this section gives it room to BREATHE through the
           detail page. Chrome (top bar, EXIF, status) sits absolutely
           on top of the projected frame. -->
      <section class="detail-hero-section">
        <header class="detail-top">
          <a href="/" class="detail-top__back" data-nav="home">
            <span class="detail-top__arrow">←</span>
            <span>Back to reel</span>
          </a>
          <span class="detail-top__idx">${pad3(frame + 1)} / ${pad3(total)}</span>
        </header>

        <!-- BL: EXIF rail. Same letterforms, same baseline as home. -->
        <div class="detail-exif">
          <span class="detail-exif__idx">${pad3(frame + 1)}/${pad3(total)}</span>
          <span class="detail-exif__sep">·</span>
          <span>ISO ${tech.iso}</span>
          <span class="detail-exif__sep">·</span>
          <span>${tech.ap}</span>
          <span class="detail-exif__sep">·</span>
          <span>${tech.sh}<i>s</i></span>
          <span class="detail-exif__sep">·</span>
          <span>EV ${tech.ev}</span>
        </div>

        <!-- BR: stock + LOCKED. The single new word on the page. -->
        <div class="detail-status">
          <span>35mm · ${stock}</span>
          <span class="detail-status__sep">·</span>
          <span class="detail-status__locked">LOCKED</span>
        </div>
      </section>

      <section class="detail-story">
        <div class="detail-story__inner">
          <span class="detail-story__eyebrow">FRAME ${pad3(frame + 1)} · ${stock}</span>
          <h1 class="detail-story__title">${titleHtml}</h1>
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
  const top    = root.querySelector('.detail-top');
  const exif   = root.querySelector('.detail-exif');
  const status = root.querySelector('.detail-status');
  // Long-form title lines (the dark-humor title now lives in .detail-story).
  // Parked off-mask so they slide up when scroll-revealed.
  const title  = root.querySelectorAll('.detail-story__title .detail-header__line > span');

  gsap.set(top,    { y: -14, opacity: 0 });
  gsap.set(exif,   { y: 10, opacity: 0 });
  gsap.set(status, { y: 10, opacity: 0 });
  gsap.set(title,  { y: '115%' });
}

// Intro animation: hero chrome only — top bar, EXIF rail, status. The lens
// layer with the held still is animated separately via transition.js
// (the gate is the spatial anchor; it doesn't enter, it stays). The
// dark-humor title lives in the long-form section and reveals on scroll.
export function enterDetailContent(root) {
  const top    = root.querySelector('.detail-top');
  const exif   = root.querySelector('.detail-exif');
  const status = root.querySelector('.detail-status');

  const tl = gsap.timeline();
  tl.to(top,    { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out' }, 0);
  tl.to(exif,   { y: 0, opacity: 1, duration: 0.5,  ease: 'power2.out' }, 0.22);
  tl.to(status, { y: 0, opacity: 1, duration: 0.5,  ease: 'power2.out' }, 0.30);
  return tl;
}

export function leaveDetailContent(root) {
  const top    = root.querySelector('.detail-top');
  const exif   = root.querySelector('.detail-exif');
  const status = root.querySelector('.detail-status');

  const tl = gsap.timeline();
  tl.to([top, exif, status], { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
  return tl;
}
