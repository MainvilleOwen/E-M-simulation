# E&M Lab: progress

Spec: `CLAUDE.md` (re-read it and this file at the start of every session).

## Phases

- [x] Phase 0: Setup (package.json, Vitest, Playwright, static server, skeleton index + router + error banner + design tokens)
- [ ] Phase 1: Physics core (circuit.js, fields.js, format.js, section 5 tests)
- [ ] Phase 2: UI kit + `#/kitchen-sink`
- [ ] Phase 3: M1 Circuits
- [ ] Phase 4: M2 RC circuits
- [ ] Phase 5: M3 Capacitors
- [ ] Phase 6: M4 Fields & dipoles
- [ ] Phase 7: Home, intro, polish, fresh-eyes review
- [ ] Phase 8: Deploy to GitHub Pages (ask Owen first)
- [ ] Stretch: Inside a resistor

IN PROGRESS: Phase 1, starting physics core
Next: write js/core/format.js, js/core/circuit.js (MNA + transient), js/core/fields.js, js/core/formulas.js and tests/unit for every row of CLAUDE.md section 5.

## Notes

- `source/` (lecture PDFs) is not in the repo, so everything is built from the brief alone.
- Playwright: Chromium is pre-installed at `/opt/pw-browsers` (env `PLAYWRIGHT_BROWSERS_PATH`); `@playwright/test` is pinned to 1.63.0 to match it. Do not run `npx playwright install` in this container. On a fresh machine, run `npx playwright install chromium` once.
- Dev server: `npm run serve` (http-server on :8080). ES modules do not load from `file://`.
- `npm run check` = unit tests + link check + e2e (phone 390×844 touch, desktop 1366×768).

## Blockers

None.
