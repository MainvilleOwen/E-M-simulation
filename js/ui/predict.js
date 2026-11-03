// Predict, then reveal. She picks an answer before the sim runs; then the sim runs; then a short "why".
import { h } from './dom.js';

/**
 * @param o.prompt     question HTML
 * @param o.options    [{ id, label }]
 * @param o.correct    id of the right answer
 * @param o.onPick     called with the choice when the sim should start
 * @param o.explain    (choice, correct) => HTML explanation pointing at the visible mechanism
 * @param o.delay      ms to let the sim run before the explanation appears
 * @param o.onReset    called when she wants to try again
 */
export function predictCard({ prompt, options, correct, onPick, explain, delay = 1500, onReset, title = 'Predict first' }) {
  let timer = null;
  let state = 'asking';
  const status = h('p', { class: 'predict-status', 'aria-live': 'polite' }, '');
  const why = h('div', { class: 'predict-why', hidden: true, 'aria-live': 'polite' });
  const buttons = options.map((o) => h('button', {
    type: 'button', class: 'predict-opt', data: { id: o.id }, html: o.label,
    on: { click: () => pick(o.id) },
  }));
  const again = h('button', { type: 'button', class: 'btn btn-ghost predict-again', hidden: true, on: { click: () => reset(true) } }, 'Ask me again');
  const el = h('section', { class: 'predict card', 'aria-label': 'Prediction' },
    h('div', { class: 'predict-head' }, h('span', { class: 'predict-tag' }, title)),
    h('p', { class: 'predict-prompt', html: prompt }),
    h('div', { class: 'predict-options', role: 'group' }, buttons),
    status, why, again);

  function pick(id) {
    if (state !== 'asking') return;
    state = 'running';
    el.dataset.state = 'running';
    for (const b of buttons) {
      b.disabled = true;
      if (b.dataset.id === id) b.classList.add('chosen');
    }
    status.textContent = 'Running the sim. Watch what happens.';
    if (onPick) onPick(id);
    timer = setTimeout(() => reveal(id), delay);
  }

  function reveal(id) {
    timer = null;
    state = 'revealed';
    el.dataset.state = 'revealed';
    for (const b of buttons) {
      if (b.dataset.id === correct) b.classList.add('correct');
    }
    const right = id === correct;
    const chosen = options.find((o) => o.id === id);
    const answer = options.find((o) => o.id === correct);
    status.innerHTML = right
      ? `Your prediction: ${chosen.label}. That is what the sim shows.`
      : `Your prediction: ${chosen.label}. The sim shows: ${answer.label}.`;
    why.innerHTML = explain ? explain(id, correct) : '';
    why.hidden = false;
    again.hidden = false;
  }

  function reset(user = false) {
    if (timer) clearTimeout(timer);
    timer = null;
    state = 'asking';
    el.dataset.state = 'asking';
    for (const b of buttons) { b.disabled = false; b.classList.remove('chosen', 'correct'); }
    status.textContent = '';
    why.hidden = true;
    why.innerHTML = '';
    again.hidden = true;
    if (user && onReset) onReset();
  }

  el.dataset.state = 'asking';
  return {
    el, pick, reset,
    get state() { return state; },
    destroy() { if (timer) clearTimeout(timer); },
  };
}
