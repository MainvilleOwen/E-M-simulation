# E&M Lab: build brief

This file is the full spec. Re-read it (and PROGRESS.md) at the start of every session and after any context compaction.

## 1. Who this is for and what it must do

The user is a student in an intro E&M course (Serway-style, chapters 25–27: capacitance, current and resistance, DC circuits, plus electric fields and dipoles from the preceding chapter). She is struggling to build intuition. She will use this for 10–20 minutes at a time, on a phone (portrait) or a Chromebook.

**Goal:** after using it, she can predict how circuits and capacitors behave, see *why*, and understand why the standard problem-solving methods work.

This is not a toy and not a fact sheet:
- Every screen must show the **mechanism** that causes the behaviour.
- The mechanism must be driven by real physics.
- Every screen must connect to how exam problems are actually solved.

**Source material:** the lecture PDFs in `source/` (Ch 25 Capacitance, Ch 26 Current & Resistance, Ch 27 DC Circuits).
- Use them for notation, style, and problem selection.
- Do not trust their printed answers. Use the verified answer key in section 5, because the slides contain errors.
- If `source/` is missing, proceed from this brief alone.

## 2. Non-negotiable design rules

### 2.1 One visual language, everywhere

**Potential = height.**
- A battery is a lift that raises charge by ε.
- An ideal wire is flat: no drop.
- A resistor is a downhill ramp with a drop of IR.
- A capacitor is a step of height q/C that grows as charge piles up.

**Circuit views have two linked panels.** They stack vertically on a phone.
- (a) **Schematic.** Wires are tinted by potential (with a legend), and animated charge dots move through it.
- (b) **Height map.** The loop is unrolled left to right as a 1D height profile. The same dots ride along it.
- Ramps, lifts and steps line up visually with their components in the schematic.

**Current = moving dots.**
- Dots show conventional (positive) flow. State this once, with an ⓘ note that real electrons move the other way.
- Dot speed is proportional to local current. One shared scale is used per screen, so side-by-side comparisons are honest.
- Dots are conserved at junctions. Optional junction counters show in = out.

**Push arrows.**
- Each resistor gets an arrow sized by its voltage drop.
- In RC circuits, the net push (ε − q/C) is drawn explicitly and visibly shrinks as the capacitor charges.

**Bulbs.** Brightness is proportional to power (P = I²R), with a numeric readout available.

### 2.2 Physics drives the picture

**The simulation drives every visual.**
- All currents, voltages, charges and fields come from the physics core every frame.
- No scripted animations.
- No hardcoded per-preset results.

**Graphs are traced live from simulated values.**
- The formula appears only after the graph, behind a "Show the equation" button.
- Each symbol in the formula is linked to its slider or readout: tapping one highlights the other.

### 2.3 Interaction

**Compare mode is first-class.**
- Circuit A and circuit B sit side by side (or stacked on a phone).
- Both use the same battery and the same dot and brightness scales.
- The user changes one thing and watches both.

**Predict, then reveal.**
- In Compare and Solve modes, she picks a prediction (multiple choice) before the sim runs.
- Then the sim runs.
- Then one or two sentences explain why, pointing at the visible mechanism.

**Honest scaling.** Wherever a visual is scaled (real drift speed is around 10⁻⁴ m/s; field arrows are log-scaled), a small ⓘ note says so.

**Presets with sliders and toggles, not a freeform drag-and-drop circuit builder.** Reliability on phones matters more than flexibility.

### 2.4 Tone

- Short, plain sentences.
- No exclamation-mark praise, no emoji, no "Wrong!".
- After a wrong prediction, show the sim and the reason, calmly.

## 3. Scope

The scope is four modules, each usable in 3–5 minutes, plus Solve problems. Build them in this order.

**Home screen:**
- Four cards, each with a one-line question it answers. Examples:
  - "Why does adding a resistor in parallel let *more* current through?"
  - "Why does a capacitor charge fast at first, then slower and slower?"
- A 30-second "How to read this app" intro covering height = voltage, dots = current, and push arrows. It is shown on first visit and can be reopened.

