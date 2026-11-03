// Home: four cards, each with the question its module answers.
import { h } from '../ui/dom.js';

const CARDS = [
  {
    route: 'circuits', title: 'Circuits', tag: 'Start here',
    question: 'Why does adding a resistor in parallel let <em>more</em> current through?',
    detail: 'Series, parallel, reducing a circuit step by step, bulbs, and Kirchhoff’s loop rule.',
    icon: '<path d="M6 30 V10 H40" /><path d="M40 10 l4 -5 l4 10 l4 -10 l4 10 l4 -10 l4 5" /><path d="M68 10 H82 V30 H6" /><circle cx="22" cy="10" r="2.6" class="dot"/><circle cx="76" cy="30" r="2.6" class="dot"/>',
  },
  {
    route: 'rc', title: 'RC circuits',
    question: 'Why does a capacitor charge fast at first, then slower and slower?',
    detail: 'Watch the push-back q/C grow, the net push shrink, and the current fall.',
    icon: '<path d="M6 34 C 20 10, 40 6, 82 5" /><path d="M6 34 H82" class="axis"/><path d="M6 34 V4" class="axis"/>',
  },
  {
    route: 'capacitors', title: 'Capacitors',
    question: 'Why does pulling the plates apart change V in one case and Q in the other?',
    detail: 'The plate lab, series vs parallel, and where the energy goes when charge is shared.',
    icon: '<path d="M34 6 V34" /><path d="M54 6 V34" /><path d="M10 20 H34" /><path d="M54 20 H78" /><path d="M38 14 H50 M38 20 H50 M38 26 H50" class="axis"/>',
  },
  {
    route: 'fields', title: 'Fields and dipoles',
    question: 'How do the fields of several charges add up, and why does a dipole twist but not move?',
    detail: 'Drag charges, probe the field, and release a dipole in a uniform field.',
    icon: '<circle cx="26" cy="20" r="7" class="pos"/><circle cx="62" cy="20" r="7" class="neg"/><path d="M33 20 H55" /><path d="M30 13 C 40 2, 48 2, 58 13" /><path d="M30 27 C 40 38, 48 38, 58 27" />',
  },
];

export function mount(root, life) {
  const cards = CARDS.map((c) => h('a', { class: 'home-card', href: `#/${c.route}`, data: { route: c.route } },
    h('div', { class: 'home-card-top' },
      h('span', { class: 'home-icon-wrap', html: `<svg class="home-icon" viewBox="0 0 88 40" aria-hidden="true">${c.icon}</svg>` }),
      c.tag ? h('span', { class: 'home-tag' }, c.tag) : null),
    h('h2', {}, c.title),
    h('p', { class: 'home-q', html: c.question }),
    h('p', { class: 'home-detail muted' }, c.detail)));
  const introBtn = h('button', { type: 'button', class: 'btn btn-primary home-intro' }, 'How to read this app (30 seconds)');
  introBtn.addEventListener('click', async () => {
    const { openIntro } = await import('../ui/intro.js');
    openIntro();
  });
  root.append(
    h('section', { class: 'home-hero' },
      h('h1', {}, 'See why circuits and capacitors behave the way they do'),
      h('p', {}, 'Every picture here is driven by the real physics. Height shows voltage, moving dots show current, and arrows show the push on the charges. Pick one question; each takes about 3 to 5 minutes.'),
      h('div', { class: 'btn-row' }, introBtn)),
    h('div', { class: 'home-grid' }, cards),
    h('section', { class: 'home-tips card' },
      h('h2', {}, 'How to get the most out of it'),
      h('ul', {},
        h('li', {}, 'When a screen asks you to predict, pick an answer before the sim runs. A wrong guess is useful: the sim shows you why.'),
        h('li', {}, 'Change one thing at a time and watch the height map and the dots.'),
        h('li', {}, 'Each module ends with Solve: worked problems from the slides, then a variation with new numbers.'))));
  void life;
  return { unmount() {} };
}
