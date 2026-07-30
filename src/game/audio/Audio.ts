import type { DamageKind } from '@/data/types';

/**
 * Procedural audio. Every sound in the game is synthesised at runtime from
 * noise, oscillators, filters and envelopes; there is not one sample file.
 *
 * That is a deliberate choice rather than a shortcut. The game ships with no art
 * or audio assets, and synthesis means the whole soundscape costs a few hundred
 * lines and zero bytes of payload, varies naturally shot to shot instead of
 * repeating one clip forty times a minute, and can be driven directly by sim
 * values: how big the blast was, how far away it landed, which damage kind hit.
 *
 * Three things matter for it not to become noise:
 *
 *   1. Voice limiting. A single frame can produce a dozen deaths and a special's
 *      whole barrage. Every one-shot goes through a concurrency cap and a
 *      per-category minimum gap, so a big push thickens rather than clips.
 *   2. Panning from the camera. Fighting at the edge of the view is quieter and
 *      off to one side, which is most of what makes the lane feel wide.
 *   3. Nothing starts until the player touches the screen. Browsers suspend
 *      audio contexts created without a gesture, so `unlock()` is called from
 *      the first real interaction and everything before that is a no-op.
 */

type Category = 'hit' | 'shot' | 'boom' | 'gate' | 'spawn' | 'ui';

/** Minimum gap between two sounds of the same category, in seconds. */
const MIN_GAP: Record<Category, number> = {
  hit: 0.035,
  shot: 0.03,
  boom: 0.06,
  gate: 0.09,
  spawn: 0.08,
  ui: 0.02,
};

const MAX_VOICES = 18;

