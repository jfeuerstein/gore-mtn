import { jingleFor, levelsFor, type Jingle, type Scene } from './soundscape';

/** Where the player's choice of sound on or off is kept. */
const PREF_KEY = 'gore.sound';

/**
 * The game's sound, made on the spot with Web Audio: there are no sound files. Wind and the hiss
 * of skis are filtered noise; a lift is a low hum; things earned ring a few notes. Nothing plays
 * until the player has touched the screen, which is when a browser allows sound to start.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private glide: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private rain: GainNode | null = null;
  private lift: GainNode | null = null;
  private on: boolean;
  /** Metres walked since the last footstep. */
  private walked = 0;
  /** Seconds until the next bird is heard. */
  private nextCall = 12;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(PREF_KEY);
    } catch {
      // No storage: sound is simply on.
    }
    this.on = stored !== '0';
  }

  get enabled(): boolean {
    return this.on;
  }

  /** Turn sound on or off, and remember the choice. */
  setEnabled(on: boolean): void {
    this.on = on;
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch {
      // Not remembered, then.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.05);
    if (on) this.unlock();
  }

  /** Start the sound. Must be called from a touch or a click; safe to call again. */
  unlock(): void {
    if (!this.on) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      this.master = master;

      // Two seconds of noise, looped, feeds everything that hisses.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const voice = (type: BiquadFilterType, q: number): { gain: GainNode; filter: BiquadFilterNode } => {
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.Q.value = q;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        noise.connect(filter).connect(gain).connect(master);
        return { gain, filter };
      };
      this.wind = voice('lowpass', 0.6);
      this.glide = voice('bandpass', 0.9);
      const rain = voice('highpass', 0.5);
      rain.filter.frequency.value = 5200;
      this.rain = rain.gain;
      noise.start();

      // The lift: two low notes a fifth apart.
      const lift = ctx.createGain();
      lift.gain.value = 0;
      lift.connect(master);
      for (const [freq, level] of [[55, 0.5], [82.5, 0.22]] as const) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g).connect(lift);
        osc.start();
      }
      this.lift = lift;
    } catch {
      this.ctx = null;
    }
  }

  /**
   * Bring the continuous sounds to where the scene wants them, and make the passing ones.
   * @param night after dark, the owl takes over from the chickadee
   * @param crickets true on a summer night
   */
  update(dt: number, scene: Scene, night: boolean, crickets: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.on || ctx.state !== 'running' || !this.wind || !this.glide || !this.rain || !this.lift) return;
    const now = ctx.currentTime;
    const l = levelsFor(scene);
    this.wind.gain.gain.setTargetAtTime(l.wind * 0.5, now, 0.25);
    this.wind.filter.frequency.setTargetAtTime(l.windTone, now, 0.25);
    this.glide.gain.gain.setTargetAtTime(l.glide * 0.42, now, 0.06);
    this.glide.filter.frequency.setTargetAtTime(l.glideTone, now, 0.06);
    this.rain.gain.setTargetAtTime(l.rain * 0.12, now, 0.5);
    this.lift.gain.setTargetAtTime(l.lift * 0.16, now, 0.4);

    // Footsteps: a soft crunch every stride.
    if (scene.mode === 'walk' && scene.speed > 0.5) {
      this.walked += scene.speed * dt;
      if (this.walked > 2.4) {
        this.walked = 0;
        this.burst(700 + Math.random() * 300, 0.07, 0.1);
      }
    }
    // Now and then, a bird: a chickadee's two notes by day, an owl's hoots at night.
    this.nextCall -= dt;
    if (this.nextCall <= 0) {
      this.nextCall = 18 + Math.random() * 40;
      if (night) this.notes([196, 196, 164.8, 196], 0.26, 0.07, 'sine', 0.22);
      else if (!scene.rain || scene.falling < 0.3) this.notes([3520, 2960], 0.32, 0.03, 'sine', 0.25);
    }
    if (crickets && Math.random() < dt * 0.8) this.notes([4300, 4300, 4300], 0.07, 0.012, 'sine', 0.05);
  }

  /** Ring the notes for something earned. */
  play(kind: string, detail = ''): void {
    const jingle = jingleFor(kind, detail);
    if (jingle) this.jingle(jingle);
  }

  private jingle(j: Jingle): void {
    if (j.voice === 'thud') this.burst(180, 0.12, 0.5);
    this.notes(j.notes, j.gap, j.gain * 0.22, j.voice === 'pluck' ? 'triangle' : 'sine', j.voice === 'pluck' ? 0.18 : 0.7, j.voice === 'thud' ? 0.06 : 0);
  }

  /** A run of notes, each fading away. */
  private notes(freqs: readonly number[], gap: number, gain: number, type: OscillatorType, ring: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.on || ctx.state !== 'running') return;
    freqs.forEach((freq, i) => {
      const at = ctx.currentTime + delay + i * gap;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(gain, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
      osc.connect(g).connect(this.master as GainNode);
      osc.start(at);
      osc.stop(at + ring + 0.05);
    });
  }

  /** A short burst of filtered noise: a footstep, or a stamp coming down. */
  private burst(freq: number, length: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.on || ctx.state !== 'running') return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }
}
