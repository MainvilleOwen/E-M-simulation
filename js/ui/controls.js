// DOM controls: slider, segmented toggle, readouts, equation reveal, symbol linking.
import { h, nextId } from './dom.js';
import { formatSI, toSig } from '../core/format.js';

const LOG_STEPS = 1000;

function snap(v, min, max, step) {
  let x = Math.min(max, Math.max(min, v));
  if (step > 0) x = min + Math.round((x - min) / step) * step;
  x = Math.min(max, Math.max(min, x));
  return parseFloat(x.toPrecision(12));
}

/**
 * Slider with label, live value, and − / + nudge buttons (44 px targets).
 * Values are clamped to [min, max] and snapped to step. log: true uses a logarithmic track.
 */
export function slider({ label, sym, min, max, step, value, unit = '', log = false, format, onInput, name }) {
  const id = nextId('sl');
  const fmt = format || ((v) => formatSI(v, unit));
  let current = log ? Math.min(max, Math.max(min, value)) : snap(value, min, max, step);
  const toRaw = (v) => (log ? Math.round((Math.log(v / min) / Math.log(max / min)) * LOG_STEPS) : v);
  const fromRaw = (r) => {
    if (!log) return snap(r, min, max, step);
    const v = min * (max / min) ** (Math.min(LOG_STEPS, Math.max(0, r)) / LOG_STEPS);
    return Math.min(max, Math.max(min, parseFloat(toSig(v, 3))));
  };
  const out = h('output', { for: id, class: 'slider-value' }, fmt(current));
  const input = h('input', {
    type: 'range', id, name: name || sym || id,
    min: log ? 0 : min, max: log ? LOG_STEPS : max, step: log ? 1 : step,
    value: toRaw(current), 'aria-valuetext': fmt(current),
  });
  const lab = h('label', { for: id, class: 'slider-label', data: sym ? { sym } : {} }, h('span', { html: label }));
  const set = (v, silent = false) => {
    const next = log ? Math.min(max, Math.max(min, v)) : snap(v, min, max, step);
    if (!Number.isFinite(next)) return;
    current = next;
    input.value = String(toRaw(current));
    out.textContent = fmt(current);
    input.setAttribute('aria-valuetext', fmt(current));
    if (!silent && onInput) onInput(current);
  };
  input.addEventListener('input', () => set(fromRaw(parseFloat(input.value))));
  const nudge = (dir) => {
    if (log) set(fromRaw(toRaw(current) + dir * 25));
    else set(current + dir * step);
  };
  const minus = h('button', { type: 'button', class: 'nudge', 'aria-label': `Decrease ${stripTags(label)}`, on: { click: () => nudge(-1) } }, '−');
  const plus = h('button', { type: 'button', class: 'nudge', 'aria-label': `Increase ${stripTags(label)}`, on: { click: () => nudge(1) } }, '+');
  const el = h('div', { class: 'slider', data: sym ? { sym } : {} },
    h('div', { class: 'slider-head' }, lab, out),
    h('div', { class: 'slider-row' }, minus, input, plus));
  return {
    el, input,
    get value() { return current; },
    set,
    setDisabled(d) { input.disabled = d; minus.disabled = d; plus.disabled = d; el.classList.toggle('disabled', d); },
  };
}

function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

/** Segmented toggle: one of several options. */
export function segmented({ label, options, value, onChange, small = false }) {
  let current = value;
  const buttons = new Map();
  const group = h('div', { class: `segmented${small ? ' small' : ''}`, role: 'group', 'aria-label': stripTags(label || '') });
  for (const opt of options) {
    const b = h('button', {
      type: 'button', class: 'seg', 'aria-pressed': String(opt.value === current), data: { value: String(opt.value) },
      html: opt.label,
      on: { click: () => set(opt.value) },
    });
    buttons.set(opt.value, b);
    group.appendChild(b);
  }
  const el = h('div', { class: 'control-group' }, label ? h('div', { class: 'control-label', html: label }) : null, group);
  function set(v, silent = false) {
    if (!buttons.has(v)) return;
    current = v;
    for (const [k, b] of buttons) b.setAttribute('aria-pressed', String(k === v));
    if (!silent && onChange) onChange(v);
  }
  return { el, get value() { return current; }, set, buttons };
}

