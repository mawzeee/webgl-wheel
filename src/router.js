const FRAME_RE = /^\/frame\/(\d{1,2})\/?$/;

export function parsePath(pathname) {
  const m = pathname.match(FRAME_RE);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 25) return { name: 'frame', frame: n - 1 };
  }
  return { name: 'home' };
}

export function framePath(frameIndex) {
  return `/frame/${String(frameIndex + 1).padStart(2, '0')}`;
}

export class Router {
  constructor({ onEnter, onLeave }) {
    this.onEnter = onEnter;
    this.onLeave = onLeave;
    this.current = parsePath(location.pathname);
    this.busy = false;
  }

  init() {
    window.addEventListener('popstate', () => this._go(parsePath(location.pathname), 'pop'));
  }

  async navigate(route) {
    if (this.busy) return;
    if (route.name === this.current.name &&
        route.frame === this.current.frame) return;
    const path = route.name === 'frame' ? framePath(route.frame) : '/';
    history.pushState({ route }, '', path);
    await this._go(route, 'push');
  }

  async _go(next, direction) {
    if (this.busy) return;
    this.busy = true;
    const prev = this.current;
    this.current = next;
    try {
      await this.onLeave?.(prev, next, direction);
      await this.onEnter?.(next, prev, direction);
    } finally {
      this.busy = false;
    }
  }
}
