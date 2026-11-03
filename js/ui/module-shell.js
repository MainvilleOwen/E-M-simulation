// Shared module scaffold: title, guiding question, sub-view tabs linked to the hash route.
import { h } from './dom.js';
import { buildHash } from './route.js';

/**
 * @param o.route    top-level route, e.g. 'circuits'
 * @param o.title    module title
 * @param o.question guiding question
 * @param o.views    [{ id, label, mount(container, life) }]
 * @returns { onRoute(sub) } for the router
 */
export function moduleShell(root, life, { route, title, question, views, initial }) {
  const tabs = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': `${title} views` });
  const body = h('div', { class: 'view-host' });
  root.append(
    h('header', { class: 'module-head' }, h('h1', { html: title }), question ? h('p', { html: question }) : null),
    tabs, body);
  const links = new Map();
  for (const v of views) {
    const a = h('a', {
      class: 'tab', role: 'tab', href: buildHash(route, v.id), 'aria-selected': 'false', data: { view: v.id }, html: v.label,
    });
    links.set(v.id, a);
    tabs.appendChild(a);
  }
  let currentId = null;
  let viewLife = null;

  function show(id) {
    const v = views.find((x) => x.id === id) || views[0];
    if (v.id === currentId) return;
    if (viewLife) viewLife.destroy();
    body.replaceChildren();
    currentId = v.id;
    for (const [k, a] of links) a.setAttribute('aria-selected', String(k === v.id));
    const link = links.get(v.id);
    if (link && link.scrollIntoView && tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollLeft = Math.max(0, link.offsetLeft - 24);
    }
    viewLife = life.child();
    const container = h('div', { class: `view view-${v.id}`, data: { view: v.id } });
    body.appendChild(container);
    v.mount(container, viewLife);
  }

  show(initial || views[0].id);
  return {
    onRoute(sub) { show(sub ? sub.split('/')[0] : views[0].id); },
    get current() { return currentId; },
  };
}

/** Two-column view body: simulation column and control column. */
export function viewBody(container, intro) {
  if (intro) container.appendChild(h('p', { class: 'view-intro', html: intro }));
  const sim = h('div', { class: 'sim-col' });
  const ctrl = h('aside', { class: 'ctrl-col', 'aria-label': 'Controls and readouts' });
  container.appendChild(h('div', { class: 'view-body' }, sim, ctrl));
  return { sim, ctrl };
}

/** Card in the control column. */
export function ctrlCard(parent, title, ...children) {
  const card = h('section', { class: 'ctrl-card' }, title ? h('h3', { html: title }) : null, ...children);
  parent.appendChild(card);
  return card;
}

/**
 * Put a prediction card where it is seen first: top of the control column on wide screens,
 * above the simulation on phones. Re-places it if the window crosses the breakpoint.
 */
export function placePredict(card, sim, ctrl, life) {
  const mql = typeof matchMedia === 'function' ? matchMedia('(min-width: 960px)') : null;
  const place = () => {
    const wide = mql && mql.matches;
    const target = wide ? ctrl : sim;
    if (card.parentNode !== target) target.insertBefore(card, target.firstChild);
  };
  place();
  if (mql) life.on(mql, 'change', place);
}

/**
 * Place an element responsively: on wide screens prepend it to `wideParent`; on phones insert it
 * into `narrowParent` right after `narrowAfter` (or first if not given).
 */
export function placeResponsive(el, { wideParent, narrowParent, narrowAfter = null }, life) {
  const mql = typeof matchMedia === 'function' ? matchMedia('(min-width: 960px)') : null;
  const place = () => {
    if (mql && mql.matches) {
      if (el.parentNode !== wideParent || wideParent.firstChild !== el) wideParent.insertBefore(el, wideParent.firstChild);
    } else {
      const ref = narrowAfter ? narrowAfter.nextSibling : narrowParent.firstChild;
      if (ref !== el) narrowParent.insertBefore(el, ref);
    }
  };
  place();
  if (mql) life.on(mql, 'change', place);
}
