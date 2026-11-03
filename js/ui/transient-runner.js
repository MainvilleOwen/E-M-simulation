// Runs a Transient with a fixed physics timestep, decoupled from the frame rate.
// dt ≤ τ_min / 200, and the display clock runs at timeScale × speed of real time.
import { Transient, estimateTimeConstants } from '../core/circuit.js';

export class TransientRunner {
  /**
   * @param o.timeScale  sim seconds per real second at speed 1× (fixed per preset so comparisons are honest)
   * @param o.fallbackDt dt to use when nothing decays
   * @param o.onSample   (state) => void, called at most ~maxSamples times per frame
   */
  constructor({ timeScale = 1, fallbackDt = 1e-3, onSample = null, maxStepsPerFrame = 5000, maxSamples = 12 } = {}) {
    this.timeScale = timeScale;
    this.speed = 1;
    this.fallbackDt = fallbackDt;
    this.onSample = onSample;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.maxSamples = maxSamples;
    this.playing = false;
    this.acc = 0;
    this.sim = null;
    this.tEnd = Infinity;
  }

  load(circuit) {
    this.circuit = circuit;
    const est = estimateTimeConstants(circuit);
    this.tau = est.ok ? est.tauMin : Infinity;
    const dt = Number.isFinite(this.tau) ? this.tau / 200 : this.fallbackDt;
    this.sim = new Transient(circuit, { dt, method: 'auto' });
    this.acc = 0;
    return this.sim;
  }

  /** Call after toggling a switch or changing a value on the loaded circuit. */
  rebuild() {
    if (!this.sim) return;
    const est = estimateTimeConstants(this.circuit);
    this.tau = est.ok ? est.tauMin : Infinity;
    this.sim.setDt(Number.isFinite(this.tau) ? this.tau / 200 : this.fallbackDt);
    this.sim.rebuild();
  }

  get ok() { return !!(this.sim && this.sim.ok); }
  get state() { return this.sim ? this.sim.state : null; }
  get t() { return this.sim ? this.sim.t : 0; }

  /** Advance by a real-time interval. Returns the number of physics steps taken. */
  frame(dtReal) {
    if (!this.playing || !this.sim || !this.sim.ok) return 0;
    const dt = this.sim.dt;
    this.acc += dtReal * this.timeScale * this.speed;
    let n = Math.floor(this.acc / dt);
    if (this.sim.t + n * dt > this.tEnd) n = Math.max(0, Math.floor((this.tEnd - this.sim.t) / dt + 1e-9));
    if (n > this.maxStepsPerFrame) { n = this.maxStepsPerFrame; this.acc = 0; } else this.acc -= n * dt;
    if (n <= 0) return 0;
    const every = Math.max(1, Math.ceil(n / this.maxSamples));
    let done = 0;
    while (done < n) {
      const k = Math.min(every, n - done);
      if (!this.sim.step(k)) break;
      done += k;
      if (this.onSample) this.onSample(this.sim.state);
    }
    if (this.sim.t >= this.tEnd - dt * 0.5) this.playing = false;
    return done;
  }
}
