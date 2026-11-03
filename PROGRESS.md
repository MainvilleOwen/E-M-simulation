# E&M Lab: progress

Spec: `CLAUDE.md` (re-read it and this file at the start of every session).

## Phases

- [x] Phase 0: Setup (package.json, Vitest, Playwright, static server, skeleton index + router + error banner + design tokens)
- [x] Phase 1: Physics core (circuit.js, fields.js, format.js, section 5 tests): 79 unit tests green
- [x] Phase 2: UI kit + `#/kitchen-sink` (e2e green, screenshots in checks/phase2 reviewed)
- [ ] Phase 3: M1 Circuits
- [ ] Phase 4: M2 RC circuits
- [ ] Phase 5: M3 Capacitors
- [ ] Phase 6: M4 Fields & dipoles
- [ ] Phase 7: Home, intro, polish, fresh-eyes review
- [ ] Phase 8: Deploy to GitHub Pages (ask Owen first)
- [ ] Stretch: Inside a resistor

IN PROGRESS: Phase 3, starting M1 Circuits
Next: write js/modules/circuits.js with views one/series/parallel(compare+predict)/combination(reduce step by step)/bulbs(predict)/kirchhoff(walk the loop)/solve, plus M1 problems in js/content/problems.js and tests/e2e/circuits.spec.js.

## Notes

- `source/` (lecture PDFs) is not in the repo, so everything is built from the brief alone.
- Playwright: Chromium is pre-installed at `/opt/pw-browsers` (env `PLAYWRIGHT_BROWSERS_PATH`); `@playwright/test` is pinned to 1.63.0 to match it. Do not run `npx playwright install` in this container. On a fresh machine, run `npx playwright install chromium` once.
- Dev server: `npm run serve` (http-server on :8080). ES modules do not load from `file://`.
- `npm run check` = unit tests + link check + e2e (phone 390×844 touch, desktop 1366×768).

## Physics core notes

- `js/core/circuit.js`: MNA with LU (partial pivoting). `solveDC`, `Transient` (trapezoidal; consistent t=0+ state after every switch event so there is no ringing), `estimateTimeConstants` (exact natural modes from the generalized eigenproblem G·x = μ·C·x; the earlier "short the other capacitors" estimate gave bogus 1e-12 s values for capacitor loops).
- `js/content/presets.js`: every circuit the UI runs, plus `RANGES` (slider ranges). Tests import the same builders.
- Combination preset uses 42 V (Serway's version: 3 A total, 1 A in 6 Ω, 2 A in 3 Ω) because the slides are not in the repo.

## UI kit notes

- `js/content/layouts.js`: schematic layouts (logical units) + `bindLayout`. `tests/unit/layouts.test.js` checks Kirchhoff's junction rule at every endpoint of every layout (dots conserved) and that loops close.
- `js/ui/circuit-view.js`: schematic + height map. Height map uses a "side view" (x from the schematic, so ramps line up under their symbols) unless pieces give explicit x0/x1 (unrolled, used for walk-the-loop).
- `js/ui/stage.js`: canvases skip drawing when off-screen; e2e sets `window.__emlabAlwaysDraw = true` so full-page screenshots are live.
- `window.__emlab.stats()` = live frame callbacks (tests check it stays bounded); `window.__emlab.lastAnswer` = current variation answer (tests type it).

## Blockers

None.
