// Synthétiseur en Web Audio pur (aucun échantillon à télécharger) : piano et autres instruments.
import { INSTRUMENTS, type InstrumentDef } from './instruments';
import { midiToFreq } from './notes';

interface Voice {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
  release: number;
}

export class PianoSynth {
  readonly ctx: AudioContext;
  /** Sortie générale (piano, métronome, batterie) */
  readonly master: GainNode;
  private dry: GainNode;
  private voices = new Map<number, Voice>();
  private sustain = false;
  private sustained = new Set<number>();
  private waves = new Map<string, PeriodicWave>();
  private noise: AudioBuffer;
  private breathNoise: AudioBuffer;
  instrument: InstrumentDef = INSTRUMENTS[0];

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

    this.noise = this.makeNoise(0.05);
    this.breathNoise = this.makeNoise(1);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setInstrument(def: InstrumentDef) {
    this.allOff();
    this.instrument = def;
  }

  /** Forme d'onde d'un instrument (calculée une fois à partir de ses harmoniques) */
  private waveFor(def: InstrumentDef): PeriodicWave {
    let wave = this.waves.get(def.id);
    if (!wave) {
      wave = this.ctx.createPeriodicWave(new Float32Array(def.harmonics.length), new Float32Array(def.harmonics));
      this.waves.set(def.id, wave);
    }
    return wave;
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
    const d = this.instrument;
    this.stopVoice(midi, 0.015);
    this.sustained.delete(midi);

    const t = ctx.currentTime;
    const f = midiToFreq(midi);
    const v = Math.max(0.05, Math.min(1, velocity));
    const k = Math.min(1, Math.max(0, (midi - 21) / 87)); // 0 = grave, 1 = aigu
    // instruments frappés/pincés : très sensibles à la force de frappe ; sons tenus : moins
    const peak = d.gain * Math.pow(v, d.tail ? 1.4 : 0.6) * (1 - 0.35 * k);
    const sources: AudioScheduledSourceNode[] = [];

    // Filtre : brillance qui évolue pendant la note
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = d.filter.q ?? 0.7;
    const hz = (mult: number) => Math.min(16000, f * mult + 200);
    filter.frequency.setValueAtTime(hz(d.filter.start + d.filter.vel * v), t);
    let settleAt = t + 0.01;
    if (d.filter.peak && d.filter.peakTime) {
      settleAt = t + d.filter.peakTime;
      filter.frequency.linearRampToValueAtTime(hz(d.filter.peak + d.filter.vel * v * 0.5), settleAt);
    }
    filter.frequency.setTargetAtTime(hz(d.filter.sustain), settleAt, d.filter.tc);

    // Enveloppe de volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + d.attack);
    gain.gain.setTargetAtTime(peak * d.drop.level, t + d.attack, d.drop.tc);
    let stopAt = Infinity;
    if (d.tail) {
      const tc = d.tail.low + (d.tail.high - d.tail.low) * k; // aigus plus courts, graves plus longs
      gain.gain.setTargetAtTime(0.0001, t + d.tail.at, tc);
      stopAt = t + d.tail.at + tc * 6;
    }
    filter.connect(gain).connect(this.dry);

    // Vibrato commun à tous les oscillateurs
    let vibrato: GainNode | null = null;
    if (d.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = d.vibrato.rate;
      vibrato = ctx.createGain();
      vibrato.gain.setValueAtTime(0, t + d.vibrato.delay);
      vibrato.gain.linearRampToValueAtTime(d.vibrato.depth, t + d.vibrato.delay + 0.4);
      lfo.connect(vibrato);
      lfo.start(t);
      sources.push(lfo);
    }

    for (const detune of d.detune) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.waveFor(d));
      o.frequency.value = f;
      if (d.scoop) {
        o.detune.setValueAtTime(detune + d.scoop, t);
        o.detune.linearRampToValueAtTime(detune, t + 0.07);
      } else o.detune.value = detune;
      vibrato?.connect(o.detune);
      o.connect(filter);
      o.start(t);
      sources.push(o);
    }

    // Souffle continu (vents, voix), mis en forme par l'enveloppe
    if (d.breath) {
      const b = ctx.createBufferSource();
      b.buffer = this.breathNoise;
      b.loop = true;
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = Math.min(9000, f * 2);
      bf.Q.value = 0.8;
      const bg = ctx.createGain();
      bg.gain.value = d.breath / Math.max(0.01, d.gain);
      b.connect(bf).connect(bg).connect(gain);
      b.start(t, Math.random() * 0.5);
      sources.push(b);
    }

    // Bruit d'attaque (marteau, plectre, mailloche)
    if (d.click) {
      const c = ctx.createBufferSource();
      c.buffer = this.noise;
      const cf = ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.value = Math.min(8000, f * 3);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(d.click * v, t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      c.connect(cf).connect(cg).connect(this.dry);
      c.start(t);
    }

    if (stopAt < Infinity) sources.forEach((s) => s.stop(stopAt));
    this.voices.set(midi, { sources, gain, release: d.release });
    sources[sources.length - 1].onended = () => {
      if (this.voices.get(midi)?.gain === gain) this.voices.delete(midi);
    };
  }

  noteOff(midi: number) {
    if (this.sustain) {
      this.sustained.add(midi);
      return;
    }
    this.stopVoice(midi);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (!on) {
      for (const m of this.sustained) this.stopVoice(m, Math.max(0.12, this.voices.get(m)?.release ?? 0));
      this.sustained.clear();
    }
  }

  allOff() {
    this.sustain = false;
    this.sustained.clear();
    for (const m of [...this.voices.keys()]) this.stopVoice(m, 0.05);
  }

  /** Relâche une note (par défaut avec la durée de relâchement de son instrument) */
  private stopVoice(midi: number, release?: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.voices.delete(midi);
    const r = release ?? voice.release;
    const t = this.ctx.currentTime;
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0, t, r / 3);
    voice.sources.forEach((s) => {
      try {
        s.stop(t + r * 3);
      } catch {
        /* déjà arrêté */
      }
    });
  }
}