### M1. Circuits: series, parallel, and why

**Defaults:** battery 12 V, ideal (no internal resistance).

**One resistor (baseline).** R slider, 1–20 Ω.

**Series (R1, R2).**
- The height map shows the drop shared as two ramps.
- The same dots pass through both resistors.
- Default R1 = 3 Ω, R2 = 6 Ω → I = 1.333 A, R_eq = 9 Ω.

**Parallel. This view opens in Compare mode by default.**
- Circuit A is R1 alone. Circuit B is R1 ∥ R2.
- The view must make the mechanism visible:
  - The R1 branch in B has the same full height drop, so it carries exactly the same current as A.
  - R2 adds a second lane on top of that.
  - So the total current is larger, and R_eq < the smallest resistor.
- Defaults R1 = 3 Ω, R2 = 6 Ω give:
  - A: 4 A.
  - B: 4 A + 2 A = 6 A, R_eq = 2 Ω.

**Combination (from the slides).**
- The circuit is (8 Ω + 4 Ω) in series with (6 Ω ∥ 3 Ω), which reduces to 14 Ω.
- A "Reduce step by step" control works like this:
  - The groups visibly collapse into 12 Ω and 2 Ω, then into 14 Ω.
  - The total current is found.
  - The circuit then expands back out to give each branch's current.

**Bulbs (the slide clicker questions), as predict-then-reveal.**
- Two identical bulbs in series: is B brighter, dimmer, or the same as A? Answer: the same.
- Remove B and close the circuit: A gets brighter (4× the power). The reason shown is that the total resistance halved, so the current doubled.

**Walk the loop (the Kirchhoff loop rule).**
- A marker walks around a chosen loop, with a running sum of +ε, −IR, and so on, ending at 0.
- Include one two-battery circuit that cannot be reduced, to show why Kirchhoff's rules are needed:
  - Left branch: 12 V battery (+ toward the top node) in series with 2 Ω.
  - Middle branch: 4 Ω.
  - Right branch: 6 V battery (+ toward the top node) in series with 6 Ω.
  - Show junction-rule counters at the top node.
  - Show that a current assumed in the "wrong" direction comes out negative, but with the correct magnitude.

**Stretch** (only after Phase 7 is green): "Inside a resistor."
- A wire with length, area and material sliders, showing R = ρL/A and drift dots.

### M2. RC circuits

**Charging: battery ε, R, C, and a switch.**
- Charge accumulates visibly as + and − marks building up on the plates.
- The capacitor's step on the height map rises.
- The net push arrow (ε − q/C) shrinks, and the current dots slow down.
- Live traces show q(t), I(t) and V_C(t). The traces mark:
  - τ = RC
  - the 63% line on q(t)
  - the 37% line on I(t)
- R and C sliders replay the run, with a faded ghost of the previous trace for comparison.
- The required explanations:
  - Bigger R: slower flow, same final charge.
  - Bigger C: more charge must pile up before the push-back gets strong, so it is slower and the final charge is larger.

**Discharging** uses the same visual language.

**Time controls:**
- play, pause, reset, and a speed control
- sim time scaled so τ takes about 2–4 s on screen, with a real-time label

**Solve presets:** both RC examples from the Ch 27 slides (values are in the answer key).

### M3. Capacitors

**Plate lab.**
- Sliders: plate area A, gap d, and ε. Toggle: battery connected / disconnected.
- What's drawn:
  - ± surface charges, with density ∝ σ
  - field lines in the gap, with density ∝ E
  - readouts for C, Q, V, E and U
- **Connected:** V is locked. Pulling the plates apart makes E = V/d drop, and charge visibly flows back into the battery.
- **Disconnected:** Q is locked, so E stays constant and V = Ed grows. A "work you did" counter equals ΔU.
- Include the slide clicker question: capacitance doubles with Q fixed, so V halves.

**Series vs parallel capacitors**, on a battery.
- **Series:**
  - Outline the isolated middle "island" (the inner plates plus the wire between them).
  - Electrons are pushed from one inner plate to the other, which is why both capacitors carry equal Q.
  - The voltages split as Q/C.
