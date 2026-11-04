// App shell: hash router, module lifecycle, global error banner.
import { parseHash, MODULE_ROUTES } from './ui/route.js';
import { Lifecycle } from './ui/lifecycle.js';
import { animator } from './ui/animator.js';

const loaders = {
  '': () => import('./modules/home.js'),
  circuits: () => import('./modules/circuits.js'),
  rc: () => import('./modules/rc.js'),
  capacitors: () => import('./modules/capacitors.js'),
  fields: () => import('./modules/fields.js'),
  builder: () => import('./modules/builder.js'),
  'kitchen-sink': () => import('./modules/kitchen-sink.js'),
};

const TITLES = {
  '': 'E&M Lab',
  circuits: 'Circuits · E&M Lab',
  rc: 'RC circuits · E&M Lab',
  capacitors: 'Capacitors · E&M Lab',
  fields: 'Fields · E&M Lab',
  builder: 'Circuit builder · E&M Lab',
  'kitchen-sink': 'Kitchen sink · E&M Lab',
};

const view = document.getElementById('view');
const banner = document.getElementById('error-banner');
const reloadBtn = document.getElementById('error-reload');

let current = null; // { top, sub, life, instance }
let mountToken = 0;

function showErrorBanner() {
  banner.hidden = false;
}

function hideErrorBanner() {
  banner.hidden = true;
}

function setActiveNav(top) {
  for (const a of document.querySelectorAll('.topnav a')) {
    const on = a.dataset.route === top;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function unmountCurrent() {
  if (!current) return;
  try {
    if (current.instance && typeof current.instance.unmount === 'function') current.instance.unmount();
  } catch (err) {
    console.warn('unmount failed', err);
  }
  current.life.destroy();
  current = null;
  view.replaceChildren();
}

async function mountRoute(top, sub, { force = false } = {}) {
  if (!force && current && current.top === top) {
    if (current.sub !== sub) {
      current.sub = sub;
      if (current.instance && typeof current.instance.onRoute === 'function') {
        current.instance.onRoute(sub);
        return;
      }
    } else {
      return;
    }
  }
  const token = ++mountToken;
  unmountCurrent();
  hideErrorBanner();
  setActiveNav(top);
  document.title = TITLES[top] || 'E&M Lab';
  const life = new Lifecycle();
  current = { top, sub, life, instance: null };
  let mod;
  try {
    mod = await loaders[top]();
  } catch (err) {
    if (token !== mountToken) return;
    console.warn('module failed to load', err);
    showErrorBanner();
    return;
  }
  if (token !== mountToken || !life.alive) return;
  const root = document.createElement('div');
  root.className = `module module-${top || 'home'}`;
  view.replaceChildren(root);
  try {
    current.instance = mod.mount(root, life, sub) || null;
  } catch (err) {
    console.warn('module failed to mount', err);
    showErrorBanner();
  }
  window.scrollTo(0, 0);
}

function onHashChange() {
  const { top, sub } = parseHash(location.hash);
  mountRoute(top, sub);
}

// Errors anywhere show a calm banner rather than breaking the page silently.
window.onerror = (message, source, line, col, err) => {
  // A harmless browser notice when a resize causes another resize; not an app error.
  if (/ResizeObserver loop/.test(String(message))) return true;
  console.warn('Unhandled error:', err || message);
  showErrorBanner();
  return true;
};
window.addEventListener('unhandledrejection', (ev) => {
  console.warn('Unhandled rejection:', ev.reason);
  ev.preventDefault();
  showErrorBanner();
});
animator.onError((err) => {
  console.warn('Frame callback failed:', err);
  showErrorBanner();
});

reloadBtn.addEventListener('click', () => {
  hideErrorBanner();
  const top = current ? current.top : parseHash(location.hash).top;
  const sub = current ? current.sub : parseHash(location.hash).sub;
  mountRoute(top, sub, { force: true });
});

document.getElementById('help-btn').addEventListener('click', async () => {
  try {
    const { openIntro } = await import('./ui/intro.js');
    openIntro();
  } catch (err) {
    console.warn(err);
    showErrorBanner();
  }
});

window.addEventListener('hashchange', onHashChange);

// Test/debug hook: counts of live frame callbacks and the active route.
window.__emlab = {
  stats: () => ({ ...animator.stats(), route: current ? current.top : null }),
  modules: MODULE_ROUTES.slice(),
};

onHashChange();

// First visit: show the 30-second intro once.
(async () => {
  let seen = false;
  try { seen = localStorage.getItem('emlab.introSeen') === '1'; } catch { seen = true; }
  const { top } = parseHash(location.hash);
  if (!seen && top !== 'kitchen-sink') {
    try {
      const { openIntro } = await import('./ui/intro.js');
      openIntro();
    } catch (err) { console.warn(err); }
  }
})();