/** Readouts: a compact grid of label → value. */
export function readouts(items, { cls = '' } = {}) {
  const vals = new Map();
  const el = h('dl', { class: `readouts ${cls}`.trim() });
  for (const it of items) {
    const v = h('dd', { class: 'readout-value' }, '—');
    vals.set(it.key, { v, it });
    el.appendChild(h('div', { class: 'readout', data: it.sym ? { sym: it.sym } : {} },
      h('dt', { html: it.label }), v));
  }
  return {
    el,
    set(key, value) {
      const r = vals.get(key);
      if (!r) return;
      const text = r.it.format ? r.it.format(value) : formatSI(value, r.it.unit || '');
      if (r.v.textContent !== text) r.v.textContent = text;
    },
    setText(key, text) {
      const r = vals.get(key);
      if (r && r.v.textContent !== text) r.v.textContent = text;
    },
  };
}

/** "Show the equation" button. The formula HTML should mark symbols with <span class="sym" data-sym="X">. */
export function equationReveal(html, { note = '' } = {}) {
  const id = nextId('eq');
  const box = h('div', { class: 'equation', id, hidden: true }, h('div', { class: 'equation-body', html }), note ? h('p', { class: 'equation-note muted', html: note }) : null);
  const btn = h('button', {
    type: 'button', class: 'btn btn-ghost eq-btn', 'aria-expanded': 'false', 'aria-controls': id,
    on: {
      click: () => {
        box.hidden = !box.hidden;
        btn.setAttribute('aria-expanded', String(!box.hidden));
        btn.textContent = box.hidden ? 'Show the equation' : 'Hide the equation';
      },
    },
  }, 'Show the equation');
  return { el: h('div', { class: 'equation-wrap' }, btn, box), box, btn };
}

/**
 * Tapping a formula symbol highlights its slider/readout, and tapping a slider label or readout
 * highlights the matching symbols. Elements share a data-sym attribute.
 */
export function linkSymbols(root, life) {
  let timer = null;
  const clearHi = () => { for (const e of root.querySelectorAll('.sym-hi')) e.classList.remove('sym-hi'); };
  life.on(root, 'click', (ev) => {
    const t = ev.target.closest('.sym, .slider-label, .readout');
    if (!t || !root.contains(t)) return;
    const holder = t.closest('[data-sym]');
    const sym = holder && holder.dataset.sym;
    if (!sym) return;
    clearHi();
    for (const e of root.querySelectorAll(`[data-sym="${CSS.escape(sym)}"]`)) e.classList.add('sym-hi');
    if (timer) clearTimeout(timer);
    timer = setTimeout(clearHi, 1800);
  });
  life.add(() => { if (timer) clearTimeout(timer); });
}

/** Play / pause / reset / speed controls. */
export function timeControls({ onPlay, onPause, onReset, onSpeed, speeds = [0.25, 0.5, 1, 2, 4], speed = 1 }) {
  let playing = false;
  const playBtn = h('button', { type: 'button', class: 'btn btn-primary tc-play', 'aria-label': 'Play' }, 'Play');
  const resetBtn = h('button', { type: 'button', class: 'btn tc-reset' }, 'Reset');
  const sp = segmented({
    label: 'Speed', small: true, value: speed,
    options: speeds.map((s) => ({ value: s, label: `${s}×` })),
    onChange: (v) => onSpeed && onSpeed(v),
  });
  const setPlaying = (p) => {
    playing = p;
    playBtn.textContent = p ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
  };
  playBtn.addEventListener('click', () => {
    if (playing) { setPlaying(false); if (onPause) onPause(); } else { setPlaying(true); if (onPlay) onPlay(); }
  });
  resetBtn.addEventListener('click', () => { if (onReset) onReset(); });
  const clock = h('div', { class: 'tc-clock', 'aria-live': 'off' }, '');
  const el = h('div', { class: 'time-controls' }, h('div', { class: 'btn-row' }, playBtn, resetBtn), sp.el, clock);
  return {
    el, clock,
    setPlaying,
    get playing() { return playing; },
    setClock(text) { if (clock.textContent !== text) clock.textContent = text; },
    speed: sp,
  };
}