- **Parallel:** the voltage is the same across both, Q splits in proportion to C, and "the areas combine."
- Slide problem: 6 µF and 3 µF on 18 V.

**Charge sharing (slide example).**
- An 8 µF capacitor at 120 V is connected to an uncharged 4 µF capacitor.
- Charge flows until the heights are equal (80 V).
- Show energy before and after.
- Explain where the missing energy went: dissipated in the connecting wires during the flow.

### M4. Fields and dipoles (keep lightweight)

**Field sandbox.**
- Up to 4 draggable point charges, each with sign and magnitude.
- The field is shown as an arrow grid, with optional field lines.
- A draggable probe shows each charge's individual contribution arrow and their vector sum, so superposition is visible.
- Preset: a dipole, with the field shown on its axis and on its perpendicular bisector.

**Dipole in a uniform field.**
- A rigid dipole with forces +qE and −qE drawn.
- Net force is 0, but there is a torque. The dipole rotates (damped) to align with the field.
- Readouts: τ = pE sinθ and U = −pE cosθ, with an energy bar.

### Solve mode (every module has 2–3 problems)

Each problem works like this:
1. The problem statement appears in slide style, and the sim loads that exact setup.
2. The solution walks through steps. Each step is one sentence plus an action on the sim (highlight, collapse, or measure). For example: "The 6 Ω and 3 Ω share the same top and bottom heights, so they're in parallel: 2 Ω." The pair then visibly collapses.
3. "Try a variation" gives the same structure with new, reasonable numbers. She types an answer:
   - Answers within 2% are accepted.
   - If she's off, the app shows the sim's value and which step to revisit.

All answers are computed by the solver at runtime, and tests cross-check them against the analytic key.

### Non-goals

- No freeform circuit builder.
- No AC.
- No magnetism.
- No accounts, no analytics, no network calls.

## 4. Technical architecture

**Static site.**
- Plain HTML, CSS and JS ES modules.
- No framework, no build step, no CDN or network requests at runtime.
- Must work from any static host (GitHub Pages).
- Hash routing: `#/`, `#/circuits`, `#/rc`, `#/capacitors`, `#/fields`.
- Dev server: `npx http-server` or similar. Note that ES modules don't load from `file://`.

**No service worker.** Stale-cache bugs outweigh the offline benefit here.

**Rendering.**
- Canvas 2D for the sims. Be devicePixelRatio-aware and redraw on ResizeObserver.
- DOM for controls and text.
- Formulas use HTML `<sub>` and `<sup>`, with no math library.

**Circuit core: `js/core/circuit.js`.**
- Modified nodal analysis.
- Elements:
  - resistor
  - voltage source (optional internal r)
  - capacitor (trapezoidal companion model for transients)
  - switch (closed = 1e-6 Ω, open = removed)
- Dense Gaussian elimination with partial pivoting (circuits have fewer than 20 nodes).
- Must provide a DC steady-state solve (capacitors open).
- Must detect a singular matrix or floating node and return `{ok:false, reason}`. Never throw into the UI.
- Fixed physics timestep, decoupled from the frame rate, with substeps so dt ≤ τ_min/200 in the UI. Tests may use a finer dt.
- Accuracy target: 0.5% versus analytic answers.

**Field core: `js/core/fields.js`.**
- Coulomb superposition, with softening near point charges (no infinities).
- Arrow display length is log-scaled and clamped (with an ⓘ note).

**Purity.** The physics core has zero DOM dependencies, so it runs under Node for tests.

**Numbers.** All displayed values use SI prefixes and 3 significant figures.

**Robustness.**
- Every slider has min, max and step, and values are clamped.
- If the physics produces NaN or Infinity, show a "Can't compute this setup" banner instead of breaking.
- A global `window.onerror` / `unhandledrejection` handler shows a small "Something went wrong. Tap to reload this module" banner.
- Switching modules tears down animation loops and listeners: no leaks, no double loops.

