// Solve mode: a slide-style statement, the solution as steps (each one sentence plus an action on the sim),
// then "Try a variation" with a typed answer checked against the solver within 2%.
import { h } from './dom.js';
import { parseAnswer, withinTolerance, formatSI } from '../core/format.js';

/**
 * problem = {
 *   id, title,
 *   statement(params) → HTML,
 *   defaults: params,
 *   setup(ctx, params)            load this exact setup in the sim
 *   steps: [{ text(params, ctx) → HTML, act(ctx, params) }],
 *   variation: { make(rand) → params, ask(params) → HTML, answer(ctx, params) → { value, unit }, revisit: stepIndex }
 * }
 * ctx is whatever the module passes (its sim controller).
 */
export function solveRunner(parent, life, problem, ctx, { index = 0 } = {}) {
  let params = { ...problem.defaults };
  let shown = 0;
  let mode = 'solution';
  let expected = null;

  const head = h('div', { class: 'slide-head' }, h('span', { class: 'slide-num' }, `Problem ${index + 1}`), h('span', { class: 'slide-title', html: problem.title }));
  const statement = h('div', { class: 'slide-body' });
  const stepsList = h('ol', { class: 'steps' });
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary solve-next' }, 'Show step 1');
  const restartBtn = h('button', { type: 'button', class: 'btn solve-restart' }, 'Start over');
  const varBtn = h('button', { type: 'button', class: 'btn btn-primary solve-variation', hidden: true }, 'Try a variation');
  const varBox = h('div', { class: 'variation', hidden: true });
  const el = h('section', { class: 'solve', 'aria-label': `Problem: ${String(problem.title).replace(/<[^>]+>/g, '')}` },
    h('div', { class: 'slide card' }, head, statement),
    stepsList,
    h('div', { class: 'btn-row solve-buttons' }, nextBtn, varBtn, restartBtn),
    varBox);
  parent.appendChild(el);

  function load(p) {
    params = { ...p };
    try { problem.setup(ctx, params); } catch (err) { console.warn('setup failed', err); }
  }

  function renderStatement() {
    statement.innerHTML = problem.statement(params);
  }

  function showStep(i) {
    const step = problem.steps[i];
    const li = h('li', { class: 'step' }, h('span', { html: step.text(params, ctx) }));
    stepsList.appendChild(li);
    try { if (step.act) step.act(ctx, params); } catch (err) { console.warn('step action failed', err); }
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function updateButtons() {
    const done = shown >= problem.steps.length;
    nextBtn.hidden = done;
    nextBtn.textContent = `Show step ${shown + 1} of ${problem.steps.length}`;
    varBtn.hidden = !done || !problem.variation;
  }

  function restart() {
    mode = 'solution';
    shown = 0;
    stepsList.replaceChildren();
    varBox.hidden = true;
    varBox.replaceChildren();
    load(problem.defaults);
    renderStatement();
    updateButtons();
  }

  nextBtn.addEventListener('click', () => {
    if (shown >= problem.steps.length) return;
    showStep(shown);
    shown += 1;
    updateButtons();
  });
  restartBtn.addEventListener('click', restart);
  varBtn.addEventListener('click', () => startVariation());

  function startVariation() {
    mode = 'variation';
    const v = problem.variation;
    load(v.make(Math.random));
    renderStatement();
    stepsList.replaceChildren();
    shown = problem.steps.length;
    const ans = v.answer(ctx, params);
    expected = ans;
    if (typeof window !== 'undefined' && window.__emlab) window.__emlab.lastAnswer = { value: ans.value, unit: ans.unit };
    const input = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', class: 'answer-input',
      'aria-label': 'Your answer',
    });
    const feedback = h('p', { class: 'feedback', 'aria-live': 'polite' });
    const check = h('button', { type: 'button', class: 'btn btn-primary answer-check' }, 'Check');
    const another = h('button', { type: 'button', class: 'btn answer-new' }, 'New numbers');
    const doCheck = () => {
      const val = parseAnswer(input.value, ans.unit);
      if (!Number.isFinite(val)) {
        feedback.className = 'feedback';
        feedback.textContent = `Type a number, for example 2.5 or 2.5 ${ans.unit || ''}. Prefixes like m, k and µ (or u) work.`.trim();
        return;
      }
      if (withinTolerance(val, ans.value, 0.02)) {
        feedback.className = 'feedback good';
        feedback.textContent = `That matches the sim: ${formatSI(ans.value, ans.unit)}.`;
      } else {
        const step = problem.steps[v.revisit || 0];
        const stepText = step ? step.text(params, ctx).replace(/<[^>]+>/g, '') : '';
        feedback.className = 'feedback off';
        feedback.innerHTML = '';
        feedback.append(
          `Not quite. You entered ${formatSI(val, ans.unit)}; the sim gives ${formatSI(ans.value, ans.unit)}. `,
          h('br'),
          `Revisit step ${(v.revisit || 0) + 1}: ${stepText}`,
        );
      }
    };
    check.addEventListener('click', doCheck);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); });
    another.addEventListener('click', () => startVariation());
    varBox.replaceChildren(
      h('p', { class: 'variation-q', html: v.ask(params) }),
      h('div', { class: 'answer-row' }, input, h('span', { class: 'answer-unit' }, ans.unit || ''), check),
      feedback,
      h('div', { class: 'btn-row' }, another, h('button', { type: 'button', class: 'btn btn-ghost', on: { click: restart } }, 'Back to the worked solution')),
    );
    varBox.hidden = false;
    varBtn.hidden = true;
    nextBtn.hidden = true;
  }

  restart();
  return {
    el, restart,
    get mode() { return mode; },
    get expected() { return expected; },
  };
}
