# E&M Lab: progress

Spec: `CLAUDE.md` (re-read it and this file at the start of every session).

## Phases

- [x] Phase 0: Setup (package.json, Vitest, Playwright, static server, skeleton index + router + error banner + design tokens)
- [x] Phase 1: Physics core (circuit.js, fields.js, format.js, section 5 tests): 79 unit tests green
- [x] Phase 2: UI kit + `#/kitchen-sink` (e2e green, screenshots in checks/phase2 reviewed)
- [x] Phase 3: M1 Circuits (7 views, e2e green both viewports, checks/phase3 reviewed)
- [x] Phase 4: M2 RC circuits (charging, discharging, 2 solve problems; e2e green; checks/phase4 reviewed)
- [x] Phase 5: M3 Capacitors (plate lab, series vs parallel, charge sharing, 3 solve problems; e2e green; checks/phase5 reviewed)
- [x] Phase 6: M4 Fields & dipoles (sandbox, dipole, 2 solve problems; e2e green; checks/phase6 reviewed)
- [x] Phase 7: Home, intro, polish, fresh-eyes review (review issues fixed; npm run check green)
- [ ] Phase 8: Deploy to GitHub Pages: blocked on Owen (gh auth invalid in container; see DEPLOY.md)
- [ ] Stretch: Inside a resistor

IN PROGRESS: Phase 8, waiting for Owen to confirm making the repo public and enabling Pages
Next: Owen follows DEPLOY.md (merge to main, Settings → Pages → GitHub Actions), then run the live smoke test. Optional stretch: "Inside a resistor".

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

## M1 notes

- Views: `#/circuits/one|series|parallel|combination|bulbs|kirchhoff|solve`. Parallel opens in compare mode with a prediction; switches close when she picks.
- `js/ui/reduce.js` (StageAnimator: highlight a group, then cross-fade to the reduced circuit; every stage is solved fresh). `js/ui/loop-walk.js` (marker + running loop sum).
- `placePredict()` puts prediction cards top-right on wide screens, above the sim on phones.

## M2 notes

- RC lab time scale is fixed at real time (default τ = 3.00 s); it never rescales when R or C change, so slower really looks slower. Solve presets run at τ_ref/3 (e.g. Example 2 at 0.06×), with a label.
- Net push ε − q/C is drawn on the height map (pink double arrow at the resistor) and as DOM bars ("The push on the charges").

## M3 notes

- Plate lab (`PlateLab` in capacitors.js): connected locks V, disconnected locks Q. Work you did = ∫F dd for gap moves (analytic per step) and energy bookkeeping for area moves; check line shows W + W_battery = ΔU. Marks/field lines use a display scale set by ε (fixed while A, d change).
- Series/parallel and charge sharing run the transient solver through 1 Ω of wire, slowed down (label shows the factor). Plate size drawn ∝ √C.

## M4 notes

- Sandbox: grid arrows log-scaled and clamped (300 N/C to 300 kN/C), probe arrows linear so they add tip to tail. Touch drags only block scrolling when they start on a charge/probe (or near the dipole).
- Dipole inertia chosen so one swing takes ~2.5 s at defaults (ⓘ note says so).

## Blockers

- Deploy: `gh auth status` fails in the container (invalid GH_TOKEN). Steps are in DEPLOY.md.

## How to use this (for the student)

- Start with **Circuits** (the home screen marks it "Start here"), then RC, Capacitors, Fields. Each takes 3 to 5 minutes.
- **Height = voltage.** The battery is a lift that raises charge by ε. Wires are flat. A resistor is a downhill ramp (drop IR). A capacitor is a step of height q/C. Colour shows height too (legend under each circuit).
- **Dots = current.** Faster dots mean more current. Dots are never used up at a junction: as many leave as arrive.
- **Pink arrows = push.** Each resistor's arrow is as long as its voltage drop. In RC circuits, watch the net push ε − q/C shrink.
- When asked to predict, choose before the sim runs. Then use Solve: step through a worked problem and try a variation.