**Performance.**
- At most 300 dots.
- The requestAnimationFrame loop pauses when the tab is hidden or the module isn't visible.
- Must stay smooth on a low-end Chromebook.

**Touch and accessibility.**
- Touch targets ≥ 44 px.
- Pointer events, so mouse and touch both work.
- No hover-only information, and no pinch-zoom hijacking.
- Works at 360–430 px portrait and 1366×768 landscape.
- Body text ≥ 16 px.
- Colourblind-safe palette, and a potential-colour legend wherever tint is used.

**Repo layout:**
```
index.html
css/style.css
js/app.js                 router, module lifecycle, error banner
js/core/circuit.js        MNA + transients (pure)
js/core/fields.js         superposition, dipole dynamics (pure)
js/core/format.js         SI formatting
js/ui/                    stage, dots, heightmap, slider, toggle, plot, compare, predict, solve-runner
js/modules/circuits.js | rc.js | capacitors.js | fields.js
js/content/problems.js    problem definitions + variation generators
tests/unit/*.test.js      Vitest
tests/e2e/*.spec.js       Playwright
checks/<phase>/           screenshots for review
PROGRESS.md
```

## 5. Verified answer key

Unit tests must assert these within 0.5%. Wherever a slide disagrees with this table, the table wins.

### 5.1 Answers

**Ch 26: current and resistance**

| Problem | Answer |
|---|---|
| Ex 1: 18-gauge Cu wire, d = 1.02 mm, I = 1.67 A, n = 8.5×10²⁸ m⁻³ | J = 2.04×10⁶ A/m², v_d = 1.50×10⁻⁴ m/s |
| Ex 2: A = 8.20×10⁻⁷ m², I = 1.67 A, ρ = 1.72×10⁻⁸ Ω·m | E = 0.0350 V/m; ΔV over 50 m = 1.75 V; R(50 m) = 1.05 Ω |
| Ex 3: Cu wire, 1.05 Ω at 20 °C, α = 0.00393 | R(0 °C) = 0.967 Ω; R(100 °C) = 1.38 Ω |
| Ex 4: Pt thermometer, 50.0 Ω at 20 °C, reads 76.8 Ω, α = 3.92×10⁻³ | T = 156.7 °C |
| Example 26.2: nichrome, r = 0.32 mm, ρ = 1.0×10⁻⁶ Ω·m | 3.1 Ω/m |
| Example 26.4: heater, 120 V across 8.00 Ω | I = 15.0 A, P = 1.80 kW |

**Ch 25: capacitance**

| Problem | Answer |
|---|---|
| Ex 1: C = 1.0 F, d = 1.0 mm | A = 1.13×10⁸ m² |
| Ex 2: d = 5.00 mm, A = 2.00 m², V = 10 000 V | C = 3.54 nF, Q = 35.4 µC, E = 2.00×10⁶ V/m |
| 6.0 µF and 3.0 µF, parallel on 18 V | C_eq = 9.0 µF; Q₁ = 108 µC, Q₂ = 54 µC; 18 V each |
| 6.0 µF and 3.0 µF, series on 18 V | C_eq = 2.0 µF; Q = 36 µC each; V₁ = 6.0 V, V₂ = 12.0 V |
| Network (3 ∥ 11 ∥ (12 series 6)) in series with 9 µF | C_eq = 6 µF |
| Network ((1 ∥ 3) series 4) ∥ ((6 ∥ 2) series 8) | C_eq = 6 µF |
| Charge sharing: 8.0 µF at 120 V, then joined to an uncharged 4.0 µF | Q₀ = 960 µC; U_i = 0.0576 J; V = 80 V; Q₁ = 640 µC, Q₂ = 320 µC; U_f = 0.0384 J |
| Energy density: u = 1.00 J/m³ in vacuum | E = 4.75×10⁵ V/m; at 10× the field, u = 100 J/m³ |
| Clicker questions | C is unchanged when Q doubles. 12 µF series 6 µF = 4 µF, and the charge is the same on both (24 µC → 24 µC). 12 µF ∥ 6 µF = 18 µF; if the 12 µF holds 24 µC, the 6 µF holds 12 µC. |

