// Synthétiseur de piano en Web Audio pur (aucun échantillon à télécharger).
import { midiToFreq } from './notes';

interface Voice {
  oscs: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
}

export class PianoSynth {
  readonly ctx: AudioContext;
  /** Sortie générale (piano, métronome, batterie) */
  readonly master: GainNode;
  private dry: GainNode;
  private voices = new Map<number, Voice>();
  private sustain = false;
  private sustained = new Set<number>();
  private wave: PeriodicWave;
  private noise: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const ctx = this.ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(limiter);

    // Réverbération légère pour donner de l'ampleur
    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    reverb.connect(wet).connect(this.master);

    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    this.dry.connect(reverb);

    // Timbre : harmoniques décroissantes, proche d'une corde frappée
    const harmonics = [0, 1, 0.55, 0.3, 0.22, 0.12, 0.09, 0.05, 0.035, 0.02, 0.012];
    const real = new Float32Array(harmonics.length);
    const imag = new Float32Array(harmonics);
    this.wave = ctx.createPeriodicWave(real, imag);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  private makeImpulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  resume() {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setVolume(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  noteOn(midi: number, velocity = 0.75) {
    const ctx = this.ctx;
    this.stopVoice(midi, 0.015);
    this.sustained.delete(midi);

    const t = ctx.currentTime;
    const f = midiToFreq(midi);
    const v = Math.max(0.05, Math.min(1, velocity));
    // Aigus plus courts, graves plus longs
    const k = Math.min(1, Math.max(0, (midi - 21) / 87));
    const decay = 3.2 - 2.6 * k;
    const peak = 0.28 * Math.pow(v, 1.4) * (1 - 0.35 * k);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    const bright = Math.min(16000, f * (4 + 10 * v) + 1500 * v);
    filter.frequency.setValueAtTime(bright, t);
    filter.frequency.setTargetAtTime(Math.min(12000, f * 2.5 + 300), t + 0.01, 0.6 + decay * 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.004);
    gain.gain.setTargetAtTime(peak * 0.4, t + 0.006, 0.12);
    gain.gain.setTargetAtTime(0.0001, t + 0.35, decay);

    const oscs: OscillatorNode[] = [];
    for (const detune of [-2.5, 2.5]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.wave);
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      o.start(t);
      oscs.push(o);
    }
    filter.connect(gain).connect(this.dry);

    // Bruit de marteau très court
    const hammer = ctx.createBufferSource();
    hammer.buffer = this.noise;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = Math.min(8000, f * 3);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.05 * v, t);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    hammer.connect(hf).connect(hg).connect(this.dry);
    hammer.start(t);

    const stopAt = t + 0.35 + decay * 6;
    oscs.forEach((o) => o.stop(stopAt));
    this.voices.set(midi, { oscs, gain, filter });
    oscs[0].onended = () => {
      if (this.voices.get(midi)?.gain === gain) this.voices.delete(midi);
    };
  }

  noteOff(midi: number) {
    if (this.sustain) {
      this.sustained.add(midi);
      return;
    }
    this.stopVoice(midi, 0.09);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (!on) {
      for (const m of this.sustained) this.stopVoice(m, 0.12);
      this.sustained.clear();
    }
  }

  allOff() {
    this.sustain = false;
    this.sustained.clear();
    for (const m of [...this.voices.keys()]) this.stopVoice(m, 0.05);
  }

  private stopVoice(midi: number, release: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.voices.delete(midi);
    const t = this.ctx.currentTime;
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0, t, release / 3);
    voice.oscs.forEach((o) => {
      try {
        o.stop(t + release * 3);
      } catch {
        /* déjà arrêté */
      }
    });
  }
}
