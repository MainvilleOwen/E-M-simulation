import { animator } from './animator.js';

// Tracks everything a mounted module creates (listeners, frame callbacks, observers, timers)
// so a single destroy() tears it all down. Prevents leaks and double loops on module switches.
export class Lifecycle {
  constructor() {
    this.cleanups = [];
    this.alive = true;
  }

  add(fn) {
    if (!this.alive) { try { fn(); } catch { /* ignore */ } return fn; }
    this.cleanups.push(fn);
    return fn;
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    return this.add(() => target.removeEventListener(type, fn, opts));
  }

  frame(fn) {
    if (!this.alive) return () => {};
    const off = animator.add(fn);
    this.add(off);
    return off;
  }

  resize(el, fn) {
    if (typeof ResizeObserver === 'undefined') {
      return this.on(window, 'resize', () => fn());
    }
    const ro = new ResizeObserver(() => { if (this.alive) fn(); });
    ro.observe(el);
    return this.add(() => ro.disconnect());
  }

  visible(el, fn) {
    if (typeof IntersectionObserver === 'undefined') { fn(true); return () => {}; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) fn(e.isIntersecting);
    });
    io.observe(el);
    return this.add(() => io.disconnect());
  }

  timeout(fn, ms) {
    const id = setTimeout(() => { if (this.alive) fn(); }, ms);
    return this.add(() => clearTimeout(id));
  }

  interval(fn, ms) {
    const id = setInterval(() => { if (this.alive) fn(); }, ms);
    return this.add(() => clearInterval(id));
  }

  child() {
    const c = new Lifecycle();
    this.add(() => c.destroy());
    return c;
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const list = this.cleanups.splice(0).reverse();
    for (const fn of list) {
      try { fn(); } catch (err) { console.warn('cleanup failed', err); }
    }
  }
}