**Ch 27: DC circuits (resistors)**

| Problem | Answer |
|---|---|
| Combination: 8 + 4 + (6 ∥ 3) | 14.0 Ω |
| M1 defaults on 12 V | 3 Ω alone: 4.00 A. 3 ∥ 6: 6.00 A, R_eq = 2.00 Ω. 3 series 6: 1.333 A, R_eq = 9.00 Ω. |
| Two-battery circuit from M1, bottom node = 0 V | V_top = 84/11 = 7.636 V. The 12 V branch carries 24/11 = 2.182 A up into the top node. The 4 Ω carries 21/11 = 1.909 A. The 6 V branch carries 3/11 = 0.273 A *into* the 6 V battery's + terminal (it's being charged). KCL: 2.182 = 1.909 + 0.273. |

**Ch 27: RC circuits**

| Problem | Answer |
|---|---|
| RC Example 1: ε = 10.0 V, R₁ = 50.0 kΩ, R₂ = 100 kΩ, C = 10.0 µF, switch across the middle | Before closing, τ = (R₁+R₂)C = 1.50 s. After closing, τ = R₂C = 1.00 s. I_switch(t) = 200 µA + (100 µA)·e^(−t/1.00 s). |
| RC Example 2: 9.00 V, 12.0 kΩ, R₂ = 15.0 kΩ, 10.0 µF in series with 3.00 kΩ | Steady state: 333 µA through the 12 kΩ and 15 kΩ, 0 through the capacitor branch; V_C = 5.00 V, Q_max = 50.0 µC. Switch opened: τ = (15 + 3) kΩ × 10 µF = 0.180 s; I_R2(t) = 278 µA·e^(−t/0.180 s). Time to fall to 1/5 charge = τ·ln5 = 0.290 s. |
| Generic RC | q(τ) = 0.632·Cε. During discharge, q(τ) = 0.368·Q. Energy check over a full charge: battery energy = ½Cε² stored + ½Cε² dissipated (within 1%). |

**Ch 27: bulbs**

| Problem | Answer |
|---|---|
| Two identical bulbs in series | A and B are equally bright |
| B removed, circuit closed | A's power ×4 |

### 5.2 Slide errors not to reproduce

- **Ch 26 Example 26.4** prints "1.8×10³ kW". The correct value is 1.80 kW.
- **Ch 25 Example 1** prints "11×10⁸ m²". The correct value is 1.13×10⁸ m².
- **Ch 26 colour-code example** draws a gray 4th band but calls it silver (10%). Don't reuse that image logic.
- **Ch 26 Exercise 4** calls 3.92×10⁻³ "indium's" coefficient. It is platinum's (the thermometer is platinum).
- The slide footers say "Section 27.x / 28.x" while the chapter titles say 26 / 27. Use the chapter titles.

## 6. Self-checking (required, not optional)

**Unit tests (Vitest).**
- Everything in section 5.
- Edge cases:
  - every element at its slider min and max
  - a floating node, which must return `{ok:false}`
  - opposing batteries
  - toggling a switch mid-transient
  - very small and very large τ
- RC energy conservation.
- Field superposition symmetry (e.g., zero field at the midpoint of equal like charges).
- Dipole: zero net force, and torque = pE sinθ.

**End-to-end tests (Playwright, Chromium)** at 390×844 with touch emulation and at 1366×768. For each module:
- It loads with zero console errors.
- Every preset loads.
- Every slider can be driven to min, mid and max. After each, scan the DOM text for `NaN`, `Infinity` and `undefined`. There must be none.
- Compare and Predict flows complete.
- Each Solve problem walks to the end.
- A variation accepts a correct answer and rejects a wrong one.
- Rapid module switching (10× back and forth) causes no errors and no duplicated loops: check that the frame-callback count stays bounded.
- Screenshots are saved to `checks/<phase>/`.

