// "How to read this app": a 30-second, three-card intro. Shown on the first visit; reopen from the header.
import { h } from './dom.js';

const SLIDES = [
  {
    title: 'Height = voltage',
    text: 'Think of potential as height. The battery is a lift that raises charge by ε. Wires are flat. A resistor is a downhill ramp with a drop of IR. A capacitor is a step of height q/C. Colour shows height too (legend under each circuit).',
    svg: `<svg viewBox="0 0 260 120" role="img" aria-label="Height map: a lift up, a flat wire, a ramp down">
      <rect width="260" height="120" rx="10" fill="#121826"/>
      <line x1="20" y1="100" x2="240" y2="100" stroke="#3e4a89" stroke-width="4"/>
      <line x1="40" y1="100" x2="40" y2="24" stroke="#fde725" stroke-width="3"/>
      <line x1="48" y1="100" x2="48" y2="24" stroke="#fde725" stroke-width="3"/>
      <g stroke="#fde725" stroke-width="2">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="40" x2="48" y1="${92 - i * 11}" y2="${92 - i * 11}"/>`).join('')}</g>
      <line x1="48" y1="24" x2="130" y2="24" stroke="#fde725" stroke-width="4"/>
      <line x1="130" y1="24" x2="200" y2="100" stroke="#5ec962" stroke-width="6"/>
      <text x="22" y="16" fill="#e8ecf4" font-size="12">lift ε</text>
      <text x="74" y="16" fill="#e8ecf4" font-size="12">flat wire</text>
      <text x="168" y="54" fill="#e8ecf4" font-size="12">ramp: drop IR</text>
    </svg>`,
  },
  {
    title: 'Dots = current',
    text: 'Dots show conventional (positive) current. Faster dots mean more current, on one shared scale per screen. Dots are never used up: as many leave a junction as arrive. (Real electrons drift the other way, much more slowly.)',
    svg: `<svg viewBox="0 0 260 120" role="img" aria-label="A wire splitting into two lanes with dots">
      <rect width="260" height="120" rx="10" fill="#121826"/>
      <path d="M20 40 H100 M100 40 H240 M100 40 V84 H240" fill="none" stroke="#fde725" stroke-width="5"/>
      <g fill="#fff" stroke="#0b0f18" stroke-width="1.5">
        ${[30, 52, 74, 96].map((x) => `<circle cx="${x}" cy="40" r="5"/>`).join('')}
        ${[130, 175, 220].map((x) => `<circle cx="${x}" cy="40" r="5"/>`).join('')}
        ${[140, 200].map((x) => `<circle cx="${x}" cy="84" r="5"/>`).join('')}
      </g>
      <text x="20" y="24" fill="#e8ecf4" font-size="12">3 A in</text>
      <text x="150" y="24" fill="#e8ecf4" font-size="12">2 A</text>
      <text x="150" y="108" fill="#e8ecf4" font-size="12">1 A</text>
    </svg>`,
  },
  {
    title: 'Push arrows',
    text: 'Each resistor has an arrow sized by its voltage drop: the push that drives charge through it. In RC circuits the net push ε − q/C is drawn on its own, and you can watch it shrink as the capacitor charges.',
    svg: `<svg viewBox="0 0 260 120" role="img" aria-label="A resistor with a push arrow below it">
      <rect width="260" height="120" rx="10" fill="#121826"/>
      <path d="M20 46 H90 l8 -10 l12 20 l12 -20 l12 20 l12 -20 l8 10 H240" fill="none" stroke="#5ec962" stroke-width="5" stroke-linejoin="round"/>
      <line x1="92" y1="80" x2="160" y2="80" stroke="#cc79a7" stroke-width="5" stroke-linecap="round"/>
      <path d="M172 80 L156 70 L156 90 Z" fill="#cc79a7"/>
      <text x="92" y="106" fill="#e8ecf4" font-size="12">push = voltage drop</text>
    </svg>`,
  },
];

let open = null;

export function openIntro() {
  if (open) return;
  let i = 0;
  const prevFocus = document.activeElement;
  const title = h('h2', { id: 'intro-title' });
  const art = h('div', { class: 'intro-art' });
  const text = h('p', { class: 'intro-text' });
  const dots = h('div', { class: 'intro-dots', 'aria-hidden': 'true' }, SLIDES.map(() => h('span')));
  const back = h('button', { type: 'button', class: 'btn intro-back' }, 'Back');
  const next = h('button', { type: 'button', class: 'btn btn-primary intro-next' }, 'Next');
  const skip = h('button', { type: 'button', class: 'btn btn-ghost intro-skip' }, 'Skip');
  const dialog = h('div', { class: 'intro-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' },
    h('div', { class: 'intro-step muted small' }), title, art, text, dots,
    h('div', { class: 'btn-row intro-buttons' }, skip, back, next));
  const overlay = h('div', { class: 'intro-overlay' }, dialog);
  function render() {
    const s = SLIDES[i];
    dialog.querySelector('.intro-step').textContent = `How to read this app · ${i + 1} of ${SLIDES.length}`;
    title.textContent = s.title;
    art.innerHTML = s.svg;
    text.textContent = s.text;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    back.disabled = i === 0;
    next.textContent = i === SLIDES.length - 1 ? 'Start' : 'Next';
  }
  function close() {
    try { localStorage.setItem('emlab.introSeen', '1'); } catch { /* ignore */ }
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    open = null;
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...dialog.querySelectorAll('button:not(:disabled)')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  back.addEventListener('click', () => { if (i > 0) { i--; render(); } });
  next.addEventListener('click', () => { if (i < SLIDES.length - 1) { i++; render(); } else close(); });
  skip.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  open = overlay;
  render();
  next.focus();
}
