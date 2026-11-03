// Compare layout: circuit A and circuit B side by side (stacked on a phone).
import { h } from './dom.js';

export function compareLayout(parent, { a, b, note } = {}) {
  const paneA = h('section', { class: 'compare-pane', 'aria-label': `Circuit A: ${strip(a)}` },
    h('div', { class: 'compare-badge' }, h('span', { class: 'badge' }, 'A'), h('span', { html: a })));
  const paneB = h('section', { class: 'compare-pane', 'aria-label': `Circuit B: ${strip(b)}` },
    h('div', { class: 'compare-badge' }, h('span', { class: 'badge badge-b' }, 'B'), h('span', { html: b })));
  const el = h('div', { class: 'compare' },
    note ? h('p', { class: 'compare-note muted small', html: note }) : null,
    h('div', { class: 'compare-grid' }, paneA, paneB));
  parent.appendChild(el);
  return { el, a: paneA, b: paneB };
}

function strip(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