/** Root note per age, in Hz. Drops a little as the eras get heavier. */
const BED_ROOT = [98, 87.31, 82.41, 73.42, 65.41];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private voices = 0;
  private lastAt: Record<Category, number> = {
    hit: 0,
    shot: 0,
    boom: 0,
    gate: 0,
    spawn: 0,
    ui: 0,
  };

  private bed: {
    osc: OscillatorNode[];
    filter: BiquadFilterNode;
    gain: GainNode;
    lfo: OscillatorNode;
  } | null = null;

  private sfxOn = true;
  private musicOn = true;

  /**
   * Must be called from inside a user gesture. Safe to call repeatedly; a
   * suspended context is resumed rather than rebuilt.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxOn ? 1 : 0;
      this.sfx.connect(this.master);

      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicOn ? 0.5 : 0;
      this.music.connect(this.master);

      this.noise = this.makeNoise(2);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.sfx && this.ctx) {
      this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
    }
  }

  /** Two seconds of white noise, reused by every noise-based voice. */
  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Gate on concurrency and per-category rate. Returns null when refused. */
  private take(category: Category): { ctx: AudioContext; t: number; out: GainNode } | null {
    if (!this.ctx || !this.sfx || this.ctx.state !== 'running' || !this.sfxOn) return null;
    const t = this.ctx.currentTime;
    if (t - this.lastAt[category] < MIN_GAP[category]) return null;
    if (this.voices >= MAX_VOICES) return null;
    this.lastAt[category] = t;
    this.voices++;
    return { ctx: this.ctx, t, out: this.sfx };
  }

  private release(node: AudioScheduledSourceNode, at: number): void {
    node.stop(at);
    node.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      node.disconnect();
    };
  }

  /** Noise voice through a filter with an exponential amplitude decay. */
  private noiseBurst(opts: {
    category: Category;
    pan: number;
    gain: number;
    decay: number;
    type: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
  }): void {
    const slot = this.take(opts.category);
    if (!slot || !this.noise) return;
    const { ctx, t, out } = slot;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.setValueAtTime(opts.from, t);
    if (opts.to !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t + opts.decay);
    }
    filter.Q.value = opts.q ?? 1;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(opts.gain, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + opts.decay);

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));

    src.connect(filter).connect(amp).connect(panner).connect(out);
    src.start(t);
    this.release(src, t + opts.decay + 0.02);
  }

  /** Pitched voice with a frequency sweep. Used for sub thumps and energy. */
  private tone(opts: {
    category: Category;
    pan: number;
    gain: number;
    decay: number;
    from: number;
    to: number;
    type?: OscillatorType;
  }): void {
    const slot = this.take(opts.category);
    if (!slot) return;
    const { ctx, t, out } = slot;

    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.decay);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(opts.gain, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + opts.decay);

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));

    osc.connect(amp).connect(panner).connect(out);
    osc.start(t);
    this.release(osc, t + opts.decay + 0.02);
  }

  // ------------------------------------------------------------------ one-shots

  /** A landed melee blow or a bullet connecting. */
  hit(kind: DamageKind, heavy: boolean, pan = 0): void {
    const g = heavy ? 0.5 : 0.3;
    switch (kind) {
      case 'impact':
        // Blunt: a body-sized thud with a wooden crack on top.
        this.noiseBurst({ category: 'hit', pan, gain: g, decay: 0.1, type: 'bandpass', from: 420, to: 180, q: 1.2 });
        if (heavy) this.tone({ category: 'hit', pan, gain: 0.35, decay: 0.14, from: 130, to: 55 });
        break;
      case 'pierce':
        // Sharp and bright, almost all transient.
        this.noiseBurst({ category: 'hit', pan, gain: g * 0.8, decay: 0.06, type: 'highpass', from: 2400, q: 0.7 });
        break;
      case 'blast':
        this.noiseBurst({ category: 'hit', pan, gain: g, decay: 0.18, type: 'lowpass', from: 900, to: 140 });
        break;
      case 'energy':
        // Ringing, with a downward chirp.
        this.tone({ category: 'hit', pan, gain: g * 0.7, decay: 0.16, from: 1500, to: 320, type: 'triangle' });
        this.noiseBurst({ category: 'hit', pan, gain: 0.16, decay: 0.1, type: 'bandpass', from: 3000, q: 6 });
        break;
    }
  }

  /** A weapon firing. Arc shots get the softer, lower launch. */
  shot(kind: DamageKind, arc: boolean, pan = 0): void {
    if (arc) {
      this.noiseBurst({ category: 'shot', pan, gain: 0.26, decay: 0.13, type: 'lowpass', from: 700, to: 160 });
      this.tone({ category: 'shot', pan, gain: 0.18, decay: 0.12, from: 190, to: 90 });
      return;
    }
    if (kind === 'energy') {
      this.tone({ category: 'shot', pan, gain: 0.3, decay: 0.12, from: 2200, to: 420, type: 'sawtooth' });
      return;
    }
    // Gunfire and bowstrings: crack with a fast lowpass collapse.
    this.noiseBurst({ category: 'shot', pan, gain: 0.3, decay: 0.075, type: 'lowpass', from: 4200, to: 700 });
  }

  /** Splash detonation. `size` is the blast radius in world px. */
  explosion(size: number, pan = 0): void {
    const big = Math.min(1.6, size / 90);
    this.noiseBurst({
      category: 'boom',
      pan,
      gain: 0.4 + big * 0.22,
      decay: 0.34 + big * 0.42,
      type: 'lowpass',
      from: 1400,
      to: 70,
    });
    this.tone({
      category: 'boom',
      pan,
      gain: 0.4 + big * 0.2,
      decay: 0.4 + big * 0.4,
      from: 120 - big * 25,
      to: 32,
    });
  }

  /** Something chewing on a gate. Structural, low, slow. */
  gateHit(pan = 0): void {
    this.noiseBurst({ category: 'gate', pan, gain: 0.34, decay: 0.3, type: 'lowpass', from: 500, to: 90 });
    this.tone({ category: 'gate', pan, gain: 0.3, decay: 0.34, from: 95, to: 40 });
  }

  /** A unit leaving the gate. Deliberately tiny; this fires constantly. */
  spawn(pan = 0): void {
    this.noiseBurst({ category: 'spawn', pan, gain: 0.1, decay: 0.07, type: 'bandpass', from: 900, to: 500, q: 2 });
  }

  /** Age up. The one triumphant sound in the game, so it gets a chord. */
  evolve(): void {
    const slot = this.take('boom');
    if (!slot) return;
    const { ctx, t, out } = slot;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.28, t + 0.06);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + 1.5);
    amp.connect(out);

    // Root, fifth, octave, sweeping up a whole tone.
    [1, 1.5, 2].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(146.83 * mult, t);
      osc.frequency.exponentialRampToValueAtTime(164.81 * mult, t + 1.2);
      const v = ctx.createGain();
      v.gain.value = 0.5 / (i + 1);
      osc.connect(v).connect(amp);
      osc.start(t);
      osc.stop(t + 1.55);
      if (i === 0) this.release(osc, t + 1.55);
      else osc.onended = () => osc.disconnect();
    });
  }

  /** The special: a descending howl before the barrage lands. */
  special(): void {
    this.noiseBurst({ category: 'boom', pan: 0, gain: 0.3, decay: 0.9, type: 'bandpass', from: 3200, to: 200, q: 3 });
    this.tone({ category: 'boom', pan: 0, gain: 0.24, decay: 1.1, from: 700, to: 60, type: 'sawtooth' });
  }

  uiTap(): void {
    this.noiseBurst({ category: 'ui', pan: 0, gain: 0.12, decay: 0.03, type: 'highpass', from: 3000 });
  }

  uiDeny(): void {
    this.tone({ category: 'ui', pan: 0, gain: 0.2, decay: 0.14, from: 180, to: 90, type: 'square' });
  }

  // ---------------------------------------------------------------- music bed

  /**
   * A drone rather than a tune. Two detuned oscillators a fifth apart through a
   * slow filter sweep: it sits under the battle without competing with the
   * impacts, and shifting its root on evolve marks the era change in the ear as
   * well as the eye.
   */
  startBed(ageIndex: number): void {
    if (!this.ctx || !this.music || this.bed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const root = BED_ROOT[Math.max(0, Math.min(BED_ROOT.length - 1, ageIndex))];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 3;

    // Slow wobble on the cutoff, so the bed breathes instead of sitting still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(t);

    const osc: OscillatorNode[] = [];
    for (const [mult, detune, level, type] of [
      [1, -6, 0.5, 'sawtooth'],
      [1.5, 5, 0.28, 'sawtooth'],
      [0.5, 0, 0.4, 'sine'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = root * mult;
      o.detune.value = detune;
      const v = ctx.createGain();
      v.gain.value = level;
      o.connect(v).connect(filter);
      o.start(t);
      osc.push(o);
    }

    filter.connect(gain).connect(this.music);
    this.bed = { osc, filter, gain, lfo };
  }

  /** Transposes the drone. Called on evolve. */
  setBedAge(ageIndex: number): void {
    if (!this.bed || !this.ctx) return;
    const root = BED_ROOT[Math.max(0, Math.min(BED_ROOT.length - 1, ageIndex))];
    const t = this.ctx.currentTime;
    const mults = [1, 1.5, 0.5];
    this.bed.osc.forEach((o, i) => {
      o.frequency.setTargetAtTime(root * mults[i], t, 0.4);
    });
  }

  /**
   * 0 when the fighting is far away, 1 when it is at your gate. Opens the filter
   * so the bed gets harsher as you lose ground.
   */
  setTension(tension: number): void {
    if (!this.bed || !this.ctx) return;
    const t = Math.max(0, Math.min(1, tension));
    this.bed.filter.frequency.setTargetAtTime(240 + t * 900, this.ctx.currentTime, 0.6);
  }

  stopBed(): void {
    if (!this.bed || !this.ctx) return;
    const { osc, gain, lfo } = this.bed;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0, t, 0.3);
    const stopAt = t + 1.2;
    for (const o of osc) {
      o.stop(stopAt);
      o.onended = () => o.disconnect();
    }
    lfo.stop(stopAt);
    this.bed = null;
  }
}

export const audio = new GameAudio();

/**
 * Browsers refuse to start an AudioContext outside a gesture, so the very first
 * touch or click anywhere in the app unlocks it once and detaches.
 */
export function installAudioUnlock(): () => void {
  const unlock = () => {
    audio.unlock();
    detach();
  };
  const detach = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return detach;
}
