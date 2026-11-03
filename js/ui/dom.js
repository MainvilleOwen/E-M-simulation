// Tiny DOM helpers.

let uid = 0;
export function nextId(prefix = 'id') { uid += 1; return `${prefix}-${uid}`; }

/**
 * h('div', { class: 'x', text: 'hi', on: { click: fn }, data: { sym: 'R' } }, child, ...)
 * Children may be strings, nodes, arrays, or null.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  appendAll(el, children);
  return el;
}

function appendAll(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) appendAll(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/**
 * An ⓘ note: a button that reveals a short explanation. Works by tap (no hover-only information).
 */
export function infoNote(text, { label = 'More info' } = {}) {
  const id = nextId('info');
  const body = h('span', { class: 'info-body', id, role: 'note', hidden: true, html: text });
  const btn = h('button', {
    type: 'button', class: 'info-btn', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': label,
    on: {
      click: () => {
        const open = body.hidden;
        body.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      },
    },
  }, 'ⓘ');
  return h('span', { class: 'info' }, btn, body);
}

/** Section header with title and optional subtitle. */
export function sectionTitle(title, sub) {
  return h('div', { class: 'section-title' }, h('h2', { html: title }), sub ? h('p', { class: 'muted', html: sub }) : null);
}

/** Simple button. */
export function button(label, onClick, { cls = '', title, ...rest } = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), title, on: { click: onClick }, html: label, ...rest });
}

/** Clear all children. */
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
