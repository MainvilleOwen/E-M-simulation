// One shared requestAnimationFrame loop for the whole app.
// Modules register frame callbacks through their Lifecycle, which removes them on unmount.
// The loop stops when the tab is hidden or nothing is registered.

const callbacks = new Set();
let rafId = null;
let lastTime = 0;
let frames = 0;
let errorHandler = null;

function tick(now) {
  rafId = null;
  const dt = lastTime ? Math.min(0.1, Math.max(0, (now - lastTime) / 1000)) : 1 / 60;
  lastTime = now;
  frames++;
  for (const cb of Array.from(callbacks)) {
    if (!callbacks.has(cb)) continue;
    try {
      cb(dt, now);
    } catch (err) {
      callbacks.delete(cb);
      if (errorHandler) errorHandler(err);
      else setTimeout(() => { throw err; });
    }
  }
  schedule();
}

function schedule() {
  if (rafId !== null || callbacks.size === 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  rafId = requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    } else {
      lastTime = 0;
      schedule();
    }
  });
}

export const animator = {
  add(cb) {
    callbacks.add(cb);
    schedule();
    return () => {
      callbacks.delete(cb);
      if (callbacks.size === 0 && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        lastTime = 0;
      }
    };
  },
  onError(fn) { errorHandler = fn; },
  stats() {
    return { callbacks: callbacks.size, frames, running: rafId !== null };
  },
};