**Visual review after every module phase.** Open the screenshots (Read tool) and check:
- Is it readable at 390 px, with nothing overlapping or cut off?
- Is the mechanism visible without reading any text?
- Does the height map match the schematic?
- Do dot speeds visibly differ wherever the currents differ?
- Is the potential legend present wherever tint is used?

Fix any problem and re-screenshot before marking the phase done.

**Fresh-eyes review (Phase 7).** Spawn a subagent that has not seen the code. Give it only the running site and section 5. It must:
- (a) try to break each module at both viewports
- (b) solve 3 problems by hand and compare them with the app
- (c) list anything that would confuse a struggling student

Fix every real issue it reports.

**`npm run check`** runs the unit tests, the e2e tests and a link check. It must be green before any phase is marked done.

## 7. Process: phases, checkpoints, resume

Work autonomously. Do not ask questions, except at Phase 8 (deploy).

### 7.1 PROGRESS.md format

- A checklist of phases.
- A line `IN PROGRESS: Phase N, <current step>`.
- A line `Next: <exact next action>`.
- A "Blockers" section.

Update it at every meaningful step, not just at the end of a phase.

### 7.2 Rules

- **End of every phase:**
  - Run its gate.
  - `git commit -m "Phase N: <summary>"`.
  - Tick the box in PROGRESS.md and write `Next:`.
- **Never leave HEAD broken.** Commit only green states. Work in progress lives in the working tree, described in PROGRESS.md.
- **Repeated failures.** If a gate fails twice for the same reason:
  - Log the blocker.
  - Move to the next phase that doesn't depend on it.
  - Return to the blocker later.
- **Usage guard.** Assume work can stop at any moment (usage limit or crash). The last commit plus PROGRESS.md must always be enough to resume with no other context.
- **After a compaction or a new session:**
  - Re-read this file and PROGRESS.md.
  - Run `npm run check` to confirm the state.
  - Continue from `Next:`.

### 7.3 Phases

Model and effort are listed per phase. In a single unattended run, staying on Opus throughout is fine. The listing matters when resuming.

| # | Phase | Model / effort | Gate |
|---|---|---|---|
| 0 | Setup: git init, package.json, Vitest, Playwright (`npx playwright install chromium`), static server script, skeleton index + router + error banner + design tokens, PROGRESS.md | Sonnet / medium | `npm run check` runs a smoke test green |
| 1 | Physics core: circuit.js, fields.js, format.js, plus all section 5 tests | Opus / high | All answer-key and edge-case unit tests pass |
| 2 | UI kit: stage, dot system tied to solver currents, height map, slider, toggle, live plot with ghost trace, compare layout, predict card, solve-step runner. Plus a hidden `#/kitchen-sink` demo page. | Sonnet / medium | e2e on the kitchen sink; screenshots reviewed |
| 3 | M1 Circuits (highest priority) | Opus / high | Module e2e + visual review |
| 4 | M2 RC circuits | Opus / high | Module e2e + visual review |
| 5 | M3 Capacitors | Sonnet / medium | Module e2e + visual review |
| 6 | M4 Fields & dipoles | Sonnet / medium | Module e2e + visual review |
| 7 | Home screen, intro, polish, fresh-eyes subagent review, fixes | Opus / high | `npm run check` green; review issues resolved |
| 8 | Deploy to GitHub Pages | Sonnet / low | Live URL loads all modules |
| S | Stretch: "Inside a resistor" (only if time remains) | Sonnet / medium | Module e2e |

### 7.4 Phase 8 deploy

1. Stop and ask Owen to confirm before creating a public repository.
2. If `gh auth status` fails, don't try to log in. Write DEPLOY.md with the exact commands and stop.
3. After deploying, run the e2e smoke test against the live URL.
4. Print the final URL.

## 8. Definition of done

All of the following must hold:
- Phases 0–7 are ticked, and `npm run check` is green.
- Every number in section 5 matches.
- There are zero console errors on both viewports.
- The fresh-eyes review is addressed.
- PROGRESS.md ends with a short "How to use this" note for the student: which module to start with, and how to read height, dots and arrows.
